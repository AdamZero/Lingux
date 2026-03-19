import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;
  let jwtService: any;
  let enterpriseService: any;
  let loggerService: any;

  beforeEach(() => {
    // Create fresh mocks for each test
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    };

    enterpriseService = {
      createOrGetEnterprise: jest.fn(),
      getEnterpriseMembers: jest.fn(),
      associateUserWithEnterprise: jest.fn(),
    };

    loggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    // Directly instantiate the service with mocks
    authService = new AuthService(
      prismaService as any,
      jwtService as any,
      enterpriseService as any,
      loggerService as any,
    );
  });

  describe('validateUser', () => {
    it('should return existing user when user exists', async () => {
      const existingUser = {
        id: '1',
        username: '张三',
        name: '张三',
        externalId: 'external_123',
        role: 'EDITOR',
      };

      prismaService.user.findUnique.mockResolvedValue(existingUser);

      const result = await authService.validateUser({
        externalId: 'external_123',
        provider: 'feishu',
        name: '张三',
      });

      expect(result).toEqual(existingUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'external_123' },
      });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });

    it('should update existing user with new info when user exists', async () => {
      const existingUser = {
        id: '1',
        username: '张三',
        name: '张三',
        email: 'old@example.com',
        externalId: 'external_123',
        role: 'EDITOR',
      };

      const updatedUser = {
        ...existingUser,
        email: 'new@example.com',
        avatar: 'https://example.com/avatar.png',
      };

      prismaService.user.findUnique.mockResolvedValue(existingUser);
      prismaService.user.update.mockResolvedValue(updatedUser);

      const result = await authService.validateUser({
        externalId: 'external_123',
        provider: 'feishu',
        name: '张三',
        email: 'new@example.com',
        avatar: 'https://example.com/avatar.png',
      });

      expect(result).toEqual(updatedUser);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          username: '张三',
          name: '张三',
          email: 'new@example.com',
          avatar: 'https://example.com/avatar.png',
          mobile: undefined,
          provider: 'feishu',
        },
      });
    });

    it('should create new user when user does not exist', async () => {
      const newUser = {
        id: '2',
        username: '张三',
        name: '张三',
        email: 'zhangsan@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '13800138000',
        externalId: 'external_456',
        provider: 'feishu',
        role: 'EDITOR',
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(newUser);

      const result = await authService.validateUser({
        externalId: 'external_456',
        provider: 'feishu',
        name: '张三',
        email: 'zhangsan@example.com',
        avatar: 'https://example.com/avatar.png',
        mobile: '13800138000',
      });

      expect(result).toEqual(newUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'external_456' },
      });
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: '张三',
          name: '张三',
          email: 'zhangsan@example.com',
          avatar: 'https://example.com/avatar.png',
          mobile: '13800138000',
          externalId: 'external_456',
          provider: 'feishu',
          role: 'EDITOR',
        },
      });
    });

    it('should use provider_externalId format when name is not provided', async () => {
      const newUser = {
        id: '2',
        username: 'feishu_external_456',
        name: undefined,
        externalId: 'external_456',
        provider: 'feishu',
        role: 'EDITOR',
      };

      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(newUser);

      const result = await authService.validateUser({
        externalId: 'external_456',
        provider: 'feishu',
      });

      expect(result).toEqual(newUser);
      expect(prismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: 'feishu_external_456',
          name: undefined,
          email: undefined,
          avatar: undefined,
          mobile: undefined,
          externalId: 'external_456',
          provider: 'feishu',
          role: 'EDITOR',
        },
      });
    });

    it('should associate user with enterprise when enterprise info is provided', async () => {
      const user = {
        id: '3',
        username: '张三',
        name: '张三',
        externalId: 'external_789',
        role: 'EDITOR',
      };

      const enterprise = {
        id: 'ent_1',
        name: 'Test Enterprise',
        externalId: 'ent_123',
        platform: 'feishu',
      };

      prismaService.user.findUnique.mockResolvedValue(user);
      enterpriseService.createOrGetEnterprise.mockResolvedValue(enterprise);
      enterpriseService.getEnterpriseMembers.mockResolvedValue([]);

      const result = await authService.validateUser(
        {
          externalId: 'external_789',
          provider: 'feishu',
          name: '张三',
        },
        {
          name: 'Test Enterprise',
          externalId: 'ent_123',
          domain: 'test.com',
        },
      );

      expect(result).toEqual(user);
      expect(enterpriseService.createOrGetEnterprise).toHaveBeenCalledWith(
        'Test Enterprise',
        'ent_123',
        'feishu',
        'test.com',
      );
      expect(enterpriseService.getEnterpriseMembers).toHaveBeenCalledWith(
        enterprise.id,
      );
      expect(
        enterpriseService.associateUserWithEnterprise,
      ).toHaveBeenCalledWith(user.id, enterprise.id, 'admin');
    });

    it('should assign member role when enterprise has existing members', async () => {
      const user = {
        id: '4',
        username: '张三',
        name: '张三',
        externalId: 'external_999',
        role: 'EDITOR',
      };

      const enterprise = {
        id: 'ent_1',
        name: 'Test Enterprise',
        externalId: 'ent_123',
        platform: 'feishu',
      };

      prismaService.user.findUnique.mockResolvedValue(user);
      enterpriseService.createOrGetEnterprise.mockResolvedValue(enterprise);
      enterpriseService.getEnterpriseMembers.mockResolvedValue([
        { id: '1', userId: '5', enterpriseId: 'ent_1', role: 'admin' },
      ]);

      await authService.validateUser(
        {
          externalId: 'external_999',
          provider: 'feishu',
          name: '张三',
        },
        {
          name: 'Test Enterprise',
          externalId: 'ent_123',
        },
      );

      expect(
        enterpriseService.associateUserWithEnterprise,
      ).toHaveBeenCalledWith(user.id, enterprise.id, 'member');
    });

    it('should throw error when validation fails', async () => {
      prismaService.user.findUnique.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(
        authService.validateUser({
          externalId: 'external_123',
          provider: 'feishu',
        }),
      ).rejects.toThrow('Failed to validate or create user');
    });
  });

  describe('login', () => {
    it('should generate access token and return user info', async () => {
      const user = {
        id: '1',
        username: '张三',
        name: '张三',
        role: 'EDITOR',
      };

      const mockToken = 'mock_jwt_token';
      jwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(user);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      });
    });

    it('should throw error when token generation fails', async () => {
      const user = {
        id: '1',
        username: '张三',
        name: '张三',
        role: 'EDITOR',
      };

      jwtService.sign.mockImplementation(() => {
        throw new Error('Token generation error');
      });

      await expect(authService.login(user)).rejects.toThrow(
        'Failed to generate access token',
      );
    });
  });

  describe('validateToken', () => {
    it('should return payload when token is valid', async () => {
      const mockPayload = {
        sub: '1',
        username: '张三',
        name: '张三',
        role: 'EDITOR',
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const result = await authService.validateToken('valid_token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid_token');
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(authService.validateToken('invalid_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
