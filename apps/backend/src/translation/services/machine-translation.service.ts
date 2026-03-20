import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma } from '@prisma/client';
import { EncryptionService } from './encryption.service';
import { WinstonLoggerService } from '../../common/logger/logger.service';
import {
  ITranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
  AdapterConfig,
  TranslationProviderInfo,
} from '../adapters';
import { GoogleTranslateAdapter } from '../adapters/google-translate.adapter';
import { DeepLTranslateAdapter } from '../adapters/deepl-translate.adapter';
import { CustomTranslateAdapter } from '../adapters/custom-translate.adapter';
import { MockTranslateAdapter } from '../adapters/mock-translate.adapter';
import { TencentTranslateAdapter } from '../adapters/tencent-translate.adapter';
import { BaiduTranslateAdapter } from '../adapters/baidu-translate.adapter';
import {
  TranslationProviderType,
  TranslationJobStatus,
  TranslationProvider,
} from '@prisma/client';

// 翻译供应商创建参数接口
interface CreateProviderData {
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  rateLimitPerMin?: number;
  maxCharsPerReq?: number;
  maxTextsPerReq?: number;
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

// 翻译供应商更新参数接口
interface UpdateProviderData {
  name?: string;
  type?: string;
  baseUrl?: string;
  apiKey?: string;
  isEnabled?: boolean;
  isDefault?: boolean;
  rateLimitPerMin?: number;
  maxCharsPerReq?: number;
  maxTextsPerReq?: number;
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

// 翻译供应商响应接口
export interface ProviderResponse {
  id: string;
  name: string;
  type: TranslationProviderType;
  isEnabled: boolean;
  isDefault: boolean;
}

/**
 * 机器翻译服务
 * 管理翻译供应商适配器并执行翻译任务
 */
@Injectable()
export class MachineTranslationService {
  private readonly logger = new Logger(MachineTranslationService.name);
  private readonly adapters = new Map<string, ITranslationAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly winstonLogger: WinstonLoggerService,
  ) {
    // 注册内置适配器
    this.registerAdapter('GOOGLE', new GoogleTranslateAdapter());
    this.registerAdapter('DEEPL', new DeepLTranslateAdapter());
    this.registerAdapter('CUSTOM', new CustomTranslateAdapter());
    this.registerAdapter('MOCK', new MockTranslateAdapter());
    this.registerAdapter('TENCENT', new TencentTranslateAdapter(winstonLogger));
    this.registerAdapter('BAIDU', new BaiduTranslateAdapter());
  }

  /**
   * 注册适配器
   */
  registerAdapter(type: string, adapter: ITranslationAdapter): void {
    this.adapters.set(type, adapter);
    this.logger.log(`Registered translation adapter: ${type}`);
  }

  /**
   * 获取适配器实例
   */
  private async getAdapter(
    providerId: string,
  ): Promise<{ adapter: ITranslationAdapter; provider: TranslationProvider }> {
    const provider = await this.prisma.translationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(
        `Translation provider ${providerId} not found`,
      );
    }

    if (!provider.isEnabled) {
      throw new Error(`Translation provider ${provider.name} is disabled`);
    }

    const adapter = this.adapters.get(provider.type);
    if (!adapter) {
      throw new Error(`No adapter found for provider type: ${provider.type}`);
    }

    // 解密API密钥并初始化适配器
    const apiKey = this.encryptionService.decrypt(provider.apiKeyEncrypted);
    const config: AdapterConfig = {
      baseUrl: provider.baseUrl,
      apiKey,
      config: provider.config as Record<string, unknown>,
      timeout: provider.timeoutMs,
    };

    adapter.initialize(config);

    return { adapter, provider };
  }

  /**
   * 执行单个文本翻译
   */
  async translate(
    providerId: string,
    text: string,
    options: TranslateOptions,
  ): Promise<TranslateResult> {
    const { adapter, provider } = await this.getAdapter(providerId);

    this.logger.debug(
      `Translating with ${provider.name}: ${text.substring(0, 50)}...`,
    );

    const result = await adapter.translate(text, options);

    // 记录翻译成本
    await this.recordTranslationCost(provider.id, text.length);

    return result;
  }

