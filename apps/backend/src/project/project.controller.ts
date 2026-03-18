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
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectService.create(createProjectDto);
  }

  @Get()
  findAll() {
    return this.projectService.findAll();
  }

  @Get(':projectId')
  findOne(@Param('projectId') id: string) {
    return this.projectService.findOne(id);
  }

  @Get(':projectId/audit-logs')
  findAuditLogs(
    @Param('projectId') projectId: string,
    @Query()
    query: {
      limit?: string;
      before?: string;
      beforeId?: string;
      targetType?: string;
      targetId?: string;
      actionPrefix?: string;
      actorType?: string;
      actorId?: string;
      userId?: string;
    },
  ) {
    return this.projectService.findAuditLogs(projectId, query);
  }

  @Patch(':projectId')
  update(
    @Param('projectId') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('projectId') id: string) {
    return this.projectService.remove(id);
  }

  @Post(':projectId/import-preview')
  @UseInterceptors(FileInterceptor('file'))
  async previewImport(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format: 'json' | 'yaml' = 'json',
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileContent = file.buffer.toString('utf8');
    return this.projectService.previewImport(projectId, fileContent, format);
  }

  @Post(':projectId/import')
  @UseInterceptors(FileInterceptor('file'))
  async importMultiple(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('format') format: 'json' | 'yaml' = 'json',
    @Query('mode') mode: 'fillMissing' | 'overwrite' = 'fillMissing',
    @Query('namespaceNames') namespaceNames?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileContent = file.buffer.toString('utf8');
    const selectedNamespaces = namespaceNames
      ? namespaceNames.split(',').filter((n) => n.trim())
      : undefined;

    return this.projectService.importMultiple(
      projectId,
      fileContent,
      format,
      mode,
      selectedNamespaces,
    );
  }
}
