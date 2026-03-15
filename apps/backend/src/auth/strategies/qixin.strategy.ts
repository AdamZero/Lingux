import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

@Injectable()
export class QixinStrategy extends PassportStrategy(Strategy, 'qixin') {
  constructor(private readonly authService: AuthService) {
    super({
      authorizationURL: 'https://open.qixin.com/oauth2/authorize',
      tokenURL: 'https://open.qixin.com/oauth2/token',
      clientID: process.env.QIXIN_CLIENT_ID || 'your-qixin-client-id',
      clientSecret:
        process.env.QIXIN_CLIENT_SECRET || 'your-qixin-client-secret',
      callbackURL:
        process.env.QIXIN_CALLBACK_URL ||
        'http://localhost:3001/auth/qixin/callback',
      scope: 'user_info',
    });
  }

  async validate(accessToken: string) {
    try {
      // Get user info from Qixin API
      const response = await axios.get('https://open.qixin.com/api/v1/user/info', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const userInfo = response.data.data;
      if (!userInfo || !userInfo.user_id) {
        throw new Error('Invalid user info from Qixin');
      }

      const externalId = userInfo.user_id;

      // Get enterprise info from Qixin API
      let enterpriseInfo;
      try {
        const companyResponse = await axios.get('https://open.qixin.com/api/v1/company/info', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const companyInfo = companyResponse.data.data;
        if (companyInfo) {
          enterpriseInfo = {
            name: companyInfo.company_name,
            externalId: companyInfo.company_id,
            domain: companyInfo.company_domain || undefined,
          };
        }
      } catch (error) {
        console.warn('Failed to get enterprise info from Qixin:', error);
        // Continue without enterprise info if API call fails
      }

      // Validate or create user with enterprise info
      const user = await this.authService.validateUser(externalId, 'qixin', enterpriseInfo);
      return user;
    } catch (error) {
      console.error('Qixin OAuth2 validation error:', error);
      throw new Error('Failed to validate Qixin user');
    }
  }
}
