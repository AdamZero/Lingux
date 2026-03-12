import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NamespaceService {
  constructor(private readonly prisma: PrismaService) {}

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
}
