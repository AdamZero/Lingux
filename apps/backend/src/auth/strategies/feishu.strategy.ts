import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

@Injectable()
export class FeishuStrategy extends PassportStrategy(Strategy, 'feishu') {
  private readonly logger = new Logger(FeishuStrategy.name);

  constructor(private readonly authService: AuthService) {
    const options: StrategyOptions = {
      authorizationURL: 'https://open.feishu.cn/open-apis/authen/v1/index',
      tokenURL: 'https://open.feishu.cn/open-apis/authen/v1/access_token',
      clientID: process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id',
      clientSecret: process.env.FEISHU_CLIENT_SECRET || 'your-feishu-client-secret',
      callbackURL: process.env.FEISHU_CALLBACK_URL,
      scope: 'user_info',
    };

    // Log configuration
    console.log('Feishu Strategy Configuration:', options);

    super(options);
  }

  async validate(accessToken: string) {
    try {
      this.logger.log('Feishu OAuth2 callback received');
      this.logger.log('Access token received (first 20 chars):', accessToken.substring(0, 20) + '...');
      
      // Get user info from Feishu API
      this.logger.log('Fetching user info from Feishu API');
      const response = await axios.get('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      this.logger.log('Feishu user info response:', response.data);
      
      const userInfo = response.data.data;
      if (!userInfo || !userInfo.user_id) {
        throw new Error('Invalid user info from Feishu');
      }

      const externalId = userInfo.user_id;
      this.logger.log('Feishu user ID:', externalId);

      // Get enterprise info from Feishu API
      let enterpriseInfo;
      try {
        this.logger.log('Fetching enterprise info from Feishu API');
        const tenantResponse = await axios.get('https://open.feishu.cn/open-apis/tenant/v2/tenant/info', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        this.logger.log('Feishu enterprise info response:', tenantResponse.data);
        
        const tenantInfo = tenantResponse.data.data;
        if (tenantInfo) {
          enterpriseInfo = {
            name: tenantInfo.tenant_name,
            externalId: tenantInfo.tenant_key,
            domain: tenantInfo.tenant_domain || undefined,
          };
          this.logger.log('Feishu enterprise info:', enterpriseInfo);
        }
      } catch (error) {
        this.logger.warn('Failed to get enterprise info from Feishu:', error);
        // Continue without enterprise info if API call fails
      }

      // Validate or create user with enterprise info
      this.logger.log('Validating or creating user');
      const user = await this.authService.validateUser(externalId, 'feishu', enterpriseInfo);
      this.logger.log('User validated:', user);
      
      return user;
    } catch (error) {
      this.logger.error('Feishu OAuth2 validation error:', error);
      throw new Error('Failed to validate Feishu user');
    }
  }
}
