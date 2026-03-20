import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import type { Request, Response } from 'express';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockAxios = axios as jest.Mocked<typeof axios>;

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
  let mockResponse: jest.Mocked<Response>;

  beforeEach(async () => {
    // Mock AuthService
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      validateToken: jest.fn(),
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

      await authController.feishuLogin(mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'https://open.feishu.cn/open-apis/authen/v1/index?client_id=test-client-id&redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fv1%2Fauth%2Ffeishu%2Fcallback&scope=user_info&response_type=code',
      );
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

    it('should return 401 if Feishu API returns error', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock axios to return Feishu API error
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          code: 20003,
          msg: 'code is invalid',
        },
      } as any);

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Feishu authentication error: code is invalid',
      );
    });

    it('should return 401 if no open_id is returned', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock axios to return success but no open_id
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          msg: 'success',
          data: {},
        },
      } as any);

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.send).toHaveBeenCalledWith(
        'Failed to get user information from Feishu',
      );
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

      // Mock axios to return success
      mockAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          msg: 'success',
          data: {
            access_token: 'test-access-token',
            open_id: 'test-open-id',
          },
        },
      } as any);

      // Mock AuthService methods
      authService.validateUser.mockResolvedValueOnce(mockUser);
      authService.login.mockResolvedValueOnce(mockLoginResult);

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(authService.validateUser).toHaveBeenCalledWith(
        'test-open-id',
        'feishu',
      );
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        `/login#token=test-token&user=${JSON.stringify(mockUser)}`,
      );
    });

    it('should return 500 on internal error', async () => {
      const mockRequest = {
        query: { code: 'test-code' },
      } as unknown as Request;

      // Mock axios to throw error
      mockAxios.post.mockRejectedValueOnce(new Error('Network error'));

      // Set up environment variables
      process.env.FEISHU_CLIENT_ID = 'test-client-id';
      process.env.FEISHU_CLIENT_SECRET = 'test-client-secret';

      await authController.feishuCallback(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.send).toHaveBeenCalledWith('Internal server error');
    });
  });
});
