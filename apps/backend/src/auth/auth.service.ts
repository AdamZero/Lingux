import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EnterpriseService } from '../enterprise/enterprise.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly enterpriseService: EnterpriseService,
  ) {}

  async validateUser(externalId: string, provider: string, enterpriseInfo?: {
    name: string;
    externalId: string;
    domain?: string;
  }) {
    try {
      let user = await this.prisma.user.findUnique({
        where: { externalId },
      });

      if (!user) {
        // Create new user if not exists
        user = await this.prisma.user.create({
          data: {
            username: `${provider}_${externalId}`,
            externalId,
            role: 'EDITOR', // Default role
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
        const existingMembers = await this.enterpriseService.getEnterpriseMembers(enterprise.id);
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
      console.error('User validation error:', error);
      throw new Error('Failed to validate or create user');
    }
  }

  async login(user: { id: string; username: string; role: string }) {
    try {
      const payload = {
        sub: user.id,
        username: user.username,
        role: user.role,
      };

      return {
        access_token: this.jwtService.sign(payload),
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      };
    } catch (error) {
      console.error('Login error:', error);
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
