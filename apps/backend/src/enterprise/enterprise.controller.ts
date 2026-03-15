import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { EnterpriseService } from './enterprise.service';
import type { Request } from 'express';

@Controller('api/enterprises')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  /**
   * 获取当前用户所属的企业
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getUserEnterprises(@Req() req: Request) {
    const userId = (req.user as any)['sub'];
    return this.enterpriseService.getUserEnterprises(userId);
  }

  /**
   * 获取企业详情
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async getEnterpriseById(@Req() req: Request) {
    const enterpriseId = req.params['id'];
    return this.enterpriseService.getEnterpriseById(enterpriseId);
  }

  /**
   * 获取企业成员列表
   */
  @Get(':id/members')
  @UseGuards(AuthGuard('jwt'))
  async getEnterpriseMembers(@Req() req: Request) {
    const enterpriseId = req.params['id'];
    return this.enterpriseService.getEnterpriseMembers(enterpriseId);
  }
}
