import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

interface QixinUserInfo {
  data?: {
    user_id: string;
    name?: string;
    email?: string;
    mobile?: string;
    avatar?: string;
  };
}

interface QixinCompanyInfo {
  data?: {
    company_id: string;
    company_name: string;
    company_domain?: string;
  };
}

@Injectable()
export class QixinStrategy extends PassportStrategy(Strategy, 'qixin') {
  private readonly logger = new Logger(QixinStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      authorizationURL: 'https://open.qixin.com/oauth2/authorize',
      tokenURL: 'https://open.qixin.com/oauth2/token',
      clientID: process.env.QIXIN_CLIENT_ID || 'your-qixin-client-id',
      clientSecret:
        process.env.QIXIN_CLIENT_SECRET || 'your-qixin-client-secret',
      callbackURL: process.env.QIXIN_CALLBACK_URL || '/auth/qixin/callback',
      scope: 'user_info',
    });
  }

  async validate(accessToken: string) {
    try {
      // Get user info from Qixin API
      const response = await axios.get(
        'https://open.qixin.com/api/v1/user/info',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const userInfo = response.data as QixinUserInfo;
      if (!userInfo.data || !userInfo.data.user_id) {
        throw new Error('Invalid user info from Qixin');
      }

      const { user_id, name, email, mobile, avatar } = userInfo.data;

      // Get enterprise info from Qixin API
      let enterpriseInfo;
      try {
        const companyResponse = await axios.get(
          'https://open.qixin.com/api/v1/company/info',
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        const companyInfo = companyResponse.data as QixinCompanyInfo;
        if (companyInfo.data) {
          enterpriseInfo = {
            name: companyInfo.data.company_name,
            externalId: companyInfo.data.company_id,
            domain: companyInfo.data.company_domain || undefined,
          };
        }
      } catch (error) {
        this.logger.warn('Failed to get enterprise info from Qixin:', error);
      }

      // Validate or create user with enterprise info
      const user = await this.authService.validateUser(
        {
          externalId: user_id,
          provider: 'qixin',
          name,
          email,
          avatar,
          mobile,
        },
        enterpriseInfo,
      );
      return user;
    } catch (error) {
      this.logger.error('Qixin OAuth2 validation error:', error);
      throw new Error('Failed to validate Qixin user');
    }
  }
}
