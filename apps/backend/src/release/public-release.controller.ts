import { Controller, Get, Param } from '@nestjs/common';
import { ReleaseService } from './release.service';

/**
 * 公开发布接口控制器
 * 用于支持分享链接，无需 projectId 即可访问发布详情
 */
@Controller('releases')
export class PublicReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  /**
   * 获取发布详情（公开接口，用于分享链接）
   * GET /releases/:releaseId
   */
  @Get(':releaseId')
  getReleasePublic(@Param('releaseId') releaseId: string) {
    return this.releaseService.getReleasePublic(releaseId);
  }

  /**
   * 获取发布产物（公开接口，用于分享链接）
   * GET /releases/:releaseId/artifacts/:localeCode
   */
  @Get(':releaseId/artifacts/:localeCode')
  getArtifactPublic(
    @Param('releaseId') releaseId: string,
    @Param('localeCode') localeCode: string,
  ) {
    return this.releaseService.getArtifactPublic(releaseId, localeCode);
  }
}
