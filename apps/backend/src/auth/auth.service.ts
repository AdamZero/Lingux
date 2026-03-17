import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { WinstonLoggerService } from '../common/logger/logger.service';

interface UserInfo {
  externalId: string;
  provider: string;
  name?: string;
  email?: string;
  avatar?: string;
  mobile?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly enterpriseService: EnterpriseService,
    private readonly logger: WinstonLoggerService,
  ) {}

  async validateUser(
    userInfo: UserInfo,
    enterpriseInfo?: {
      name: string;
      externalId: string;
      domain?: string;
    },
  ) {
    const { externalId, provider, name, email, avatar, mobile } = userInfo;

    try {
      let user = await this.prisma.user.findUnique({
        where: { externalId },
      });

      // 生成 username：优先使用 name（清理空格），否则使用 provider_externalId 格式
      const sanitizedName = name?.replace(/\s+/g, '_');
      const username = sanitizedName || `${provider}_${externalId}`;

      if (!user) {
        // Create new user if not exists
        user = await this.prisma.user.create({
          data: {
            username,
            name,
            email,
            avatar,
            mobile,
            externalId,
            provider,
            role: 'EDITOR', // Default role
          },
        });
      } else {
        // Update user info if exists (to sync latest info from provider)
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            username,
            name: name ?? user.name,
            email: email ?? user.email,
            avatar: avatar ?? user.avatar,
            mobile: mobile ?? user.mobile,
            provider,
          },
        });
      }

      // Handle enterprise association if enterprise info is provided
      if (enterpriseInfo) {
        const enterprise = await this.enterpriseService.createOrGetEnterprise(
          enterpriseInfo.name,
          enterpriseInfo.externalId,
          provider,
          enterpriseInfo.domain,
        );

        // Check if this is the first user for the enterprise (should be admin)
        const existingMembers =
          await this.enterpriseService.getEnterpriseMembers(enterprise.id);
        const role = existingMembers.length === 0 ? 'admin' : 'member';

        // Associate user with enterprise
        await this.enterpriseService.associateUserWithEnterprise(
          user.id,
          enterprise.id,
          role,
        );
      }

      return user;
    } catch (error) {
      this.logger.error(
        'User validation error',
        error instanceof Error ? error.stack : undefined,
        { externalId, provider },
      );
      throw new Error('Failed to validate or create user');
    }
  }

  async login(user: {
    id: string;
    username: string;
    name?: string;
    role: string;
  }) {
    try {
      const payload = {
        sub: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      this.logger.error(
        'Login error',
        error instanceof Error ? error.stack : undefined,
        { userId: user.id, username: user.username },
      );
      throw new Error('Failed to generate access token');
    }
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
