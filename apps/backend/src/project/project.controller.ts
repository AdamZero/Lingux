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

  @Patch(':projectId')
  update(
    @Param('projectId') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.update(id, updateProjectDto);
  }

  @Post(':projectId/locales')
  addLocale(
    @Param('projectId') projectId: string,
    @Body('localeId') localeId: string,
  ) {
    return this.projectService.addLocale(projectId, localeId);
  }

  @Delete(':projectId/locales/:localeId')
  removeLocale(
    @Param('projectId') projectId: string,
    @Param('localeId') localeId: string,
  ) {
    return this.projectService.removeLocale(projectId, localeId);
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('projectId') id: string) {
    return this.projectService.remove(id);
  }
}
