import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { EnterpriseModule } from '../enterprise/enterprise.module';
import { PrismaModule } from '../prisma.module';

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
};

describe('AuthController', () => {
  let authController: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PassportModule,
        JwtModule.register({
          secret: 'test_secret',
          signOptions: { expiresIn: '60s' },
        }),
        EnterpriseModule,
        PrismaModule,
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('feishuCallback', () => {
    it('should redirect with token when authentication succeeds', async () => {
      const user = {
        id: '1',
        username: 'feishu_user',
        role: 'EDITOR',
      };

      const loginResult = {
        access_token: 'test_token',
        user: user,
      };

      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        user: {
          externalId: 'external_123',
          provider: 'feishu',
          enterpriseInfo: {
            name: 'Test Enterprise',
            externalId: 'ent_123',
            domain: 'test.com',
          },
        },
      };

      const res = {
        redirect: jest.fn(),
      };

      await authController.feishuCallback(req as any, res as any);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'external_123',
        'feishu',
        {
          name: 'Test Enterprise',
          externalId: 'ent_123',
          domain: 'test.com',
        },
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?token=test_token',
      );
    });
  });

  describe('qixinCallback', () => {
    it('should redirect with token when authentication succeeds', async () => {
      const user = {
        id: '1',
        username: 'qixin_user',
        role: 'EDITOR',
      };

      const loginResult = {
        access_token: 'test_token',
        user: user,
      };

      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        user: {
          externalId: 'external_456',
          provider: 'qixin',
          enterpriseInfo: {
            name: 'Qixin Enterprise',
            externalId: 'ent_456',
          },
        },
      };

      const res = {
        redirect: jest.fn(),
      };

      await authController.qixinCallback(req as any, res as any);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'external_456',
        'qixin',
        {
          name: 'Qixin Enterprise',
          externalId: 'ent_456',
        },
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?token=test_token',
      );
    });
  });

  describe('dingtalkCallback', () => {
    it('should redirect with token when authentication succeeds', async () => {
      const user = {
        id: '1',
        username: 'dingtalk_user',
        role: 'EDITOR',
      };

      const loginResult = {
        access_token: 'test_token',
        user: user,
      };

      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        user: {
          externalId: 'external_789',
          provider: 'dingtalk',
          enterpriseInfo: {
            name: 'DingTalk Enterprise',
            externalId: 'ent_789',
          },
        },
      };

      const res = {
        redirect: jest.fn(),
      };

      await authController.dingTalkCallback(req as any, res as any);

      expect(mockAuthService.validateUser).toHaveBeenCalledWith(
        'external_789',
        'dingtalk',
        {
          name: 'DingTalk Enterprise',
          externalId: 'ent_789',
        },
      );
      expect(mockAuthService.login).toHaveBeenCalledWith(user);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/login?token=test_token',
      );
    });
  });
});
