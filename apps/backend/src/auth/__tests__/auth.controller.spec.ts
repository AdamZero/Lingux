import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { FeishuService } from '../services/feishu.service';
import { PrismaService } from '../../prisma.service';
import type { Request, Response } from 'express';

// Mock Logger
import { Logger } from '@nestjs/common';
jest.mock('@nestjs/common', () => ({
  ...jest.requireActual('@nestjs/common'),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
  })),
}));

// Mock the static methods of Logger
(Logger as any).overrideLogger = jest.fn();
(Logger as any).getLogger = jest.fn().mockReturnValue({
  log: jest.fn(),
  error: jest.fn(),
});

describe('AuthController', () => {
  let authController: AuthController;
  let authService: jest.Mocked<AuthService>;
  let feishuService: jest.Mocked<FeishuService>;
  let mockResponse: jest.Mocked<Response>;

  beforeEach(async () => {
    // Mock AuthService
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      validateToken: jest.fn(),
    } as any;

    // Mock FeishuService
    feishuService = {
      buildAuthUrl: jest.fn(),
      getAccessToken: jest.fn(),
      getUserInfo: jest.fn(),
    } as any;

    // Mock Response
    mockResponse = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        {
          provide: FeishuService,
          useValue: feishuService,
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('feishuLogin', () => {
    it('should redirect to Feishu authorization page', async () => {
      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CALLBACK_URL =
        'http://localhost:3000/api/v1/auth/feishu/callback';

      const expectedAuthUrl =
        'https://open.feishu.cn/open-apis/authen/v1/index?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Ffeishu%2Fcallback&scope=user_info&response_type=code';
      feishuService.buildAuthUrl.mockReturnValue(expectedAuthUrl);

      await authController.feishuLogin(mockResponse);

      expect(feishuService.buildAuthUrl).toHaveBeenCalledWith(
        'test-client-id',
        'http://localhost:3000/api/v1/auth/feishu/callback',
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(expectedAuthUrl);
    });
  });

  describe('feishuCallback', () => {
    it('should return 400 if no code is provided', async () => {
      const mockRequest = { query: {} } as unknown as Request;

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Missing authorization code',
      );
    });

    it('should return 500 if Feishu API returns error', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock FeishuService to throw error
      feishuService.getAccessToken.mockRejectedValue(
        new Error('Feishu authentication error: code is invalid'),
      );

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal server error');
    });

    it('should return 500 if no open_id is returned', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock FeishuService to return empty openId
      feishuService.getAccessToken.mockResolvedValue({
        accessToken: '',
        openId: '',
      });
      // Mock getUserInfo to throw error when accessToken is empty
      feishuService.getUserInfo.mockRejectedValue(
        new Error('Invalid access token'),
      );

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal server error');
    });

    it('should redirect to frontend with token on success', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;
      const mockUser = {
        id: '123',
        username: 'feishu_user',
        name: 'Test User',
        role: 'EDITOR' as any,
        email: null,
        externalId: 'test-open-id',
        avatar: null,
        mobile: null,
        provider: 'feishu',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockLoginResult = {
        access_token: 'test-token',
        user: {
          id: mockUser.id,
          username: mockUser.username,
          name: mockUser.name,
          role: mockUser.role,
        },
      };

      // Mock FeishuService
      feishuService.getAccessToken.mockResolvedValue({
        accessToken: 'test-access-token',
        openId: 'test-open-id',
      });
      feishuService.getUserInfo.mockResolvedValue({
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '1234567890',
      });

      // Mock AuthService methods
      authService.validateUser.mockResolvedValueOnce(mockUser);
      authService.login.mockResolvedValueOnce(mockLoginResult);

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';
      process.env.FRONTEND_URL = 'http://localhost:8080';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(feishuService.getAccessToken).toHaveBeenCalledWith(
        'test-code',
        'test-client-id',
        'test-client-secret',
      );
      expect(authService.validateUser).toHaveBeenCalledWith({
        externalId: 'test-open-id',
        provider: 'feishu',
        name: 'Test User',
        email: 'test@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '1234567890',
      });
      expect(authService.login).toHaveBeenCalledWith({
        ...mockUser,
        name: mockUser.name ?? undefined,
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `http://localhost:8080/login#token=test-token&user=${JSON.stringify(mockLoginResult.user)}`,
      );
    });

    it('should return 500 on internal error', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock FeishuService to throw unexpected error
      feishuService.getAccessToken.mockRejectedValue(
        new Error('Network error'),
      );

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal server error');
    });
  });
});
