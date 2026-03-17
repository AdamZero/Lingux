import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ConfigService } from './config.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('config')
@UseGuards(AuthGuard('jwt'))
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}

  @Get('features')
  async getFeatureFlags() {
    return this.configService.getFeatureFlags();
  }

  @Post('features/:key')
  async updateFeatureFlag(
    @Param('key') key: string,
    @Body('enabled') enabled: boolean,
  ) {
    return this.configService.updateFeatureFlag(key, enabled);
  }
}
