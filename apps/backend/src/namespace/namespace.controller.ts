import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { NamespaceService } from './namespace.service';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';

@Controller('projects/:projectId/namespaces')
export class NamespaceController {
  constructor(private readonly namespaceService: NamespaceService) {}

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() createNamespaceDto: CreateNamespaceDto,
  ) {
    return this.namespaceService.create(projectId, createNamespaceDto);
  }

  @Get()
  findAll(@Param('projectId') projectId: string) {
    return this.namespaceService.findAll(projectId);
  }

  @Get('export')
  async exportMultiple(
    @Param('projectId') projectId: string,
    @Query('namespaceIds') namespaceIds: string,
    @Query('format') format: 'json' | 'yaml' | 'xlsx' = 'json',
    @Res() res: Response,
  ) {
    if (!namespaceIds) {
      throw new BadRequestException('namespaceIds is required');
    }

    const ids = namespaceIds.split(',').filter((id) => id.trim());
    if (ids.length === 0) {
      throw new BadRequestException('At least one namespaceId is required');
    }

    const content = await this.namespaceService.exportMultiple(
      projectId,
      ids,
      format,
    );

    const fileName = `translations-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.${format}`;

    // For Excel format, stream the buffer directly
    if (format === 'xlsx' && Buffer.isBuffer(content)) {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.send(content);
      return;
    }

    return {
      content,
      format,
      fileName,
    };
  }

  @Get(':namespaceId')
  findOne(
    @Param('projectId') projectId: string,
    @Param('namespaceId') id: string,
  ) {
    return this.namespaceService.findOne(projectId, id);
  }

  @Patch(':namespaceId')
  update(
    @Param('projectId') projectId: string,
    @Param('namespaceId') id: string,
    @Body() updateNamespaceDto: UpdateNamespaceDto,
  ) {
    return this.namespaceService.update(projectId, id, updateNamespaceDto);
  }

  @Delete(':namespaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('projectId') projectId: string,
    @Param('namespaceId') id: string,
  ) {
    return this.namespaceService.remove(projectId, id);
  }
}
