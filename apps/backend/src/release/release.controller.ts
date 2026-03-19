import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
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
    @Request() req: { user: { id: string } },
  ) {
    return this.releaseService.publishReleaseSession(
      projectId,
      dto.sessionId,
      req.user.id,
    );
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
    @Request() req: { user: { id: string } },
  ) {
    return this.releaseService.approveReleaseSession(
      projectId,
      sessionId,
      req.user.id,
      dto.note,
    );
  }

  @Post('release-sessions/:sessionId/reject')
  rejectReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: ReleaseSessionRejectDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.releaseService.rejectReleaseSession(
      projectId,
      sessionId,
      req.user.id,
      dto.reason,
    );
  }

  @Post('release-sessions/:sessionId/publish')
  publishReleaseSession(
    @Param('projectId') projectId: string,
    @Param('sessionId') sessionId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.releaseService.publishReleaseSession(
      projectId,
      sessionId,
      req.user.id,
    );
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
