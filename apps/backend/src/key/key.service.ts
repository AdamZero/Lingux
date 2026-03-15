import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TranslationStatus } from '@prisma/client';
import { CreateKeyDto } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class KeyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    projectId: string,
    namespaceId: string,
    createKeyDto: CreateKeyDto,
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

    return this.prisma.key.create({
      data: {
        ...createKeyDto,
        namespaceId: namespaceId,
      },
    });
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
        key: {
          namespace: { projectId },
        },
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
    try {
      return await this.prisma.key.update({
        where: { id },
        data: updateKeyDto,
      });
    } catch (error) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }
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
}
