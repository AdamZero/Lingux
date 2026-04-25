import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Req,
  Res,
  Logger,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { FeishuService } from './services/feishu.service';
import type { Request, Response } from 'express';
import { AuthUser } from './types/auth.types';
import { PrismaService } from '../prisma.service';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly isDevelopment: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly feishuService: FeishuService,
    private readonly prisma: PrismaService,
  ) {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  @Get('feishu')
  async feishuLogin(@Res() res: Response) {
    const clientId = process.env.FEISHU_CLIENT_ID || 'your-feishu-client-id';
    const callbackUrl =
      process.env.FEISHU_CALLBACK_URL ||
      'http://localhost:3000/api/v1/auth/feishu/callback';

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
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
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
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).send('Authentication failed');
    }
    const loginResult = await this.authService.login(user);

    // Redirect to frontend with token (using hash fragment for better security)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
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
    const user = req.user as AuthUser;
    if (!user) {
      return res.status(401).send('Authentication failed');
    }
    const loginResult = await this.authService.login(user);

    // Redirect to frontend with token (using hash fragment for better security)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    res.redirect(
      `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {
    return req.user as AuthUser;
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

  /**
   * 开发环境快速登录接口
   * 仅用于开发和测试环境，允许直接通过用户名登录，无需OAuth授权
   */
  @Get('dev-login')
  async devLogin(@Query('username') username: string, @Res() res: Response) {
    // 只允许在开发环境使用
    if (!this.isDevelopment) {
      throw new ForbiddenException(
        'Dev login is only available in development mode',
      );
    }

    try {
      // 如果没有提供用户名，默认使用第一个演示管理员
      const targetUsername = username || 'admin@demo';

      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { username: targetUsername },
      });

      if (!user) {
        this.logger.error(`Dev login failed: User ${targetUsername} not found`);
        return res
          .status(404)
          .send(
            `User ${targetUsername} not found. Please run seed script first.`,
          );
      }

      this.logger.log(`Dev login: ${user.username} (${user.role})`);

      // 生成登录token
      const loginResult = await this.authService.login({
        id: user.id,
        username: user.username,
        name: user.name ?? undefined,
        role: user.role,
      });

      // 重定向到前端，带上token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      res.redirect(
        `${frontendUrl}/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
      );
    } catch (error) {
      this.logger.error('Dev login error:', error);
      return res.status(500).send('Dev login failed');
    }
  }

  /**
   * 开发环境快速登录 - 返回JSON格式（用于API调用）
   * 仅用于开发和测试环境
   */
  @Get('dev-login/json')
  async devLoginJson(@Query('username') username: string) {
    // 只允许在开发环境使用
    if (!this.isDevelopment) {
      throw new ForbiddenException(
        'Dev login is only available in development mode',
      );
    }

    try {
      const targetUsername = username || 'admin@demo';

      const user = await this.prisma.user.findUnique({
        where: { username: targetUsername },
      });

      if (!user) {
        throw new UnauthorizedException(`User ${targetUsername} not found`);
      }

      this.logger.log(`Dev login (JSON): ${user.username} (${user.role})`);

      return await this.authService.login({
        id: user.id,
        username: user.username,
        name: user.name ?? undefined,
        role: user.role,
      });
    } catch (error) {
      this.logger.error('Dev login JSON error:', error);
      throw error;
    }
  }
}
