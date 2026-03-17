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
import { FeishuService } from './services/feishu.service';
import type { Request, Response } from 'express';

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

  constructor(
    private readonly authService: AuthService,
    private readonly feishuService: FeishuService,
  ) {}

  @Get('feishu')
  async feishuLogin(@Res() res: Response) {
    const clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
    const callbackUrl =
      process.env.FEISHU_CALLBACK_URL ||
      'http://localhost:3001/api/v1/auth/feishu/callback';

    const authUrl = this.feishuService.buildAuthUrl(clientId, callbackUrl);
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

      const clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
      const clientSecret =
        process.env.FEISHU_CLIENT_SECRET || 'your-feishu-client-secret';

      // Get access token and openId using FeishuService
      const { accessToken, openId } = await this.feishuService.getAccessToken(
        code,
        clientId,
        clientSecret,
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

  // Development only: Test login endpoint
  @Get('dev-login')
  async devLogin(@Res() res: Response) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).send('Not available in production');
    }

    try {
      // Find or create a test user
      const testUser = await this.authService.validateUser({
        externalId: 'dev-test-user',
        provider: 'dev',
        name: 'Test User',
        email: 'test@example.com',
      });

      const loginResult = await this.authService.login({
        ...testUser,
        name: testUser?.name ?? undefined,
      });

      // Redirect to frontend with token
      // Support multiple possible frontend URLs
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5175';
      res.redirect(
        `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
      );
    } catch (error) {
      this.logger.error('Dev login error:', error);
      return res.status(500).send('Login failed');
    }
  }
}
