import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  HttpCode,
  HttpStatus,
  Query,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { NamespaceService } from './namespace.service';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { TranslateNamespaceDto } from './dto/translate-namespace.dto';
import { Delete } from '@nestjs/common';

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
    @Query('mode') mode: 'published' | 'all' = 'published',
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
      mode,
    );

    const fileName = `translations-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.${format}`;

    // For Excel format, stream the buffer directly as file download
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

    // For JSON/YAML formats, return as file download with appropriate content type
    const contentType = format === 'yaml' ? 'text/yaml' : 'application/json';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(content);
    return;
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

  /**
   * 一键翻译 - 创建异步翻译任务
   * 如果传 namespaceIds，则翻译这些命名空间；否则翻译整个项目
   */
  @Post('translate')
  async translate(
    @Param('projectId') projectId: string,
    @Body() dto: TranslateNamespaceDto,
    @Req() req: Request,
  ) {
    // 从 JWT 中获取用户 ID
    const userId = (req as any).user?.id;
    return this.namespaceService.translate(projectId, dto.namespaceIds, userId);
  }
}