  /**
   * 执行批量翻译
   */
  async translateBatch(
    providerId: string,
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult> {
    const { adapter, provider } = await this.getAdapter(providerId);

    this.logger.debug(
      `Batch translating ${texts.length} texts with ${provider.name}`,
    );

    const result = await adapter.translateBatch(texts, options);

    // 记录翻译成本
    await this.recordTranslationCost(provider.id, result.totalCharacters);

    return result;
  }

  /**
   * 创建并执行翻译任务
   */
  async createTranslationJob(
    providerId: string,
    texts: string[],
    sourceLanguage: string,
    targetLanguage: string,
    projectId?: string,
  ): Promise<string> {
    const { provider } = await this.getAdapter(providerId);

    const totalCharacters = texts.reduce((sum, text) => sum + text.length, 0);

    // 创建翻译任务记录
    const job = await this.prisma.translationJob.create({
      data: {
        providerId: provider.id,
        projectId,
        status: TranslationJobStatus.PENDING,
        sourceLanguage,
        targetLanguage,
        texts,
        characterCount: totalCharacters,
      },
    });

    // 异步执行翻译
    this.executeTranslationJob(job.id).catch((error) => {
      this.logger.error(`Translation job ${job.id} failed:`, error);
    });

    return job.id;
  }

  /**
   * 执行翻译任务
   */
  private async executeTranslationJob(jobId: string): Promise<void> {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Translation job ${jobId} not found`);
    }

    // 更新状态为处理中
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: TranslationJobStatus.PROCESSING },
    });

    try {
      const result = await this.translateBatch(job.providerId, job.texts, {
        sourceLanguage: job.sourceLanguage,
        targetLanguage: job.targetLanguage,
      });

      // 更新任务为完成
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: TranslationJobStatus.COMPLETED,
          results: result.translations.map((t) => t.translatedText),
          completedAt: new Date(),
        },
      });
    } catch (error) {
      // 更新任务为失败
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: TranslationJobStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * 获取翻译任务状态
   */
  async getTranslationJob(jobId: string) {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
      include: {
        provider: {
          select: {
            name: true,
            type: true,
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Translation job ${jobId} not found`);
    }

