import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateKeyDto } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class KeyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(projectId: string, namespaceId: string, createKeyDto: CreateKeyDto) {
    // Verify project and namespace relationship
    const namespace = await this.prisma.namespace.findFirst({
      where: { id: namespaceId, projectId },
    });
    if (!namespace) {
      throw new NotFoundException(`Namespace with ID ${namespaceId} not found in project ${projectId}`);
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
        namespace: { projectId } 
      },
      include: {
        translations: true,
      },
    });
  }

  async findOne(projectId: string, namespaceId: string, id: string) {
    const key = await this.prisma.key.findFirst({
      where: { 
        id, 
        namespaceId,
        namespace: { projectId } 
      },
      include: {
        translations: true,
      },
    });
    if (!key) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }
    return key;
  }

  async update(projectId: string, namespaceId: string, id: string, updateKeyDto: UpdateKeyDto) {
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
    try {
      await this.prisma.key.delete({
        where: { id },
      });
      return { success: true };
    } catch (error) {
      throw new NotFoundException(`Key with ID ${id} not found`);
    }
  }
}
