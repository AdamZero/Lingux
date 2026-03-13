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
} from '@nestjs/common';
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
}
