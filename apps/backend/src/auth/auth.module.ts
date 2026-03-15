import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PrismaModule } from '../prisma.module';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { FeishuStrategy } from './strategies/feishu.strategy';
import { QixinStrategy } from './strategies/qixin.strategy';
import { DingTalkStrategy } from './strategies/dingtalk.strategy';

@Module({
  imports: [
    PrismaModule,
    EnterpriseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: {
        expiresIn: '24h',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    FeishuStrategy,
    QixinStrategy,
    DingTalkStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
