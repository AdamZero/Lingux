import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TranslationStatus, KeyType } from '@prisma/client';
import { CreateKeyDto } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';
import { PrismaService } from '../prisma.service';
import { keyWithTranslationsSelect } from '../prisma/helpers/select.helpers';
import * as yaml from 'js-yaml';
import { MachineTranslationService } from '../translation/services/machine-translation.service';

@Injectable()
export class KeyService {
  private readonly logger = new Logger(KeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly machineTranslationService: MachineTranslationService,
  ) {}

  async create(
    projectId: string,
    namespaceId: string,
    createKeyDto: CreateKeyDto,
    userId: string,
  ) {
    // Verify project and namespace relationship
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${namespaceId} not found in project ${projectId}`,
      );
    }

    const existingKey = await this.prisma.key.findFirst({
      where: {
        namespaceId,
        name: createKeyDto.name,
      },
      include: {
        namespace: {
          select: {
            id: true,
            name: true,
          },
        },
        translations: {
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            locale: true,
          },
        },
      },
    });
    if (existingKey) {
      throw new ConflictException({
        message: `Key ${createKeyDto.name} already exists`,
        existingKey,
      });
    }

    const key = await this.prisma.key.create({
      data: {
        ...createKeyDto,
        namespaceId: namespaceId,
      },
    });

    // 检查自动翻译配置
    await this.triggerAutoTranslation(
      projectId,
      namespaceId,
      namespace.name,
      [
        {
          keyId: key.id,
          keyName: key.name,
          sourceContent: createKeyDto.description || '',
        },
      ],
      userId,
    );

    return key;
  }

  async createBatch(
    projectId: string,
    namespaceId: string,
    keys: Array<{
      name: string;
      description?: string;
      type?: KeyType;
      baseContent?: string;
    }>,
    userId?: string,
  ) {
    // 校验批量操作数量限制
    const MAX_BATCH_SIZE = 1000;
    if (keys.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`Maximum ${MAX_BATCH_SIZE} keys allowed per batch`);
    }

    // 校验必填字段
    const emptyName = keys.find((k) => !k.name?.trim());
    if (emptyName) {
      throw new BadRequestException('词条名称不能为空');
    }

    const emptyBaseContent = keys.find((k) => !k.baseContent?.trim());
    if (emptyBaseContent) {
      throw new BadRequestException('默认语言内容不能为空');
    }

    // Verify project and namespace relationship
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${namespaceId} not found in project ${projectId}`,
      );
    }

    // 检查重复的 key 名称（使用单次查询避免 N+1 问题）
    const keyNames = keys.map((k) => k.name);
    const existingKeys = await this.prisma.key.findMany({
      where: {
        namespaceId,
        name: { in: keyNames },
      },
      select: { name: true },
    });

    const duplicates = existingKeys.map((k) => k.name);
    if (duplicates.length > 0) {
      throw new ConflictException({
        message: `Keys already exist: ${duplicates.join(', ')}`,
        duplicates,
      });
    }

    // 获取项目基础语言
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { baseLocale: true },
    });

    // 批量创建 Keys 和基础语言的 Translations（在一个事务中）
    const createdKeys = await this.prisma.$transaction(
      async (tx) => {
        // 创建所有 Keys
        const newKeys = await Promise.all(
          keys.map((keyDto) =>
            tx.key.create({
              data: {
                name: keyDto.name,
                description: keyDto.description,
                type: keyDto.type || KeyType.TEXT,
                namespaceId,
              },
            }),
          ),
        );

        // 为每个 Key 创建基础语言的 Translation
        if (project?.baseLocale) {
          const baseLocale = await tx.locale.findUnique({
            where: { code: project.baseLocale },
          });

          if (baseLocale) {
            for (let index = 0; index < newKeys.length; index++) {
              const key = newKeys[index];
              const baseContent = keys[index].baseContent?.trim();

              if (baseContent) {
                await tx.translation.upsert({
                  where: {
                    keyId_localeId: {
                      keyId: key.id,
                      localeId: baseLocale.id,
                    },
                  },
                  update: {
                    content: baseContent,
                    status: TranslationStatus.APPROVED,
                  },
                  create: {
                    keyId: key.id,
                    localeId: baseLocale.id,
                    content: baseContent,
                    status: TranslationStatus.APPROVED,
                  },
                });
              }
            }
          }
        }

        return newKeys;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );

    // 触发自动翻译（使用 baseContent）- 异步执行，不阻塞主流程
    this.triggerAutoTranslation(
      projectId,
      namespaceId,
      namespace.name,
      createdKeys.map((key, index) => ({
        keyId: key.id,
        keyName: key.name,
        sourceContent: keys[index].baseContent || key.description || '',
      })),
      userId,
    ).catch((error) => {
      this.logger.error(
        '[CreateBatch] Auto translation failed (non-blocking):',
        error,
      );
    });

    return createdKeys;
  }

  private async triggerAutoTranslation(
    projectId: string,
    namespaceId: string,
    namespaceName: string,
    items: { keyId: string; keyName: string; sourceContent: string }[],
    userId?: string,
  ): Promise<void> {
    if (items.length === 0) return;

    try {
      this.logger.log(
        `[AutoTranslation] Triggering for project: ${projectId}, items: ${items.length}`,
      );

      // 获取项目自动翻译配置
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: {
          autoTranslateEnabled: true,
          autoTranslateProviderId: true,
          baseLocale: true,
        },
      });

      this.logger.debug(
        `[AutoTranslation] Project config: ${JSON.stringify(project)}`,
      );

      if (!project?.autoTranslateEnabled) {
        this.logger.log(
          `[AutoTranslation] Auto translation not enabled for project: ${projectId}`,
        );
        return;
      }

      // 获取翻译供应商 ID（如果项目未指定，则使用默认的供应商）
      let providerId = project.autoTranslateProviderId;
      if (!providerId) {
        const defaultProvider = await this.prisma.translationProvider.findFirst(
          {
            where: { isEnabled: true, isDefault: true },
          },
        );
        if (!defaultProvider) {
          this.logger.log(
            '[AutoTranslation] No default translation provider found',
          );
          return;
        }
        providerId = defaultProvider.id;
        this.logger.log(
          `[AutoTranslation] Using default provider: ${providerId}`,
        );
      }

      // 获取项目启用的目标语言
      const projectLocales = await this.prisma.projectLocale.findMany({
        where: { projectId, enabled: true },
        include: { locale: true },
      });

      const targetLanguages = projectLocales
        .filter((pl) => pl.locale.code !== project.baseLocale)
        .map((pl) => pl.locale.code);

      this.logger.log(
        `[AutoTranslation] Target languages: ${targetLanguages.join(', ')}`,
      );

      if (targetLanguages.length === 0) {
        this.logger.log('[AutoTranslation] No target languages configured');
        return;
      }

      // 创建翻译任务
      this.logger.log(
        `[AutoTranslation] Creating translation job with provider: ${providerId}`,
      );
      await this.machineTranslationService.createTranslationJob(
        providerId,
        project.baseLocale,
        targetLanguages,
        items.map((item) => ({
          keyId: item.keyId,
          keyName: item.keyName,
          namespaceName,
          sourceContent: item.sourceContent,
        })),
        projectId,
        userId,
        namespaceId,
      );

      this.logger.log('[AutoTranslation] Translation job created successfully');
    } catch (error) {
      this.logger.error('[AutoTranslation] Error:', error);
      this.logger.log(
        '[AutoTranslation] Continuing without auto-translation...',
      );
      // 不抛出错误，让词条创建成功
    }
  }

  async findAll(projectId: string, namespaceId: string) {
    return this.prisma.key.findMany({
      where: {
        namespaceId: namespaceId,
        namespace: { projectId },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        ...keyWithTranslationsSelect,
        translations: {
          ...keyWithTranslationsSelect.translations,
          orderBy: {
            updatedAt: 'desc',
          },
        },
      },
    });
  }

  async lookupByName(projectId: string, name: string, excludeKeyId?: string) {
    const normalized = name?.trim();
    if (!normalized) {
      throw new BadRequestException('Query param "name" is required');
    }

    return this.prisma.key.findMany({
      where: {
        name: normalized,
        namespace: { projectId },
        ...(excludeKeyId ? { NOT: { id: excludeKeyId } } : {}),
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        namespace: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            translations: true,
          },
        },
      },
    });
  }

  async copyTranslations(
    projectId: string,
    namespaceId: string,
    targetKeyId: string,
    sourceKeyId: string,
    mode: 'fillMissing' | 'overwrite' = 'fillMissing',
  ) {
    if (!sourceKeyId?.trim()) {
      throw new BadRequestException('"sourceKeyId" is required');
    }
    if (mode !== 'fillMissing' && mode !== 'overwrite') {
      throw new BadRequestException('"mode" must be fillMissing or overwrite');
    }

    const targetKey = await this.prisma.key.findFirst({
      where: {
        id: targetKeyId,
        namespaceId,
        namespace: { projectId },
      },
    });
    if (!targetKey) {
      throw new NotFoundException(`Key with ID ${targetKeyId} not found`);
    }

    const sourceKey = await this.prisma.key.findFirst({
      where: {
        id: sourceKeyId,
        namespace: { projectId },
      },
    });
    if (!sourceKey) {
      throw new NotFoundException(`Key with ID ${sourceKeyId} not found`);
    }

    const sourceTranslations = await this.prisma.translation.findMany({
      where: {
        keyId: sourceKeyId,
      },
      select: {
        localeId: true,
        content: true,
      },
    });

    if (sourceTranslations.length === 0) {
      return { copied: 0, skipped: 0, mode };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      if (mode === 'overwrite') {
        await tx.translation.deleteMany({
          where: {
            keyId: targetKeyId,
            localeId: { in: sourceTranslations.map((t) => t.localeId) },
          },
        });
      }

      const created = await tx.translation.createMany({
        data: sourceTranslations.map((t) => ({
          keyId: targetKeyId,
          localeId: t.localeId,
          content: t.content,
          status: TranslationStatus.PENDING,
          isLlmTranslated: false,
          reviewComment: null,
        })),
        skipDuplicates: mode === 'fillMissing',
      });

      return created.count;
    });

    return {
      copied: result,
      skipped: mode === 'fillMissing' ? sourceTranslations.length - result : 0,
      mode,
    };
  }

  async findOne(projectId: string, namespaceId: string, id: string) {
    const key = await this.prisma.key.findFirst({
      where: {
        id,
        namespaceId,
        namespace: { projectId },
      },
      include: {
        translations: {
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            locale: true,
          },
        },
      },
    });
    if (!key) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }
    return key;
  }

  async update(
    projectId: string,
    namespaceId: string,
    id: string,
    updateKeyDto: UpdateKeyDto,
  ) {
    const existing = await this.prisma.key.findFirst({
      where: {
        id,
        namespaceId,
        namespace: { projectId },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    return this.prisma.key.update({
      where: { id },
      data: updateKeyDto,
    });
  }

  async remove(projectId: string, namespaceId: string, id: string) {
    const existing = await this.prisma.key.findFirst({
      where: {
        id,
        namespaceId,
        namespace: { projectId },
      },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.translation.deleteMany({
        where: { keyId: id },
      });
      await tx.key.delete({
        where: { id },
      });
    });

    return { success: true };
  }

  async exportTranslations(
    projectId: string,
    namespaceId: string,
    format: 'json' | 'yaml' = 'json',
  ) {
    // Verify project and namespace relationship
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${namespaceId} not found in project ${projectId}`,
      );
    }

    // Get all keys with translations
    const keys = await this.prisma.key.findMany({
      where: {
        namespaceId,
        namespace: { projectId },
      },
      include: {
        translations: {
          include: {
            locale: true,
          },
        },
      },
    });

    // Convert to export format
    const exportData: Record<string, Record<string, string>> = {};
    keys.forEach((key) => {
      const translations: Record<string, string> = {};
      key.translations.forEach((translation) => {
        translations[translation.locale.code] = translation.content;
      });
      exportData[key.name] = translations;
    });

    // Format based on requested format
    if (format === 'yaml') {
      return yaml.dump(exportData);
    } else {
      return JSON.stringify(exportData, null, 2);
    }
  }

  async importTranslations(
    projectId: string,
    namespaceId: string,
    fileContent: string,
    format: 'json' | 'yaml' = 'json',
    mode: 'fillMissing' | 'overwrite' = 'fillMissing',
  ) {
    // 校验导入数量限制
    const MAX_IMPORT_KEYS = 1000;

    // Verify project and namespace relationship
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(
        `Namespace with ID ${namespaceId} not found in project ${projectId}`,
      );
    }

    // Parse file content
    let importData: Record<string, Record<string, string>>;
    try {
      if (format === 'yaml') {
        importData = yaml.load(fileContent) as Record<
          string,
          Record<string, string>
        >;
      } else {
        importData = JSON.parse(fileContent) as Record<
          string,
          Record<string, string>
        >;
      }
    } catch (error) {
      throw new BadRequestException(`Invalid ${format} file: ${error.message}`);
    }

    if (!importData || typeof importData !== 'object') {
      throw new BadRequestException('Invalid import data format');
    }

    // 校验导入数量限制
    const totalKeys = Object.keys(importData).length;
    if (totalKeys > MAX_IMPORT_KEYS) {
      throw new BadRequestException(`Maximum ${MAX_IMPORT_KEYS} keys allowed per import`);
    }

    // Process each key and translation
    let createdKeys = 0;
    let updatedTranslations = 0;
    let createdTranslations = 0;
    let skippedTranslations = 0;

    await this.prisma.$transaction(
      async (tx) => {
        for (const [keyName, translations] of Object.entries(importData)) {
          // Check if key exists
          let key = await tx.key.findFirst({
            where: {
              namespaceId,
              name: keyName,
            },
          });

          if (!key) {
            // Create new key
            key = await tx.key.create({
              data: {
                name: keyName,
                namespaceId,
                type: KeyType.TEXT,
              },
            });
            createdKeys++;
          }

          // Process translations
          for (const [localeCode, content] of Object.entries(translations)) {
            // Find locale
            const locale = await tx.locale.findUnique({
              where: { code: localeCode },
            });
            if (!locale) {
              continue; // Skip unknown locales
            }

            // Check if translation exists
            const existingTranslation = await tx.translation.findUnique({
              where: {
                keyId_localeId: { keyId: key.id, localeId: locale.id },
              },
            });

            if (!existingTranslation) {
              // Create new translation
              await tx.translation.create({
                data: {
                  keyId: key.id,
                  localeId: locale.id,
                  content,
                  status: TranslationStatus.PENDING,
                },
              });
              createdTranslations++;
            } else if (mode === 'overwrite') {
              // Update existing translation
              await tx.translation.update({
                where: {
                  keyId_localeId: { keyId: key.id, localeId: locale.id },
                },
                data: {
                  content,
                  status: TranslationStatus.PENDING,
                },
              });
              updatedTranslations++;
            } else {
              // Skip if fillMissing mode and translation exists
              skippedTranslations++;
            }
          }
        }
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );

    return {
      createdKeys,
      createdTranslations,
      updatedTranslations,
      skippedTranslations,
      totalKeys: Object.keys(importData).length,
      mode,
    };
  }
}
