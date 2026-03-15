import { Controller, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';

// Define user type
interface User {
  id: string;
  username: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('feishu')
  @UseGuards(AuthGuard('feishu'))
  async feishuLogin() {
    // This route will redirect to Feishu's authorization page
  }

  @Get('feishu/callback')
  @UseGuards(AuthGuard('feishu'))
  async feishuCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as User;
    if (!user) {
      return res.status(401).send('Authentication failed');
    }
    const loginResult = await this.authService.login(user);
    
    // Redirect to frontend with token (using hash fragment for better security)
    res.redirect(
      `http://localhost:3000/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
    );
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
    res.redirect(
      `http://localhost:3000/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
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
    res.redirect(
      `http://localhost:3000/login#token=${loginResult.access_token}&user=${JSON.stringify(loginResult.user)}`,
    );
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getProfile(@Req() req: Request) {
    return req.user as User;
  }
}
