import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { PrismaService } from '../prisma.service';
import { MachineTranslationService } from '../translation/services/machine-translation.service';
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
   * 一键翻译命名空间 - 自动翻译所有缺失的翻译
   */
  async translateNamespace(
    projectId: string,
    namespaceId: string,
  ): Promise<{
    totalKeys: number;
    translatedKeys: number;
    failedKeys: number;
    details: Array<{
      keyId: string;
      keyName: string;
      localeCode: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    // 验证命名空间存在
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
      include: {
        project: {
          select: { baseLocale: true },
        },
      },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${namespaceId} not found in project ${projectId}`,
      );
    }

    // 获取源语言（项目基准语言）
    const sourceLocaleCode = namespace.project.baseLocale || 'zh-CN';

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

    // 获取命名空间下的所有词条及其翻译
    const keys = await this.prisma.key.findMany({
      where: { namespaceId },
      include: {
        translations: {
          include: { locale: true },
        },
      },
    });

    if (keys.length === 0) {
      return { totalKeys: 0, translatedKeys: 0, failedKeys: 0, details: [] };
    }

    // 获取默认供应商
    const defaultProvider =
      await this.machineTranslationService.getDefaultProvider();
    if (!defaultProvider) {
      throw new BadRequestException(
        'No default translation provider configured',
      );
    }

    const details: Array<{
      keyId: string;
      keyName: string;
      localeCode: string;
      success: boolean;
      error?: string;
    }> = [];
    let translatedCount = 0;
    let failedCount = 0;

    for (const key of keys) {
      // 找到源语言翻译
      const sourceTranslation = key.translations.find(
        (t) => t.locale.code === sourceLocaleCode,
      );

      if (!sourceTranslation) {
        // 源语言没有翻译，跳过
        for (const targetLocale of targetLocales) {
          details.push({
            keyId: key.id,
            keyName: key.name,
            localeCode: targetLocale.code,
            success: false,
            error: `No source translation in ${sourceLocaleCode}`,
          });
          failedCount++;
        }
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
        try {
          const result = await this.machineTranslationService.translate(
            defaultProvider.id,
            sourceTranslation.content,
            {
              sourceLanguage: sourceLocaleCode,
              targetLanguage: targetLocale.code,
            },
          );

          // 保存翻译到数据库
          await this.prisma.translation.upsert({
            where: {
              keyId_localeId: {
                keyId: key.id,
                localeId: targetLocale.id,
              },
            },
            create: {
              keyId: key.id,
              localeId: targetLocale.id,
              content: result.translatedText,
              status: 'PENDING',
              isLlmTranslated: true,
            },
            update: {
              content: result.translatedText,
              isLlmTranslated: true,
            },
          });

          details.push({
            keyId: key.id,
            keyName: key.name,
            localeCode: targetLocale.code,
            success: true,
          });
          translatedCount++;
        } catch (error) {
          details.push({
            keyId: key.id,
            keyName: key.name,
            localeCode: targetLocale.code,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          failedCount++;
        }
      }
    }

    return {
      totalKeys: keys.length,
      translatedKeys: translatedCount,
      failedKeys: failedCount,
      details,
    };
  }
}
