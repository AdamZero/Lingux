import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { Prisma, TranslationStatus } from '@prisma/client';
import { EncryptionService } from './encryption.service';
import { WinstonLoggerService } from '../../common/logger/logger.service';
import type { Response } from 'express';
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
  TranslationProviderHealthStatus,
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
  // SSE 连接管理：jobId -> Response[]
  private readonly sseConnections = new Map<string, Set<Response>>();

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
   * 注册 SSE 连接
   */
  registerSSEConnection(jobId: string, res: Response): void {
    if (!this.sseConnections.has(jobId)) {
      this.sseConnections.set(jobId, new Set());
    }
    this.sseConnections.get(jobId)!.add(res);
    this.logger.debug(`SSE connection registered for job ${jobId}`);
  }

  /**
   * 注销 SSE 连接
   */
  unregisterSSEConnection(jobId: string, res: Response): void {
    const connections = this.sseConnections.get(jobId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.sseConnections.delete(jobId);
      }
      this.logger.debug(`SSE connection unregistered for job ${jobId}`);
    }
  }

  /**
   * 推送进度到所有连接的客户端
   */
  private pushProgress(jobId: string, data: unknown): void {
    const connections = this.sseConnections.get(jobId);
    if (!connections || connections.size === 0) {
      return;
    }

    const message = `data: ${JSON.stringify(data)}\n\n`;
    connections.forEach((res) => {
      try {
        res.write(message);
      } catch (error) {
        // 连接可能已断开，忽略错误
        this.logger.debug(`Failed to push progress to client for job ${jobId}`);
      }
    });
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

    // 解密 API 密钥并初始化适配器
    let apiKey: string;
    try {
      apiKey = this.encryptionService.decrypt(provider.apiKeyEncrypted);
    } catch (error) {
      this.logger.warn(
        `Failed to decrypt API key for provider ${provider.name}, using raw value: ${error.message}`,
      );
      // 如果解密失败，使用原始值（用于测试）
      apiKey = provider.apiKeyEncrypted;
    }
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
    sourceLanguage: string,
    targetLanguages: string[],
    items: {
      keyId: string;
      keyName: string;
      namespaceName?: string;
      sourceContent: string;
    }[],
    projectId?: string,
    userId?: string,
    namespaceId?: string, // 用于并发控制
  ): Promise<string> {
    const { provider } = await this.getAdapter(providerId);

    const totalCharacters = items.reduce(
      (sum, item) => sum + item.sourceContent.length,
      0,
    );

    // 并发控制：检查是否已有成功的翻译
    const filteredItems: typeof items = [];
    for (const item of items) {
      const existing =
        await this.prisma.translationJobItemTranslation.findFirst({
          where: {
            item: {
              keyId: item.keyId,
            },
            targetLanguage: { in: targetLanguages },
            status: 'SUCCESS',
          },
        });

      if (!existing) {
        filteredItems.push(item);
      }
    }

    if (filteredItems.length === 0) {
      throw new BadRequestException('没有可翻译的内容');
    }

    const job = await this.prisma.translationJob.create({
      data: {
        providerId: provider.id,
        projectId,
        userId,
        status: TranslationJobStatus.PENDING,
        sourceLanguage,
        targetLanguages,
        totalKeys: filteredItems.length,
        translatedKeys: 0,
        characterCount: totalCharacters,
      },
    });

    // 创建翻译任务明细
    await this.prisma.translationJobItem.createMany({
      data: filteredItems.map((item) => ({
        jobId: job.id,
        keyId: item.keyId,
        keyName: item.keyName,
        namespaceName: item.namespaceName,
        sourceContent: item.sourceContent,
      })),
    });

    // 异步执行翻译
    this.executeTranslationJob(job.id, namespaceId).catch((error) => {
      this.logger.error(`Translation job ${job.id} failed:`, error);
    });

    return job.id;
  }

  /**
   * 执行翻译任务
   */
  private async executeTranslationJob(
    jobId: string,
    namespaceId?: string,
  ): Promise<void> {
    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
      include: { items: true },
    });

    if (!job) {
      throw new NotFoundException(`Translation job ${jobId} not found`);
    }

    // 更新状态为处理中
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: TranslationJobStatus.PROCESSING },
    });

    // 推送开始事件
    this.pushProgress(jobId, {
      type: 'started',
      totalKeys: job.totalKeys,
      targetLanguages: job.targetLanguages,
    });

    try {
      let totalSuccess = 0;
      const totalFailed = 0;
      let processedCount = 0;
      const totalItems = job.items.length * job.targetLanguages.length;

      // 对每个目标语言执行翻译
      for (const targetLanguage of job.targetLanguages) {
        const texts = job.items.map((item) => item.sourceContent);

        const result = await this.translateBatch(job.providerId, texts, {
          sourceLanguage: job.sourceLanguage,
          targetLanguage,
        });

        // 为每个 item 创建翻译结果
        for (let i = 0; i < job.items.length; i++) {
          const item = job.items[i];
          const translation = result.translations[i];

          await this.prisma.translationJobItemTranslation.upsert({
            where: {
              itemId_targetLanguage: {
                itemId: item.id,
                targetLanguage,
              },
            },
            update: {
              translatedContent: translation.translatedText,
              status: 'SUCCESS',
              characterCount: translation.translatedText?.length || 0,
            },
            create: {
              itemId: item.id,
              targetLanguage,
              translatedContent: translation.translatedText,
              status: 'SUCCESS',
              characterCount: translation.translatedText?.length || 0,
            },
          });

          totalSuccess++;
          processedCount++;

          // 每处理 10 个词条推送一次进度
          if (processedCount % 10 === 0 || processedCount === totalItems) {
            this.pushProgress(jobId, {
              type: 'progress',
              processed: processedCount,
              total: totalItems,
              percentage: Math.round((processedCount / totalItems) * 100),
            });
          }
        }

        // 记录翻译成本
        await this.recordTranslationCost(
          job.providerId,
          result.totalCharacters,
        );
      }

      // 更新任务状态
      const hasFailures = totalFailed > 0;
      const allFailures = totalSuccess === 0 && totalFailed > 0;
      const finalStatus = allFailures
        ? TranslationJobStatus.FAILED
        : hasFailures
          ? TranslationJobStatus.PARTIAL
          : TranslationJobStatus.COMPLETED;

      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          translatedKeys: totalSuccess,
          completedAt: new Date(),
        },
      });

      // 如果是自动翻译任务（有 namespaceId），将翻译结果写入 Translation 表
      if (namespaceId && finalStatus === TranslationJobStatus.COMPLETED) {
        this.logger.log(
          `[AutoTranslation] Writing translation results to Translation table...`,
        );

        // 获取所有翻译成功的 item
        const jobWithItems = await this.prisma.translationJob.findUnique({
          where: { id: jobId },
          include: {
            items: {
              include: {
                translations: {
                  where: { status: 'SUCCESS' },
                },
              },
            },
          },
        });

        if (!jobWithItems) {
          this.logger.warn(`[AutoTranslation] Job not found: ${jobId}`);
        } else {
          // 为每个 item 创建或更新 Translation 记录
          for (const item of jobWithItems.items) {
            for (const itemTranslation of item.translations) {
              if (!itemTranslation.translatedContent) continue;

              // 获取目标语言的 localeId
              const targetLocale = await this.prisma.locale.findUnique({
                where: { code: itemTranslation.targetLanguage },
              });

              if (!targetLocale) {
                this.logger.warn(
                  `Target locale not found: ${itemTranslation.targetLanguage}`,
                );
                continue;
              }

              // 创建或更新 Translation
              await this.prisma.translation.upsert({
                where: {
                  keyId_localeId: {
                    keyId: item.keyId,
                    localeId: targetLocale.id,
                  },
                },
                update: {
                  content: itemTranslation.translatedContent,
                  status: TranslationStatus.PENDING,
                  isLlmTranslated: true,
                },
                create: {
                  keyId: item.keyId,
                  localeId: targetLocale.id,
                  content: itemTranslation.translatedContent,
                  status: TranslationStatus.PENDING,
                  isLlmTranslated: true,
                },
              });

              this.logger.log(
                `[AutoTranslation] Translation saved for key ${item.keyName} (${itemTranslation.targetLanguage})`,
              );
            }
          }

          this.logger.log(
            `[AutoTranslation] Translation results written successfully`,
          );
        }
      }

      // 推送完成事件
      this.pushProgress(jobId, {
        type: 'completed',
        status: finalStatus,
        totalKeys: job.totalKeys,
        translatedKeys: totalSuccess,
        failedKeys: totalFailed,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 更新任务为失败
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: TranslationJobStatus.FAILED,
          error: errorMessage,
          completedAt: new Date(),
        },
      });

      // 推送错误事件
      this.pushProgress(jobId, {
        type: 'error',
        message: errorMessage,
      });
    } finally {
      // 清理并发控制
      if (namespaceId) {
        const { TranslationJobManager } =
          await import('../translation-job-manager.js');
        TranslationJobManager.finishProcessing(namespaceId);
      }
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

    const [jobs, total] = await Promise.all([
      this.prisma.translationJob.findMany({
        where,
        include: {
          provider: { select: { name: true, type: true } },
          user: { select: { name: true, avatar: true } },
          project: { select: { name: true } },
          _count: {
            select: {
              items: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.translationJob.count({ where }),
    ]);

    const formattedItems = jobs.map((job) => ({
      ...job,
      providerName: job.provider.name,
      providerType: job.provider.type,
      userName: job.user?.name || null,
      userAvatar: job.user?.avatar || null,
      projectName: job.project?.name || null,
      totalKeys: job._count.items,
      successCount: 0,
      failedCount: 0,
    }));

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
   * 获取月度统计
   */
  async getMonthlyStats(year?: number, month?: number) {
    const now = new Date();
    // 确保 year 和 month 是数字类型（处理 URL query 参数可能是字符串的情况）
    const targetYear = year ? Number(year) : now.getFullYear();
    const targetMonth = month ? Number(month) : now.getMonth() + 1;

    // 验证日期是否有效
    if (
      isNaN(targetYear) ||
      isNaN(targetMonth) ||
      targetMonth < 1 ||
      targetMonth > 12
    ) {
      throw new Error('Invalid year or month parameter');
    }

    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0);

    const stats = await this.prisma.translationJob.groupBy({
      by: ['providerId'],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        characterCount: true,
      },
      _count: true,
    });

    const providerIds = stats.map((s) => s.providerId);
    const providers = await this.prisma.translationProvider.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true, type: true },
    });

    const totalCharacters = stats.reduce(
      (sum, s) => sum + (s._sum.characterCount || 0),
      0,
    );
    const totalJobs = stats.reduce((sum, s) => sum + s._count, 0);

    const providerStats = stats.map((stat) => {
      const provider = providers.find((p) => p.id === stat.providerId);
      const characterCount = stat._sum.characterCount || 0;
      return {
        providerId: stat.providerId,
        providerName: provider?.name || 'Unknown',
        providerType: provider?.type || 'Unknown',
        characterCount,
        jobCount: stat._count,
        percentage:
          totalCharacters > 0
            ? Math.round((characterCount / totalCharacters) * 100 * 100) / 100
            : 0,
      };
    });

    return {
      totalCharacters,
      totalJobs,
      providers: providerStats,
    };
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
   * 只在 healthStatus 发生变化时才更新数据库
   */
  async checkProviderHealth(providerId: string): Promise<{
    isHealthy: boolean;
    status: TranslationProviderHealthStatus;
    checkedAt: Date;
    error?: string;
  }> {
    const provider = await this.prisma.translationProvider.findUnique({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(
        `Translation provider ${providerId} not found`,
      );
    }

    let isHealthy = false;
    let healthStatus: TranslationProviderHealthStatus;
    let errorMessage: string | null = null;

    try {
      const { adapter } = await this.getAdapter(providerId);
      isHealthy = await adapter.healthCheck();

      if (isHealthy) {
        healthStatus = TranslationProviderHealthStatus.HEALTHY;
      } else {
        healthStatus = TranslationProviderHealthStatus.UNHEALTHY;
        errorMessage = 'Health check returned false';
      }
    } catch (error) {
      isHealthy = false;
      healthStatus = TranslationProviderHealthStatus.ERROR;
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    const now = new Date();

    // 只有状态发生变化时才更新数据库
    if (provider.healthStatus !== healthStatus) {
      await this.prisma.translationProvider.update({
        where: { id: providerId },
        data: {
          healthStatus,
          healthCheckedAt: now,
          healthError: errorMessage,
        },
      });
      this.logger.log(
        `Provider ${provider.name} health status changed: ${provider.healthStatus} -> ${healthStatus}`,
      );
    }

    return {
      isHealthy,
      status: healthStatus,
      checkedAt: provider.healthCheckedAt || now,
      error: errorMessage || undefined,
    };
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
