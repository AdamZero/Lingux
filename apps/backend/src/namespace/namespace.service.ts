import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class NamespaceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, createNamespaceDto: CreateNamespaceDto) {
    // Check if project exists
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    return this.prisma.namespace.create({
      data: {
        name: createNamespaceDto.name,
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
    try {
      return await this.prisma.namespace.update({
        where: {
          id,
          projectId, // Prisma's update where only supports unique fields usually, but we can combine if needed or use updateMany then find.
          // Actually, 'id' is globally unique. We just need to verify projectId for safety.
        },
        data: updateNamespaceDto,
      });
    } catch (error) {
      throw new NotFoundException(`Namespace with ID ${id} not found`);
    }
  }

  async remove(projectId: string, id: string) {
    try {
      await this.prisma.namespace.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      throw new NotFoundException(`Namespace with ID ${id} not found`);
    }
  }
}