    return job;
  }

  /**
   * 获取翻译任务列表
   */
  async getTranslationJobs(dto: any) {
    const {
      page = 1,
      pageSize = 20,
      userId,
      providerId,
      projectId,
      status,
      startDate,
      endDate,
    } = dto;

    const where: Prisma.TranslationJobWhereInput = {};

    if (userId) where.userId = userId;
    if (providerId) where.providerId = providerId;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.translationJob.findMany({
        where,
        include: {
          provider: { select: { name: true, type: true } },
          user: { select: { name: true, avatar: true } },
          project: { select: { name: true } },
          items: {
            select: {
              status: true,
              translations: { select: { status: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.translationJob.count({ where }),
    ]);

    const formattedItems = items.map((job) => {
      const successCount = job.items.reduce((sum, item) => {
        return sum + item.translations.filter((t) => t.status === 'SUCCESS').length;
      }, 0);
      const failedCount = job.items.reduce((sum, item) => {
        return sum + item.translations.filter((t) => t.status === 'FAILED').length;
      }, 0);

      return {
        ...job,
        providerName: job.provider.name,
        providerType: job.provider.type,
        userName: job.user?.name || null,
        userAvatar: job.user?.avatar || null,
        projectName: job.project?.name || null,
        totalKeys: job.items.length,
        successCount,
        failedCount,
      };
    });

    return {
      items: formattedItems,
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取翻译任务详情
   */
  async getTranslationJobDetail(jobId: string) {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
      include: {
        provider: { select: { id: true, name: true, type: true } },
        user: { select: { id: true, name: true, avatar: true } },
        project: { select: { id: true, name: true } },
        items: {
          include: {
            translations: {
              orderBy: { targetLanguage: 'asc' },
            },
          },
          orderBy: { keyName: 'asc' },
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Translation job ${jobId} not found`);
    }

    return job;
  }

  /**
   * 创建翻译供应商
   */
  async createProvider(data: CreateProviderData): Promise<ProviderResponse> {
    // 加密API密钥
    const apiKeyEncrypted = this.encryptionService.encrypt(data.apiKey);

    // 如果设置为默认，先将其他供应商设为非默认
    if (data.isDefault) {
      await this.prisma.translationProvider.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const provider = await this.prisma.translationProvider.create({
      data: {
        name: data.name,
        type: data.type as TranslationProviderType,
        baseUrl: data.baseUrl,
        apiKeyEncrypted,
        isEnabled: data.isEnabled ?? true,
        isDefault: data.isDefault ?? false,
        rateLimitPerMin: data.rateLimitPerMin ?? 60,
        maxCharsPerReq: data.maxCharsPerReq ?? 5000,
        maxTextsPerReq: data.maxTextsPerReq ?? 100,
        timeoutMs: data.timeoutMs ?? 30000,
        config: (data.config as Prisma.JsonValue) || {},
      },
    });

    this.logger.log(
      `Created translation provider: ${provider.name} (${provider.id})`,
    );

    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      isEnabled: provider.isEnabled,
      isDefault: provider.isDefault,
    };
  }

  /**
   * 删除翻译供应商
   */
  async deleteProvider(providerId: string): Promise<void> {
    const provider = await this.prisma.translationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(
        `Translation provider ${providerId} not found`,
      );
    }

    await this.prisma.translationProvider.delete({
      where: { id: providerId },
    });

    this.logger.log(
      `Deleted translation provider: ${provider.name} (${providerId})`,
    );
  }

  /**
   * 更新翻译供应商
   */
  async updateProvider(
    providerId: string,
    data: UpdateProviderData,
  ): Promise<ProviderResponse> {
    const provider = await this.prisma.translationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(
        `Translation provider ${providerId} not found`,
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, unknown> = { ...data };

    // 如果更新包含 API 密钥，需要加密
    if (data.apiKey) {
      updateData.apiKeyEncrypted = this.encryptionService.encrypt(data.apiKey);
      delete updateData.apiKey;
    }

    const updated = await this.prisma.translationProvider.update({
      where: { id: providerId },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: updateData as any,
    });

    this.logger.log(
      `Updated translation provider: ${updated.name} (${providerId})`,
    );

    return {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      isEnabled: updated.isEnabled,
      isDefault: updated.isDefault,
    };
  }

  /**
   * 设置默认供应商
   */
  async setDefaultProvider(providerId: string): Promise<void> {
    const provider = await this.prisma.translationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(
        `Translation provider ${providerId} not found`,
      );
    }

    // 先将所有供应商设为非默认
    await this.prisma.translationProvider.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // 设置当前供应商为默认
    await this.prisma.translationProvider.update({
      where: { id: providerId },
      data: { isDefault: true },
    });

    this.logger.log(
      `Set default translation provider: ${provider.name} (${providerId})`,
    );
  }

  /**
   * 获取支持的供应商列表
   */
  async getProviders(): Promise<
    Array<{
      id: string;
      name: string;
      type: TranslationProviderType;
      baseUrl: string;
      isEnabled: boolean;
      isDefault: boolean;
      rateLimitPerMin: number;
      maxCharsPerReq: number;
      maxTextsPerReq: number;
      timeoutMs: number;
    }>
  > {
    return this.prisma.translationProvider.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        baseUrl: true,
        isEnabled: true,
        isDefault: true,
        rateLimitPerMin: true,
        maxCharsPerReq: true,
        maxTextsPerReq: true,
        timeoutMs: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 获取供应商详情
   */
  async getProviderInfo(providerId: string): Promise<TranslationProviderInfo> {
    const { adapter } = await this.getAdapter(providerId);
    return adapter.getProviderInfo();
  }

  /**
   * 检查供应商健康状态
   */
  async checkProviderHealth(providerId: string): Promise<boolean> {
    try {
      const { adapter } = await this.getAdapter(providerId);
      return await adapter.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * 获取默认供应商
   */
  async getDefaultProvider(): Promise<{
    id: string;
    name: string;
    type: TranslationProviderType;
  } | null> {
    const provider = await this.prisma.translationProvider.findFirst({
      where: {
        isDefault: true,
        isEnabled: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    return provider;
  }

  /**
   * 记录翻译成本
   */
  private async recordTranslationCost(
    providerId: string,
    characterCount: number,
  ): Promise<void> {
    try {
      // 获取当前账单周期
      const now = new Date();
      const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // 估算成本（简化计算，实际应根据各供应商定价）
      const estimatedCost = this.estimateCost(providerId, characterCount);

      await this.prisma.translationCost.create({
        data: {
          providerId,
          characterCount,
          estimatedCost,
          billingPeriod,
        },
      });
    } catch (error) {
      this.logger.error('Failed to record translation cost:', error);
    }
  }

  /**
   * 估算翻译成本
   */
  private estimateCost(providerId: string, characterCount: number): number {
    // 简化的成本估算（USD per million characters）
    const rates: Record<string, number> = {
      GOOGLE: 20,
      DEEPL: 25,
      CUSTOM: 15,
    };

    // 获取供应商类型
    this.prisma.translationProvider
      .findUnique({
        where: { id: providerId },
        select: { type: true },
      })
      .then((provider) => {
        const rate = provider ? rates[provider.type] || 20 : 20;
        return (characterCount / 1000000) * rate;
      })
      .catch(() => {
        return (characterCount / 1000000) * 20;
      });

    return (characterCount / 1000000) * 20;
  }

  /**
   * 获取翻译成本统计
   */
  async getCostStatistics(
    providerId?: string,
    billingPeriod?: string,
  ): Promise<
    Array<{
      providerId: string;
      providerName: string;
      billingPeriod: string;
      totalCharacters: number;
      totalCost: number;
      jobCount: number;
    }>
  > {
    const where: { providerId?: string; billingPeriod?: string } = {};
    if (providerId) where.providerId = providerId;
    if (billingPeriod) where.billingPeriod = billingPeriod;

    const costs = await this.prisma.translationCost.groupBy({
      by: ['providerId', 'billingPeriod'],
      where,
      _sum: {
        characterCount: true,
        estimatedCost: true,
      },
      _count: {
        id: true,
      },
      orderBy: [{ billingPeriod: 'desc' }],
    });

    // 获取供应商名称
    const providerIds = costs.map((c) => c.providerId);
    const providers = await this.prisma.translationProvider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true },
    });

    const providerMap = new Map(providers.map((p) => [p.id, p.name]));

    return costs.map((cost) => ({
      providerId: cost.providerId,
      providerName: providerMap.get(cost.providerId) || 'Unknown',
      billingPeriod: cost.billingPeriod || 'unknown',
      totalCharacters: cost._sum.characterCount || 0,
      totalCost: cost._sum.estimatedCost || 0,
      jobCount: cost._count.id,
    }));
  }
}
