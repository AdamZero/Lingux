import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

@Injectable()
export class FeishuStrategy extends PassportStrategy(Strategy, 'feishu') {
  constructor(private readonly authService: AuthService) {
    super({
      authorizationURL: 'https://open.feishu.cn/open-apis/authen/v1/index',
      tokenURL: 'https://open.feishu.cn/open-apis/authen/v1/access_token',
      clientID: process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id',
      clientSecret:
        process.env.FEISHU_CLIENT_SECRET || 'your-feishu-client-secret',
      callbackURL:
        process.env.FEISHU_CALLBACK_URL ||
        'http://localhost:3001/auth/feishu/callback',
      scope: 'user_info',
    });
  }

  async validate(accessToken: string) {
    try {
      // Get user info from Feishu API
      const response = await axios.get('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userInfo = response.data.data;
      if (!userInfo || !userInfo.user_id) {
        throw new Error('Invalid user info from Feishu');
      }

      const externalId = userInfo.user_id;

      // Get enterprise info from Feishu API
      let enterpriseInfo;
      try {
        const tenantResponse = await axios.get('https://open.feishu.cn/open-apis/tenant/v2/tenant/info', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const tenantInfo = tenantResponse.data.data;
        if (tenantInfo) {
          enterpriseInfo = {
            name: tenantInfo.tenant_name,
            externalId: tenantInfo.tenant_key,
            domain: tenantInfo.tenant_domain || undefined,
          };
        }
      } catch (error) {
        console.warn('Failed to get enterprise info from Feishu:', error);
        // Continue without enterprise info if API call fails
      }

      // Validate or create user with enterprise info
      const user = await this.authService.validateUser(externalId, 'feishu', enterpriseInfo);
      return user;
    } catch (error) {
      console.error('Feishu OAuth2 validation error:', error);
      throw new Error('Failed to validate Feishu user');
    }
  }
}
