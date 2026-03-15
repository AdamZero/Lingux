import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ListReleasesQueryDto,
  PreviewReleaseDto,
  PublishReleaseDto,
  ReleaseSessionNoteDto,
  ReleaseSessionRejectDto,
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
  create(
    @Param('projectId') projectId: string,
    @Body() dto: PublishReleaseDto,
  ) {
    return this.releaseService.publishReleaseSession(projectId, dto.sessionId);
  }

  @Get('release-sessions/active')
  getActiveReleaseSession(@Param('projectId') projectId: string) {
    return this.releaseService.getActiveReleaseSession(projectId);
  }

  @Get('release-sessions/:sessionId')
  getReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.releaseService.getReleaseSession(projectId, sessionId);
  }

  @Post('release-sessions/:sessionId/submit')
  submitReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ReleaseSessionNoteDto,
  ) {
    return this.releaseService.submitReleaseSession(
      projectId,
      sessionId,
      dto.note,
    );
  }

  @Post('release-sessions/:sessionId/approve')
  approveReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ReleaseSessionNoteDto,
  ) {
    return this.releaseService.approveReleaseSession(
      projectId,
      sessionId,
      dto.note,
    );
  }

  @Post('release-sessions/:sessionId/reject')
  rejectReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ReleaseSessionRejectDto,
  ) {
    return this.releaseService.rejectReleaseSession(
      projectId,
      sessionId,
      dto.reason,
    );
  }

  @Post('release-sessions/:sessionId/publish')
  publishReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.releaseService.publishReleaseSession(projectId, sessionId);
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
