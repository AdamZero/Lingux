import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  CreateReleaseDto,
  ListReleasesQueryDto,
  PreviewReleaseDto,
  RollbackReleaseDto,
} from './dto/create-release.dto';
import { ReleaseService } from './release.service';

@Controller('projects/:projectId')
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Post('releases/preview')
  preview(
    @Param('projectId') projectId: string,
    @Body() dto: PreviewReleaseDto,
  ) {
    return this.releaseService.previewRelease(projectId, dto);
  }

  @Post('releases')
  create(@Param('projectId') projectId: string, @Body() dto: CreateReleaseDto) {
    return this.releaseService.createRelease(projectId, dto);
  }

  @Get('releases')
  list(
    @Param('projectId') projectId: string,
    @Query() query: ListReleasesQueryDto,
  ) {
    return this.releaseService.listReleases(projectId, query);
  }

  @Get('releases/:releaseId')
  get(
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
  ) {
    return this.releaseService.getRelease(projectId, releaseId);
  }

  @Post('releases/:releaseId/rollback')
  rollback(
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
    @Body() dto: RollbackReleaseDto,
  ) {
    return this.releaseService.rollback(projectId, releaseId, dto.toReleaseId);
  }

  @Get('releases/:releaseId/artifacts/:localeCode')
  getArtifact(
    @Param('projectId') projectId: string,
    @Param('releaseId') releaseId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.releaseService.getArtifact(projectId, releaseId, localeCode);
  }

  @Get('artifacts/latest/:localeCode')
  getLatestArtifact(
    @Param('projectId') projectId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.releaseService.getLatestArtifact(projectId, localeCode);
  }
}
