import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Enterprise, EnterpriseMember } from '@prisma/client';

@Injectable()
export class EnterpriseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建或获取企业
   * @param name 企业名称
   * @param externalId 外部平台企业ID
   * @param platform 平台类型
   * @param domain 企业域名
   * @returns 企业对象
   */
  async createOrGetEnterprise(
    name: string,
    externalId: string,
    platform: string,
    domain?: string,
  ): Promise<Enterprise> {
    // 优先通过外部ID查找企业
    let enterprise = await this.prisma.enterprise.findFirst({
      where: { externalId },
    });

    // 如果没有找到，通过域名查找
    if (!enterprise && domain) {
      enterprise = await this.prisma.enterprise.findFirst({
        where: { domain },
      });
    }

    // 如果仍然没有找到，创建新企业
    if (!enterprise) {
      enterprise = await this.prisma.enterprise.create({
        data: {
          name,
          externalId,
          platform,
          domain,
        },
      });
    }

    return enterprise;
  }

  /**
   * 将用户关联到企业
   * @param userId 用户ID
   * @param enterpriseId 企业ID
   * @param role 角色（admin 或 member）
   * @returns 企业成员对象
   */
  async associateUserWithEnterprise(
    userId: string,
    enterpriseId: string,
    role: string = 'member',
  ): Promise<EnterpriseMember> {
    // 检查用户是否已经关联到企业
    let member = await this.prisma.enterpriseMember.findFirst({
      where: {
        userId,
        enterpriseId,
      },
    });

    if (member) {
      // 如果已经关联，更新角色
      member = await this.prisma.enterpriseMember.update({
        where: {
          id: member.id,
        },
        data: {
          role,
        },
      });
    } else {
      // 如果没有关联，创建新的关联
      member = await this.prisma.enterpriseMember.create({
        data: {
          userId,
          enterpriseId,
          role,
        },
      });
    }

    return member;
  }

  /**
   * 获取用户所属的企业
   * @param userId 用户ID
   * @returns 企业成员列表
   */
  async getUserEnterprises(userId: string) {
    return this.prisma.enterpriseMember.findMany({
      where: { userId },
      include: {
        Enterprise: true,
      },
    });
  }

  /**
   * 获取企业详情
   * @param enterpriseId 企业ID
   * @returns 企业对象
   */
  async getEnterpriseById(enterpriseId: string) {
    const enterprise = await this.prisma.enterprise.findUnique({
      where: { id: enterpriseId },
    });

    if (!enterprise) {
      throw new NotFoundException(
        `Enterprise with ID ${enterpriseId} not found`,
      );
    }

    return enterprise;
  }

  /**
   * 获取企业成员列表
   * @param enterpriseId 企业ID
   * @returns 企业成员列表
   */
  async getEnterpriseMembers(enterpriseId: string) {
    return this.prisma.enterpriseMember.findMany({
      where: { enterpriseId },
      include: {
        User: true,
      },
    });
  }
}
