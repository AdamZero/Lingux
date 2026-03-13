import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CreateTranslationDto,
  TranslationStatus,
} from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TranslationService {
  constructor(private readonly prisma: PrismaService) {}

  private systemUserId: string | null = null;

  private async assertKeyInPath(
    projectId: string,
    namespaceId: string,
    keyId: string,
  ) {
    const key = await this.prisma.key.findFirst({
      where: {
        id: keyId,
        namespaceId,
        namespace: { projectId },
      },
    });
    if (!key) {
      throw new NotFoundException(
        `Key with ID ${keyId} not found in the specified path`,
      );
    }
    return key;
  }

  private async getLocaleId(code: string) {
    const locale = await this.prisma.locale.findUnique({
      where: { code },
    });
    if (!locale) {
      throw new NotFoundException(`Locale with code ${code} not found`);
    }
    return locale.id;
  }

  private async getSystemUserId() {
    if (this.systemUserId) {
      return this.systemUserId;
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: 'system' },
      select: { id: true },
    });
    if (existing) {
      this.systemUserId = existing.id;
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: { username: 'system', role: 'ADMIN' },
      select: { id: true },
    });
    this.systemUserId = created.id;
    return created.id;
  }

  private async createAuditLog(params: {
    action: string;
    targetId: string;
    projectId?: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const systemUserId = await this.getSystemUserId();
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        targetType: 'Translation',
        targetId: params.targetId,
        scopeType: params.projectId ? 'PROJECT' : 'GLOBAL',
        projectId: params.projectId,
        actorType: 'SYSTEM',
        actorId: systemUserId,
        userId: systemUserId,
        payload: params.payload,
        version: 1,
      },
    });
  }

  async create(
    projectId: string,
    namespaceId: string,
    keyId: string,
    createTranslationDto: CreateTranslationDto,
  ) {
    const localeId = await this.getLocaleId(createTranslationDto.localeCode);

    await this.assertKeyInPath(projectId, namespaceId, keyId);

    const created = await this.prisma.translation.create({
      data: {
        content: createTranslationDto.content,
        status: createTranslationDto.status || TranslationStatus.PENDING,
        isLlmTranslated: createTranslationDto.isLlmTranslated || false,
        keyId: keyId,
        localeId: localeId,
      },
    });

    await this.createAuditLog({
      action: 'TRANSLATION_CREATE',
      targetId: created.id,
      projectId,
      payload: {
        context: {
          projectId,
          namespaceId,
          keyId,
          localeCode: createTranslationDto.localeCode,
        },
        detail: {
          status: created.status,
        },
      },
    });

    return created;
  }

  async findAll(projectId: string, namespaceId: string, keyId: string) {
    return this.prisma.translation.findMany({
      where: {
        keyId: keyId,
        key: {
          namespaceId,
          namespace: { projectId },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        locale: true,
      },
    });
  }

  async findOne(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
  ) {
    const localeId = await this.getLocaleId(localeCode);
    const translation = await this.prisma.translation.findFirst({
      where: {
        keyId,
        localeId,
        key: {
          namespaceId,
          namespace: { projectId },
        },
      },
      include: {
        locale: true,
      },
    });
    if (!translation) {
      throw new NotFoundException(
        `Translation for ${localeCode} not found for key ${keyId}`,
      );
    }
    return translation;
  }

  async update(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
    updateTranslationDto: UpdateTranslationDto,
  ) {
    if (
      updateTranslationDto.status &&
      updateTranslationDto.status !== TranslationStatus.PENDING
    ) {
      throw new BadRequestException(
        'Status can only be changed via action endpoints',
      );
    }

    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);

    const existing = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });

    const contentProvided = typeof updateTranslationDto.content === 'string';

    if (!existing) {
      if (!contentProvided) {
        throw new NotFoundException(`Translation not found`);
      }

      const created = await this.prisma.translation.create({
        data: {
          keyId,
          localeId,
          content: updateTranslationDto.content as string,
          status: TranslationStatus.PENDING,
          isLlmTranslated: updateTranslationDto.isLlmTranslated ?? false,
        },
      });

      await this.createAuditLog({
        action: 'TRANSLATION_CREATE_VIA_PATCH',
        targetId: created.id,
        projectId,
        payload: {
          context: {
            projectId,
            namespaceId,
            keyId,
            localeCode,
          },
          detail: {
            status: created.status,
          },
        },
      });

      return created;
    }

    const data: UpdateTranslationDto & {
      reviewComment?: string | null;
    } = {};

    if (contentProvided) {
      data.content = updateTranslationDto.content;
      data.status = TranslationStatus.PENDING;
      data.reviewComment = null;
    }

    if (typeof updateTranslationDto.isLlmTranslated === 'boolean') {
      data.isLlmTranslated = updateTranslationDto.isLlmTranslated;
    }

    try {
      const updated = await this.prisma.translation.update({
        where: {
          keyId_localeId: { keyId, localeId },
        },
        data: {
          ...data,
        },
      });

      await this.createAuditLog({
        action: 'TRANSLATION_UPDATE',
        targetId: updated.id,
        projectId,
        payload: {
          context: {
            projectId,
            namespaceId,
            keyId,
            localeCode,
          },
          detail: {
            status: updated.status,
          },
        },
      });

      return updated;
    } catch (error) {
      throw new NotFoundException(`Translation not found`);
    }
  }

  async submitReview(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
  ) {
    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);

    const translation = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });

    if (!translation) {
      throw new NotFoundException(`Translation not found`);
    }

    if (translation.status !== TranslationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending translations can be submitted for review',
      );
    }

    if (!translation.content.trim()) {
      throw new BadRequestException('Translation content cannot be empty');
    }

    const updated = await this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.REVIEWING },
    });

    await this.createAuditLog({
      action: 'TRANSLATION_SUBMIT_REVIEW',
      targetId: updated.id,
      projectId,
      payload: {
        context: {
          projectId,
          namespaceId,
          keyId,
          localeCode,
        },
        detail: {
          from: translation.status,
          to: updated.status,
        },
      },
    });

    return updated;
  }

  async approve(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
  ) {
    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);

    const translation = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });

    if (!translation) {
      throw new NotFoundException(`Translation not found`);
    }

    if (translation.status !== TranslationStatus.REVIEWING) {
      throw new BadRequestException(
        'Only reviewing translations can be approved',
      );
    }

    const updated = await this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.APPROVED, reviewComment: null },
    });

    await this.createAuditLog({
      action: 'TRANSLATION_APPROVE',
      targetId: updated.id,
      projectId,
      payload: {
        context: {
          projectId,
          namespaceId,
          keyId,
          localeCode,
        },
        detail: {
          from: translation.status,
          to: updated.status,
        },
      },
    });

    return updated;
  }

  async reject(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
    reason: string,
  ) {
    if (!reason?.trim()) {
      throw new BadRequestException('Reject reason is required');
    }

    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);

    const translation = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });

    if (!translation) {
      throw new NotFoundException(`Translation not found`);
    }

    if (translation.status !== TranslationStatus.REVIEWING) {
      throw new BadRequestException(
        'Only reviewing translations can be rejected',
      );
    }

    const updated = await this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.PENDING, reviewComment: reason.trim() },
    });

    await this.createAuditLog({
      action: 'TRANSLATION_REJECT',
      targetId: updated.id,
      projectId,
      payload: {
        context: {
          projectId,
          namespaceId,
          keyId,
          localeCode,
        },
        detail: {
          from: translation.status,
          to: updated.status,
          reason: reason.trim(),
        },
      },
    });

    return updated;
  }

  async publish(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
  ) {
    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);
    const translation = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });

    if (!translation || translation.status !== TranslationStatus.APPROVED) {
      throw new BadRequestException(
        'Only approved translations can be published',
      );
    }

    const updated = await this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.PUBLISHED },
    });

    await this.createAuditLog({
      action: 'TRANSLATION_PUBLISH',
      targetId: updated.id,
      projectId,
      payload: {
        context: {
          projectId,
          namespaceId,
          keyId,
          localeCode,
        },
        detail: {
          from: translation.status,
          to: updated.status,
        },
      },
    });

    return updated;
  }

  async remove(
    projectId: string,
    namespaceId: string,
    keyId: string,
    localeCode: string,
  ) {
    const localeId = await this.getLocaleId(localeCode);
    await this.assertKeyInPath(projectId, namespaceId, keyId);
    try {
      await this.prisma.translation.delete({
        where: { keyId_localeId: { keyId, localeId } },
      });

      await this.createAuditLog({
        action: 'TRANSLATION_DELETE',
        targetId: `${keyId}:${localeId}`,
        projectId,
        payload: {
          context: {
            projectId,
            namespaceId,
            keyId,
            localeCode,
          },
        },
      });

      return { success: true };
    } catch (error) {
      throw new NotFoundException(`Translation not found`);
    }
  }
}
