import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from '../auth.service';
import { FeishuService } from '../services/feishu.service';
import type { Request } from 'express';

@Injectable()
export class FeishuStrategy extends PassportStrategy(Strategy, 'feishu') {
  private readonly logger = new Logger(FeishuStrategy.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(
    private readonly authService: AuthService,
    private readonly feishuService: FeishuService,
  ) {
    super();

    this.clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
    this.clientSecret =
      process.env.FEISHU_CLIENT_SECRET || 'your-feishu-client-secret';
  }

  async validate(req: Request) {
    const code = req.query.code as string;
    if (!code) {
      this.logger.error('No code provided in callback');
      throw new Error('No code provided in callback');
    }

    this.logger.log('Feishu OAuth2 callback received with code');

    try {
      // Get access token and openId using FeishuService
      const { accessToken, openId } = await this.feishuService.getAccessToken(
        code,
        this.clientId,
        this.clientSecret,
      );

      this.logger.log('Access token and OpenID obtained successfully');

      // Get user info using FeishuService
      const userInfo = await this.feishuService.getUserInfo(accessToken);
      this.logger.log('User info obtained:', userInfo);

      // Create or update user in database with real user info
      const user = await this.authService.validateUser({
        externalId: openId,
        provider: 'feishu',
        name: userInfo.name,
        email: userInfo.email,
        avatar: userInfo.avatar,
        mobile: userInfo.mobile,
      });

      this.logger.log('User created/updated:', user);
      return user;
    } catch (error) {
      this.logger.error('Feishu OAuth2 validation error:', error);
      throw error;
    }
  }
}
