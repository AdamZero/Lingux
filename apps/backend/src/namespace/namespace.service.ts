import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { PrismaService } from '../prisma.service';
import { MachineTranslationService } from '../translation/services/machine-translation.service';
import { TranslationJobManager } from '../translation/translation-job-manager';
import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx';

@Injectable()
export class NamespaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machineTranslationService: MachineTranslationService,
  ) {}

  async create(projectId: string, createNamespaceDto: CreateNamespaceDto) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        baseLocale: true,
        projectLocales: {
          where: {
            enabled: true,
          },
          select: {
            locale: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const baseLocale = project.baseLocale || 'zh-CN';
    const hasBaseLocale = project.projectLocales.some(
      (pl) => pl.locale.code === baseLocale,
    );

    if (!hasBaseLocale) {
      const locale = await this.prisma.locale.findUnique({
        where: { code: baseLocale },
        select: { id: true },
      });
      if (!locale) {
        throw new BadRequestException(
          `Default locale ${baseLocale} not found. Please seed locales first.`,
        );
      }

      await this.prisma.projectLocale.upsert({
        where: { projectId_localeId: { projectId, localeId: locale.id } },
        create: {
          projectId,
          localeId: locale.id,
          enabled: true,
          disabledAt: null,
        },
        update: { enabled: true, disabledAt: null },
      });
    }

    return this.prisma.namespace.create({
      data: {
        name: createNamespaceDto.name,
        description: createNamespaceDto.description,
        projectId: projectId,
      },
    });
  }

  async findAll(projectId: string) {
    return this.prisma.namespace.findMany({
      where: { projectId },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findOne(projectId: string, id: string) {
    const namespace = await this.prisma.namespace.findFirst({
      where: { id, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${id} not found in project ${projectId}`,
      );
    }
    return namespace;
  }

  async update(
    projectId: string,
    id: string,
    updateNamespaceDto: UpdateNamespaceDto,
  ) {
    const existing = await this.prisma.namespace.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Namespace with ID ${id} not found in project ${projectId}`,
      );
    }
    return this.prisma.namespace.update({
      where: { id },
      data: updateNamespaceDto,
    });
  }

  async remove(projectId: string, id: string) {
    const existing = await this.prisma.namespace.findFirst({
      where: { id, projectId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(
        `Namespace with ID ${id} not found in project ${projectId}`,
      );
    }
    await this.prisma.namespace.delete({
      where: { id },
    });
    return { success: true };
  }

  async exportMultiple(
    projectId: string,
    namespaceIds: string[],
    format: 'json' | 'yaml' | 'xlsx',
    mode: 'published' | 'all' = 'published',
  ): Promise<string | Buffer> {
    let exportData: Record<string, Record<string, Record<string, string>>>;

    if (mode === 'published') {
      // 从 ReleaseArtifact 导出已发布数据
      exportData = await this.exportPublishedData(projectId, namespaceIds);
    } else {
      // 从 Translation 表导出所有数据
      exportData = await this.exportAllData(projectId, namespaceIds);
    }

    if (format === 'yaml') {
      return yaml.dump(exportData);
    } else if (format === 'xlsx') {
      return this.exportToExcel(exportData);
    } else {
      return JSON.stringify(exportData, null, 2);
    }
  }

  private async exportAllData(
    projectId: string,
    namespaceIds: string[],
  ): Promise<Record<string, Record<string, Record<string, string>>>> {
    // Verify all namespaces belong to this project
    const namespaces = await this.prisma.namespace.findMany({
      where: {
        id: { in: namespaceIds },
        projectId,
      },
      include: {
        keys: {
          include: {
            translations: {
              include: {
                locale: true,
              },
            },
          },
        },
      },
    });

    if (namespaces.length !== namespaceIds.length) {
      const foundIds = namespaces.map((n) => n.id);
      const missingIds = namespaceIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Namespaces not found: ${missingIds.join(', ')}`,
      );
    }

    // Build export data: { namespaceName: { keyName: { localeCode: content } } }
    const exportData: Record<
      string,
      Record<string, Record<string, string>>
    > = {};

    for (const namespace of namespaces) {
      const namespaceData: Record<string, Record<string, string>> = {};

      for (const key of namespace.keys) {
        const translations: Record<string, string> = {};
        for (const translation of key.translations) {
          translations[translation.locale.code] = translation.content;
        }
        namespaceData[key.name] = translations;
      }

      exportData[namespace.name] = namespaceData;
    }

    return exportData;
  }

  private async exportPublishedData(
    projectId: string,
    namespaceIds: string[],
  ): Promise<Record<string, Record<string, Record<string, string>>>> {
    // 获取项目的当前发布
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { currentReleaseId: true },
    });

    if (!project?.currentReleaseId) {
      throw new NotFoundException(
        'No published release found for this project',
      );
    }

    // 获取命名空间名称
    const namespaces = await this.prisma.namespace.findMany({
      where: {
        id: { in: namespaceIds },
        projectId,
      },
      select: { id: true, name: true },
    });

    if (namespaces.length !== namespaceIds.length) {
      const foundIds = namespaces.map((n) => n.id);
      const missingIds = namespaceIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundException(
        `Namespaces not found: ${missingIds.join(', ')}`,
      );
    }

    const namespaceNames = namespaces.map((n) => n.name);

    // 获取 ReleaseArtifact
    const artifacts = await this.prisma.releaseArtifact.findMany({
      where: { releaseId: project.currentReleaseId },
    });

    // Build export data
    const exportData: Record<
      string,
      Record<string, Record<string, string>>
    > = {};

    for (const artifact of artifacts) {
      const data = artifact.data as Record<string, Record<string, string>>;

      // 只包含指定的命名空间
      for (const namespaceName of namespaceNames) {
        if (data[namespaceName]) {
          if (!exportData[namespaceName]) {
            exportData[namespaceName] = {};
          }
          // 合并该命名空间下的所有 key
          for (const [keyName, content] of Object.entries(
            data[namespaceName],
          )) {
            if (!exportData[namespaceName][keyName]) {
              exportData[namespaceName][keyName] = {};
            }
            exportData[namespaceName][keyName][artifact.localeCode] = content;
          }
        }
      }
    }

    return exportData;
  }

  private exportToExcel(
    exportData: Record<string, Record<string, Record<string, string>>>,
  ): Buffer {
    // Create workbook
    const wb = XLSX.utils.book_new();

    // Each namespace becomes a sheet
    for (const [namespaceName, namespaceData] of Object.entries(exportData)) {
      // Collect all locale codes for this namespace
      const localeSet = new Set<string>();
      for (const translations of Object.values(namespaceData)) {
        Object.keys(translations).forEach((code) => localeSet.add(code));
      }
      const locales = Array.from(localeSet).sort();

      // Build rows for this namespace
      const rows: Array<Record<string, string>> = [];
      for (const [keyName, translations] of Object.entries(namespaceData)) {
        const row: Record<string, string> = {
          Key: keyName,
        };
        for (const locale of locales) {
          row[locale] = translations[locale] || '';
        }
        rows.push(row);
      }

      // Create worksheet for this namespace
      const ws = XLSX.utils.json_to_sheet(rows);

      // Truncate sheet name to 31 characters (Excel limit)
      const sheetName = namespaceName.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // Generate buffer using array type then convert to Buffer
    const arrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    return Buffer.from(arrayBuffer);
  }

  /**
   * 一键翻译 - 创建异步翻译任务
   * 如果传 namespaceIds，则翻译这些命名空间；否则翻译整个项目
   */
  async translate(
    projectId: string,
    namespaceIds?: string[],
    userId?: string,
  ): Promise<{
    jobId: string;
    status: string;
    totalKeys: number;
    type: 'namespace' | 'project';
    namespaceCount: number;
  }> {
    // 确定翻译范围
    const isProjectLevel = !namespaceIds || namespaceIds.length === 0;
    const concurrencyKey = isProjectLevel ? projectId : namespaceIds!.join(',');

    // 并发控制：检查是否已有进行中的翻译任务
    if (TranslationJobManager.isProcessing(concurrencyKey)) {
      const existingJobId = TranslationJobManager.getJobId(concurrencyKey);
      throw new BadRequestException(
        `该${isProjectLevel ? '项目' : '命名空间'}正在翻译中，任务ID: ${existingJobId}`,
      );
    }

    // 获取项目信息
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { baseLocale: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // 获取源语言（项目基准语言）
    const sourceLocaleCode = project.baseLocale || 'zh-CN';

    // 获取项目的所有启用语言
    const projectLocales = await this.prisma.projectLocale.findMany({
      where: { projectId, enabled: true },
      include: { locale: true },
    });

    // 目标语言 = 除源语言外的所有启用语言
    const targetLocales = projectLocales
      .map((pl) => pl.locale)
      .filter((l) => l.code !== sourceLocaleCode);

    if (targetLocales.length === 0) {
      throw new BadRequestException('No target locales available');
    }

    // 构建查询条件
    const keyWhereClause: any = {
      namespace: {
        projectId,
      },
    };
    if (namespaceIds && namespaceIds.length > 0) {
      keyWhereClause.namespace.id = { in: namespaceIds };
    }

    // 获取词条及其翻译
    const keys = await this.prisma.key.findMany({
      where: keyWhereClause,
      include: {
        translations: {
          include: { locale: true },
        },
        namespace: true,
      },
    });

    if (keys.length === 0) {
      throw new BadRequestException(
        isProjectLevel ? '该项目下没有词条' : '指定的命名空间下没有词条',
      );
    }

    // 统计实际涉及的命名空间数量
    const actualNamespaceIds = new Set(keys.map((k) => k.namespace.id));

    // 获取默认供应商
    const defaultProvider =
      await this.machineTranslationService.getDefaultProvider();
    if (!defaultProvider) {
      throw new BadRequestException(
        'No default translation provider configured',
      );
    }

    // 收集需要翻译的词条
    const items: Array<{
      keyId: string;
      keyName: string;
      namespaceName?: string;
      sourceContent: string;
    }> = [];

    for (const key of keys) {
      // 找到源语言翻译
      const sourceTranslation = key.translations.find(
        (t) => t.locale.code === sourceLocaleCode,
      );

      if (!sourceTranslation) {
        continue;
      }

      // 检查每个目标语言是否已有翻译
      for (const targetLocale of targetLocales) {
        const existingTranslation = key.translations.find(
          (t) => t.locale.code === targetLocale.code,
        );

        // 如果已有翻译且不为空，跳过
        if (existingTranslation?.content?.trim()) {
          continue;
        }

        // 需要翻译
        items.push({
          keyId: key.id,
          keyName: key.name,
          namespaceName: key.namespace.name,
          sourceContent: sourceTranslation.content,
        });
      }
    }

    if (items.length === 0) {
      throw new BadRequestException('没有需要翻译的内容');
    }

    // 创建翻译任务
    const jobId = await this.machineTranslationService.createTranslationJob(
      defaultProvider.id,
      sourceLocaleCode,
      targetLocales.map((l) => l.code),
      items,
      projectId,
      userId,
      concurrencyKey, // 传递用于并发控制
    );

    // 记录到并发控制 Map
    TranslationJobManager.startProcessing(concurrencyKey, jobId);

    return {
      jobId,
      status: 'PENDING',
      totalKeys: items.length,
      type: isProjectLevel ? 'project' : 'namespace',
      namespaceCount: actualNamespaceIds.size,
    };
  }
}
