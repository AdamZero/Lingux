import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import axios from 'axios';

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

// Define user type
interface User {
  id: string;
  username: string;
  name?: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Get('feishu')
  async feishuLogin(@Res() res: Response) {
    const clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
    const callbackUrl =
      process.env.FEISHU_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/feishu/callback';
    const scope = 'user_info';

    // Redirect to Feishu's authorization page
    const authUrl = `https://open.feishu.cn/open-apis/authen/v1/index?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${scope}&response_type=code`;
    res.redirect(authUrl);
  }

  @Get('feishu/callback')
  async feishuCallback(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.log('Feishu callback received');
      const code = req.query.code as string;
      if (!code) {
        this.logger.error('No code provided in callback');
        return res.status(400).send('Missing authorization code');
      }

      // Request access token from Feishu API
      const tokenUrl =
        'https://open.feishu.cn/open-apis/authen/v1/access_token';
      const clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
      const clientSecret =
        process.env.FEISHU_CLIENT_SECRET || 'your-feishu-client-secret';

      this.logger.log('Requesting access token from:', tokenUrl);
      const tokenResponse = await axios.post(
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

      this.logger.log('Token response status:', tokenResponse.status);
      const tokenData = tokenResponse.data as FeishuTokenResponse;
      this.logger.log('Token response data:', tokenData);

      if (tokenData.code !== 0) {
        this.logger.error(
          'Feishu API error:',
          tokenData.msg || 'Unknown error',
        );
        return res
          .status(401)
          .send(
            `Feishu authentication error: ${tokenData.msg || 'Unknown error'}`,
          );
      }

      const accessToken = tokenData.data?.access_token;
      const openId = tokenData.data?.open_id;
      if (!accessToken || !openId) {
        this.logger.error('Failed to get access_token or open_id from Feishu');
        return res
          .status(401)
          .send('Failed to get user information from Feishu');
      }

      this.logger.log('Access token and OpenID obtained successfully');

      // 获取用户详细信息
      const userInfo = await this.getFeishuUserInfo(accessToken);
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
      this.logger.log('User object type:', typeof user);
      this.logger.log('User is null?:', user === null);
      this.logger.log('User is undefined?:', user === undefined);
      if (user) {
        this.logger.log('User.name:', user.name);
        this.logger.log('User.id:', user.id);
        this.logger.log('User.username:', user.username);
        this.logger.log('User.role:', user.role);
      }
      const loginResult = await this.authService.login({
        ...user,
        name: user?.name ?? undefined,
      });
      this.logger.log('Login result:', loginResult);

      // Redirect to frontend with token (using hash fragment for better security)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(
        `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
      );
    } catch (error) {
      this.logger.error('Feishu callback error:', error);
      return res.status(500).send('Internal server error');
    }
  }

  private async getFeishuUserInfo(accessToken: string): Promise<{
    name: string;
    email?: string;
    avatar?: string;
    mobile?: string;
  }> {
    const userInfoUrl = 'https://open.feishu.cn/open-apis/authen/v1/user_info';

    const response = await axios.get(userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = response.data as FeishuUserInfo;
    this.logger.log('Feishu user info response:', data);

    if (data.code !== 0) {
      this.logger.error('Failed to get user info:', data.msg);
      throw new Error(`Failed to get user info: ${data.msg}`);
    }

    // 检查 data.data 是否存在
    if (!data.data) {
      this.logger.error('Invalid user data structure:', data);
      throw new Error('Invalid user data structure from Feishu');
    }

    const user = data.data;
    this.logger.log('Raw user data from Feishu:', JSON.stringify(user));
    this.logger.log('User name:', user.name);
    this.logger.log('User en_name:', user.en_name);
    this.logger.log('User open_id:', user.open_id);
    this.logger.log('User email:', user.email);
    this.logger.log('User mobile:', user.mobile);
    this.logger.log('User avatar_url:', user.avatar_url);
    // 优先使用 name，如果没有则使用 en_name，如果都没有则使用 open_id 作为后备
    const name = user.name || user.en_name || user.open_id;
    this.logger.log('Final resolved name:', name);
    return {
      name,
      email: user.email,
      avatar: user.avatar_thumb || user.avatar_url,
      mobile: user.mobile,
    };
  }

  @Get('qixin')
  @UseGuards(AuthGuard('qixin'))
  async qixinLogin() {
    // This route will redirect to Qixin's authorization page
  }

  @Get('qixin/callback')
  @UseGuards(AuthGuard('qixin'))
  async qixinCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    if (!user) {
      return res.status(401).send('Authentication failed');
    }
    const loginResult = await this.authService.login(user);

    // Redirect to frontend with token (using hash fragment for better security)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(
      `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
    );
  }

  @Get('dingtalk')
  @UseGuards(AuthGuard('dingtalk'))
  async dingTalkLogin() {
    // This route will redirect to DingTalk's authorization page
  }

  @Get('dingtalk/callback')
  @UseGuards(AuthGuard('dingtalk'))
  async dingTalkCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    if (!user) {
      return res.status(401).send('Authentication failed');
    }
    const loginResult = await this.authService.login(user);

    // Redirect to frontend with token (using hash fragment for better security)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(
      `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {
    return req.user as User;
  }

  @Post('feishu/log')
  async feishuLog(@Req() req: Request) {
    try {
      this.logger.log('Feishu log received');
      this.logger.log('Request body:', req.body, req.headers);
      return { status: 'success', message: 'Log received' };
    } catch (error) {
      this.logger.error('Feishu log error:', error);
      return { status: 'error', message: 'Failed to log request' };
    }
  }
}
