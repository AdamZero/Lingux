import { Module } from '@nestjs/common';
import { ReleaseController } from './release.controller';
import { PublicReleaseController } from './public-release.controller';
import { ReleaseService } from './release.service';

@Module({
  controllers: [ReleaseController, PublicReleaseController],
  providers: [ReleaseService],
})
export class ReleaseModule {}
