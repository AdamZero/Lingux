import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import type {
  FeishuTokenResponse,
  FeishuUserInfo,
  FeishuUser,
} from '../types/feishu.types';

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private readonly baseUrl = 'https://open.feishu.cn/open-apis/authen/v1';

  constructor() {}

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(
    code: string,
    clientId: string,
    clientSecret: string,
  ): Promise<{ accessToken: string; openId: string }> {
    const tokenUrl = `${this.baseUrl}/access_token`;

    this.logger.debug('Requesting access token from Feishu');

    const response = await axios.post(
      tokenUrl,
      {
        grant_type: 'authorization_code',
        code: code,
        app_id: clientId,
        app_secret: clientSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );

    const data = response.data as FeishuTokenResponse;

    if (data.code !== 0) {
      this.logger.error('Feishu API error:', data.msg);
      throw new Error(`Feishu API error: ${data.msg || 'Unknown error'}`);
    }

    const accessToken = data.data?.access_token;
    const openId = data.data?.open_id;

    if (!accessToken || !openId) {
      this.logger.error('Failed to get access_token or open_id from Feishu');
      throw new Error('Failed to get access_token or open_id from Feishu');
    }

    this.logger.debug('Access token and OpenID obtained successfully');
    return { accessToken, openId };
  }

  /**
   * Get user info from Feishu API
   */
  async getUserInfo(accessToken: string): Promise<FeishuUser> {
    const userInfoUrl = `${this.baseUrl}/user_info`;

    const response = await axios.get(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data as FeishuUserInfo;

    if (data.code !== 0) {
      this.logger.error('Failed to get user info:', data.msg);
      throw new Error(`Failed to get user info: ${data.msg}`);
    }

    if (!data.data) {
      this.logger.error('Invalid user data structure from Feishu');
      throw new Error('Invalid user data structure from Feishu');
    }

    const user = data.data;

    // Debug logging in development only
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug('Raw user data from Feishu:', {
        name: user.name,
        en_name: user.en_name,
        open_id: user.open_id,
        email: user.email,
        mobile: user.mobile,
      });
    }

    // Priority: name > en_name > open_id
    const name = user.name || user.en_name || user.open_id;

    this.logger.debug('Resolved user name:', name);

    return {
      name,
      email: user.email,
      avatar: user.avatar_thumb || user.avatar_url,
      mobile: user.mobile,
    };
  }

  /**
   * Build Feishu authorization URL
   */
  buildAuthUrl(
    clientId: string,
    redirectUri: string,
    scope = 'user_info',
  ): string {
    return `https://open.feishu.cn/open-apis/authen/v1/index?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
  }
}
