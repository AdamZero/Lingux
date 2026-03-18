import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { PrismaService } from '../prisma.service';
import * as yaml from 'js-yaml';
import * as XLSX from 'xlsx';

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

  async exportMultiple(
    projectId: string,
    namespaceIds: string[],
    format: 'json' | 'yaml' | 'xlsx',
  ): Promise<string | Buffer> {
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

    if (format === 'yaml') {
      return yaml.dump(exportData);
    } else if (format === 'xlsx') {
      return this.exportToExcel(exportData);
    } else {
      return JSON.stringify(exportData, null, 2);
    }
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
}
