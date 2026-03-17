import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthService } from '../auth.service';
import type { Request } from 'express';
import fetch from 'node-fetch';

interface FeishuTokenResponse {
  code: number;
  msg: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    open_id: string;
    refresh_token?: string;
  };
}

interface FeishuUserInfo {
  code: number;
  msg: string;
  data: {
    open_id: string;
    union_id: string;
    user_id?: string;
    name: string;
    en_name?: string;
    email?: string;
    mobile?: string;
    avatar_url?: string;
    avatar_thumb?: string;
    avatar_middle?: string;
    avatar_big?: string;
    tenant_key: string;
  };
}

@Injectable()
export class FeishuStrategy extends PassportStrategy(Strategy, 'feishu') {
  private readonly logger = new Logger(FeishuStrategy.name);
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor(private readonly authService: AuthService) {
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

    // Request access token from Feishu API
    const tokenUrl = 'https://open.feishu.cn/open-apis/authen/v1/access_token';
    this.logger.log('Requesting access token from:', tokenUrl);

    try {
      const tokenResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code: code,
          app_id: this.clientId,
          app_secret: this.clientSecret,
        }),
      });

      this.logger.log('Token response status:', tokenResponse.status);
      const tokenData = (await tokenResponse.json()) as FeishuTokenResponse;
      this.logger.log('Token response data:', tokenData);

      if (tokenData.code !== 0) {
        this.logger.error(
          'Feishu API error:',
          tokenData.msg || 'Unknown error',
        );
        throw new Error(
          `Feishu API error: ${tokenData.msg || 'Unknown error'}`,
        );
      }

      const accessToken = tokenData.data?.access_token;
      const openId = tokenData.data?.open_id;

      if (!accessToken || !openId) {
        this.logger.error('Failed to get access_token or open_id from Feishu');
        throw new Error('Failed to get access_token or open_id from Feishu');
      }

      this.logger.log('Access token and OpenID obtained successfully');

      // 获取用户详细信息
      const userInfo = await this.getUserInfo(accessToken);
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

  private async getUserInfo(accessToken: string): Promise<{
    name: string;
    email?: string;
    avatar?: string;
    mobile?: string;
  }> {
    const userInfoUrl = 'https://open.feishu.cn/open-apis/authen/v1/user_info';

    const response = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await response.json()) as FeishuUserInfo;
    this.logger.log('Feishu user info response:', data);

    if (data.code !== 0) {
      this.logger.error('Failed to get user info:', data.msg);
      throw new Error(`Failed to get user info: ${data.msg}`);
    }

    const user = data.data;
    return {
      name: user.name || user.en_name || user.open_id,
      email: user.email,
      avatar: user.avatar_thumb || user.avatar_url,
      mobile: user.mobile,
    };
  }
}
