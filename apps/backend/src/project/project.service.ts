import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeLocaleIds(localeIds?: string[]) {
    if (!localeIds) {
      return [];
    }
    const normalized = localeIds.map((id) => id?.trim());
    if (normalized.some((id) => !id)) {
      throw new BadRequestException('localeIds cannot contain empty values');
    }
    return Array.from(new Set(normalized as string[]));
  }

  private async assertLocaleIdsExist(localeIds: string[]) {
    if (localeIds.length === 0) {
      return;
    }
    const existing = await this.prisma.locale.findMany({
      where: { id: { in: localeIds } },
      select: { id: true },
    });
    if (existing.length !== localeIds.length) {
      const existingIds = new Set(existing.map((l) => l.id));
      const missing = localeIds.filter((id) => !existingIds.has(id));
      throw new BadRequestException(
        `Some locales not found: ${missing.join(', ')}`,
      );
    }
  }

  private async reconcileProjectLocales(params: {
    projectId: string;
    desiredEnabledLocaleIds: string[];
  }) {
    const desiredSet = new Set(params.desiredEnabledLocaleIds);
    const now = new Date();

    const existing = await this.prisma.projectLocale.findMany({
      where: { projectId: params.projectId },
      select: { localeId: true, enabled: true },
    });

    const toDisable = existing
      .filter((pl) => pl.enabled && !desiredSet.has(pl.localeId))
      .map((pl) => pl.localeId);

    const currentlyEnabled = new Set(
      existing.filter((pl) => pl.enabled).map((pl) => pl.localeId),
    );
    const toEnable = params.desiredEnabledLocaleIds.filter(
      (id) => !currentlyEnabled.has(id),
    );

    const ops = [
      ...toEnable.map((localeId) =>
        this.prisma.projectLocale.upsert({
          where: {
            projectId_localeId: { projectId: params.projectId, localeId },
          },
          create: {
            projectId: params.projectId,
            localeId,
            enabled: true,
            disabledAt: null,
          },
          update: { enabled: true, disabledAt: null },
        }),
      ),
      ...toDisable.map((localeId) =>
        this.prisma.projectLocale.upsert({
          where: {
            projectId_localeId: { projectId: params.projectId, localeId },
          },
          create: {
            projectId: params.projectId,
            localeId,
            enabled: false,
            disabledAt: now,
          },
          update: { enabled: false, disabledAt: now },
        }),
      ),
    ];

    if (ops.length > 0) {
      await this.prisma.$transaction(ops);
    }
  }

  private toProjectResponse(project: {
    projectLocales?: { enabled: boolean; locale: unknown }[];
    [key: string]: unknown;
  }) {
    const { projectLocales, ...rest } = project;
    const locales = (projectLocales ?? [])
      .filter((pl) => pl.enabled)
      .map((pl) => pl.locale);
    return { ...rest, locales };
  }

  private async getProjectWithEnabledLocales(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        projectLocales: {
          where: {
            enabled: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            locale: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    return this.toProjectResponse(project);
  }

  async create(createProjectDto: CreateProjectDto) {
    const baseLocale = createProjectDto.baseLocale || 'zh-CN';

    const baseLocaleRow = await this.prisma.locale.findUnique({
      where: { code: baseLocale },
      select: { id: true },
    });
    if (!baseLocaleRow) {
      throw new BadRequestException(
        `Default locale ${baseLocale} not found. Please seed locales first.`,
      );
    }

    const requestedLocaleIds = this.normalizeLocaleIds(
      createProjectDto.localeIds,
    );
    await this.assertLocaleIdsExist(requestedLocaleIds);

    const enabledLocaleIds = Array.from(
      new Set([...requestedLocaleIds, baseLocaleRow.id]),
    );

    const project = await this.prisma.project.create({
      data: {
        name: createProjectDto.name,
        description: createProjectDto.description,
        baseLocale,
        projectLocales: {
          createMany: {
            data: enabledLocaleIds.map((localeId) => ({
              localeId,
              enabled: true,
              disabledAt: null,
            })),
          },
        },
      },
      include: {
        projectLocales: {
          where: {
            enabled: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            locale: true,
          },
        },
      },
    });
    return this.toProjectResponse(project);
  }

  async findAll() {
    const projects = await this.prisma.project.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        projectLocales: {
          where: {
            enabled: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            locale: true,
          },
        },
      },
    });
    return projects.map((p) => this.toProjectResponse(p));
  }

  async findOne(id: string) {
    return this.getProjectWithEnabledLocales(id);
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    const { localeIds, ...projectData } = updateProjectDto;
    const cleanProjectData = Object.fromEntries(
      Object.entries(projectData).filter(([, value]) => value !== undefined),
    ) as typeof projectData;

    if (!localeIds) {
      try {
        const project = await this.prisma.project.update({
          where: { id },
          data: cleanProjectData,
          include: {
            projectLocales: {
              where: {
                enabled: true,
              },
              orderBy: {
                updatedAt: 'desc',
              },
              include: {
                locale: true,
              },
            },
          },
        });
        return this.toProjectResponse(project);
      } catch (error) {
        throw new NotFoundException(`Project with ID ${id} not found`);
      }
    }

    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, baseLocale: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    if (Object.keys(cleanProjectData).length > 0) {
      await this.prisma.project.update({
        where: { id },
        data: cleanProjectData,
      });
    }

    const baseLocale = project.baseLocale || 'zh-CN';
    const baseLocaleRow = await this.prisma.locale.findUnique({
      where: { code: baseLocale },
      select: { id: true },
    });
    if (!baseLocaleRow) {
      throw new BadRequestException(
        `Default locale ${baseLocale} not found. Please seed locales first.`,
      );
    }

    const requestedLocaleIds = this.normalizeLocaleIds(localeIds);
    await this.assertLocaleIdsExist(requestedLocaleIds);

    const desiredEnabledLocaleIds = Array.from(
      new Set([...requestedLocaleIds, baseLocaleRow.id]),
    );

    await this.reconcileProjectLocales({
      projectId: id,
      desiredEnabledLocaleIds,
    });

    return this.getProjectWithEnabledLocales(id);
  }

  async remove(id: string) {
    try {
      await this.prisma.project.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }
  }
}
