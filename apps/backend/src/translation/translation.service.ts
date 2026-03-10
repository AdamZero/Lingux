import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CreateTranslationDto, TranslationStatus } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TranslationService {
  constructor(private readonly prisma: PrismaService) {}

  private async getLocaleId(code: string) {
    const locale = await this.prisma.locale.findUnique({
      where: { code },
    });
    if (!locale) {
      throw new NotFoundException(`Locale with code ${code} not found`);
    }
    return locale.id;
  }

  async create(projectId: string, namespaceId: string, keyId: string, createTranslationDto: CreateTranslationDto) {
    const localeId = await this.getLocaleId(createTranslationDto.localeCode);

    // Verify key exists and belongs to namespace/project
    const key = await this.prisma.key.findFirst({
      where: { 
        id: keyId, 
        namespaceId,
        namespace: { projectId } 
      },
    });
    if (!key) {
      throw new NotFoundException(`Key with ID ${keyId} not found in the specified path`);
    }

    return this.prisma.translation.create({
      data: {
        content: createTranslationDto.content,
        status: createTranslationDto.status || TranslationStatus.PENDING,
        isLlmTranslated: createTranslationDto.isLlmTranslated || false,
        keyId: keyId,
        localeId: localeId,
      },
    });
  }

  async findAll(projectId: string, namespaceId: string, keyId: string) {
    return this.prisma.translation.findMany({
      where: { 
        keyId: keyId,
        key: { 
          namespaceId,
          namespace: { projectId } 
        } 
      },
      include: {
        locale: true,
      },
    });
  }

  async findOne(projectId: string, namespaceId: string, keyId: string, localeCode: string) {
    const localeId = await this.getLocaleId(localeCode);
    const translation = await this.prisma.translation.findFirst({
      where: { 
        keyId, 
        localeId,
        key: { 
          namespaceId,
          namespace: { projectId } 
        }
      },
      include: {
        locale: true,
      },
    });
    if (!translation) {
      throw new NotFoundException(`Translation for ${localeCode} not found for key ${keyId}`);
    }
    return translation;
  }

  async update(projectId: string, namespaceId: string, keyId: string, localeCode: string, updateTranslationDto: UpdateTranslationDto) {
    const localeId = await this.getLocaleId(localeCode);
    try {
      return await this.prisma.translation.update({
        where: { 
          keyId_localeId: { keyId, localeId } 
        },
        data: {
          content: updateTranslationDto.content,
          status: updateTranslationDto.status,
          isLlmTranslated: updateTranslationDto.isLlmTranslated,
        },
      });
    } catch (error) {
      throw new NotFoundException(`Translation not found`);
    }
  }

  async approve(projectId: string, namespaceId: string, keyId: string, localeCode: string) {
    const localeId = await this.getLocaleId(localeCode);
    return this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.APPROVED },
    });
  }

  async reject(projectId: string, namespaceId: string, keyId: string, localeCode: string) {
    const localeId = await this.getLocaleId(localeCode);
    return this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.PENDING },
    });
  }

  async publish(projectId: string, namespaceId: string, keyId: string, localeCode: string) {
    const localeId = await this.getLocaleId(localeCode);
    const translation = await this.prisma.translation.findUnique({
      where: { keyId_localeId: { keyId, localeId } },
    });
    
    if (!translation || translation.status !== TranslationStatus.APPROVED) {
      throw new BadRequestException('Only approved translations can be published');
    }

    return this.prisma.translation.update({
      where: { keyId_localeId: { keyId, localeId } },
      data: { status: TranslationStatus.PUBLISHED },
    });
  }

  async remove(projectId: string, namespaceId: string, keyId: string, localeCode: string) {
    const localeId = await this.getLocaleId(localeCode);
    try {
      await this.prisma.translation.delete({
        where: { keyId_localeId: { keyId, localeId } },
      });
      return { success: true };
    } catch (error) {
      throw new NotFoundException(`Translation not found`);
    }
  }
}
