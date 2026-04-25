import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FeishuService } from './services/feishu.service';
import { PrismaService } from '../prisma.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { WinstonLoggerService } from '../common/logger/logger.service';

const mockAuthService = {
  validateUser: jest.fn(),
  login: jest.fn(),
};

const mockFeishuService = {
  buildAuthUrl: jest.fn(),
  getAccessToken: jest.fn(),
  getUserInfo: jest.fn(),
};

const mockPrismaService = {};

const mockLoggerService = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
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
      ],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: FeishuService,
          useValue: mockFeishuService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: WinstonLoggerService,
          useValue: mockLoggerService,
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
        name: 'Test User',
        role: 'EDITOR',
      };

      const loginResult = {
        access_token: 'test_token',
        user: user,
      };

      // Mock FeishuService
      mockFeishuService.getAccessToken.mockResolvedValue({
        accessToken: 'test-access-token',
        openId: 'external_123',
      });
      mockFeishuService.getUserInfo.mockResolvedValue({
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '1234567890',
      });

      mockAuthService.validateUser.mockResolvedValue(user);
      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        query: { code: 'test-code' },
      };

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';
      process.env.FRONTEND_URL = 'http://localhost:8080';

      await authController.feishuCallback(req as any, res as any);

      expect(mockFeishuService.getAccessToken).toHaveBeenCalledWith(
        'test-code',
        'test-client-id',
        'test-client-secret',
      );
      expect(mockAuthService.validateUser).toHaveBeenCalledWith({
        externalId: 'external_123',
        provider: 'feishu',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '1234567890',
      });
      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...user,
        name: user.name ?? undefined,
      });
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:8080/login#token=test_token&user={"id":"1","username":"feishu_user","name":"Test User","role":"EDITOR"}',
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

      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        user: {
          id: '1',
          username: 'qixin_user',
          role: 'EDITOR',
        },
      };

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      process.env.FRONTEND_URL = 'http://localhost:8080';

      await authController.qixinCallback(req as any, res as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(req.user);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:8080/login#token=test_token&user={"id":"1","username":"qixin_user","role":"EDITOR"}',
      );
    });
  });

  describe('dingTalkCallback', () => {
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

      mockAuthService.login.mockResolvedValue(loginResult);

      const req = {
        user: {
          id: '1',
          username: 'dingtalk_user',
          role: 'EDITOR',
        },
      };

      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      process.env.FRONTEND_URL = 'http://localhost:8080';

      await authController.dingTalkCallback(req as any, res as any);

      expect(mockAuthService.login).toHaveBeenCalledWith(req.user);
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:8080/login#token=test_token&user={"id":"1","username":"dingtalk_user","role":"EDITOR"}',
      );
    });
  });
});
