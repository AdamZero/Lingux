import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

@Injectable()
export class DingTalkStrategy extends PassportStrategy(Strategy, 'dingtalk') {
  constructor(private readonly authService: AuthService) {
    super({
      authorizationURL:
        'https://oapi.dingtalk.com/connect/oauth2/sns_authorize',
      tokenURL: 'https://oapi.dingtalk.com/sns/gettoken',
      clientID: process.env.DINGTALK_CLIENT_ID || 'your-dingtalk-client-id',
      clientSecret:
        process.env.DINGTALK_CLIENT_SECRET || 'your-dingtalk-client-secret',
      callbackURL:
        process.env.DINGTALK_CALLBACK_URL ||
        'http://localhost:3001/auth/dingtalk/callback',
      scope: 'snsapi_login',
    });
  }

  async validate(accessToken: string) {
    try {
      // Get user info from DingTalk API
      const response = await axios.get('https://oapi.dingtalk.com/sns/getuserinfo', {
        params: {
          access_token: accessToken,
        },
      });

      const userInfo = response.data.user_info;
      if (!userInfo || !userInfo.openid) {
        throw new Error('Invalid user info from DingTalk');
      }

      const externalId = userInfo.openid;

      // Get enterprise info from DingTalk API
      let enterpriseInfo;
      try {
        // Note: DingTalk API might require different endpoints or parameters
        // This is a placeholder implementation
        // You may need to adjust based on actual DingTalk API documentation
        const corpid = process.env.DINGTALK_CLIENT_ID;
        const corpsecret = process.env.DINGTALK_CLIENT_SECRET;
        
        // Get access token for enterprise API
        const tokenResponse = await axios.get('https://oapi.dingtalk.com/gettoken', {
          params: {
            corpid,
            corpsecret,
          },
        });

        const enterpriseToken = tokenResponse.data.access_token;
        
        // Get enterprise info
        const companyResponse = await axios.get('https://oapi.dingtalk.com/corp/getcorpinfo', {
          params: {
            access_token: enterpriseToken,
          },
        });

        const companyInfo = companyResponse.data;
        if (companyInfo && companyInfo.errcode === 0) {
          enterpriseInfo = {
            name: companyInfo.name,
            externalId: corpid,
            domain: companyInfo.domain || undefined,
          };
        }
      } catch (error) {
        console.warn('Failed to get enterprise info from DingTalk:', error);
        // Continue without enterprise info if API call fails
      }

      // Validate or create user with enterprise info
      const user = await this.authService.validateUser(externalId, 'dingtalk', enterpriseInfo);
      return user;
    } catch (error) {
      console.error('DingTalk OAuth2 validation error:', error);
      throw new Error('Failed to validate DingTalk user');
    }
  }
}
