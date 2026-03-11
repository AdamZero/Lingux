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
