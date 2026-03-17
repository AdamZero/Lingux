import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { AuthService } from '../auth.service';
import axios from 'axios';

interface DingTalkUserInfo {
  errcode: number;
  errmsg: string;
  user_info: {
    openid: string;
    unionid?: string;
    nick?: string;
    avatar_url?: string;
    email?: string;
    mobile?: string;
  };
}

@Injectable()
export class DingTalkStrategy extends PassportStrategy(Strategy, 'dingtalk') {
  private readonly logger = new Logger(DingTalkStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({
      authorizationURL:
        'https://oapi.dingtalk.com/connect/oauth2/sns_authorize',
      tokenURL: 'https://oapi.dingtalk.com/sns/gettoken',
      clientID: process.env.DINGTALK_CLIENT_ID || 'your-dingtalk-client-id',
      clientSecret:
        process.env.DINGTALK_CLIENT_SECRET || 'your-dingtalk-client-secret',
      callbackURL:
        process.env.DINGTALK_CALLBACK_URL || '/auth/dingtalk/callback',
      scope: 'snsapi_login',
    });
  }

  async validate(accessToken: string) {
    try {
      // Get user info from DingTalk API
      const response = await axios.get(
        'https://oapi.dingtalk.com/sns/getuserinfo',
        {
          params: {
            access_token: accessToken,
          },
        },
      );

      const userInfo = response.data as DingTalkUserInfo;
      if (!userInfo.user_info || !userInfo.user_info.openid) {
        throw new Error('Invalid user info from DingTalk');
      }

      const { openid, nick, avatar_url, email, mobile } = userInfo.user_info;

      // Get enterprise info from DingTalk API
      let enterpriseInfo;
      try {
        const corpid = process.env.DINGTALK_CLIENT_ID;
        const corpsecret = process.env.DINGTALK_CLIENT_SECRET;

        // Get access token for enterprise API
        const tokenResponse = await axios.get(
          'https://oapi.dingtalk.com/gettoken',
          {
            params: {
              corpid,
              corpsecret,
            },
          },
        );

        const enterpriseToken = tokenResponse.data.access_token;

        // Get enterprise info
        const companyResponse = await axios.get(
          'https://oapi.dingtalk.com/corp/getcorpinfo',
          {
            params: {
              access_token: enterpriseToken,
            },
          },
        );

        const companyInfo = companyResponse.data;
        if (companyInfo && companyInfo.errcode === 0) {
          enterpriseInfo = {
            name: companyInfo.name,
            externalId: corpid,
            domain: companyInfo.domain || undefined,
          };
        }
      } catch (error) {
        this.logger.warn('Failed to get enterprise info from DingTalk:', error);
      }

      // Validate or create user with enterprise info
      const user = await this.authService.validateUser(
        {
          externalId: openid,
          provider: 'dingtalk',
          name: nick,
          email,
          avatar: avatar_url,
          mobile,
        },
        enterpriseInfo,
      );
      return user;
    } catch (error) {
      this.logger.error('DingTalk OAuth2 validation error:', error);
      throw new Error('Failed to validate DingTalk user');
    }
  }
}
