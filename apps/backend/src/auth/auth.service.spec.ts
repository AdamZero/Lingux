import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma.service';
import { JwtService } from '@nestjs/jwt';
import { EnterpriseService } from '../enterprise/enterprise.service';
import { UnauthorizedException } from '@nestjs/common';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockEnterpriseService = {
  createOrGetEnterprise: jest.fn(),
  getEnterpriseMembers: jest.fn(),
  associateUserWithEnterprise: jest.fn(),
};

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EnterpriseService,
          useValue: mockEnterpriseService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return existing user when user exists', async () => {
      const existingUser = {
        id: '1',
        username: 'test_user',
        externalId: 'external_123',
        role: 'EDITOR',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      const result = await authService.validateUser('external_123', 'feishu');

      expect(result).toEqual(existingUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'external_123' },
      });
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should create new user when user does not exist', async () => {
      const newUser = {
        id: '2',
        username: 'feishu_external_456',
        externalId: 'external_456',
        role: 'EDITOR',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(newUser);

      const result = await authService.validateUser('external_456', 'feishu');

      expect(result).toEqual(newUser);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { externalId: 'external_456' },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          username: 'feishu_external_456',
          externalId: 'external_456',
          role: 'EDITOR',
        },
      });
    });

    it('should associate user with enterprise when enterprise info is provided', async () => {
      const user = {
        id: '3',
        username: 'feishu_external_789',
        externalId: 'external_789',
        role: 'EDITOR',
      };

      const enterprise = {
        id: '1',
        name: 'Test Enterprise',
        externalId: 'ent_123',
        platform: 'feishu',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockEnterpriseService.createOrGetEnterprise.mockResolvedValue(enterprise);
      mockEnterpriseService.getEnterpriseMembers.mockResolvedValue([]); // First user, should be admin

      const result = await authService.validateUser('external_789', 'feishu', {
        name: 'Test Enterprise',
        externalId: 'ent_123',
        domain: 'test.com',
      });

      expect(result).toEqual(user);
      expect(mockEnterpriseService.createOrGetEnterprise).toHaveBeenCalledWith(
        'Test Enterprise',
        'ent_123',
        'feishu',
        'test.com',
      );
      expect(mockEnterpriseService.getEnterpriseMembers).toHaveBeenCalledWith(enterprise.id);
      expect(mockEnterpriseService.associateUserWithEnterprise).toHaveBeenCalledWith(
        user.id,
        enterprise.id,
        'admin',
      );
    });

    it('should assign member role when enterprise has existing members', async () => {
      const user = {
        id: '4',
        username: 'feishu_external_999',
        externalId: 'external_999',
        role: 'EDITOR',
      };

      const enterprise = {
        id: '1',
        name: 'Test Enterprise',
        externalId: 'ent_123',
        platform: 'feishu',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockEnterpriseService.createOrGetEnterprise.mockResolvedValue(enterprise);
      mockEnterpriseService.getEnterpriseMembers.mockResolvedValue([{ id: '1', userId: '5', enterpriseId: '1', role: 'admin' }]); // Has existing members

      await authService.validateUser('external_999', 'feishu', {
        name: 'Test Enterprise',
        externalId: 'ent_123',
      });

      expect(mockEnterpriseService.associateUserWithEnterprise).toHaveBeenCalledWith(
        user.id,
        enterprise.id,
        'member',
      );
    });

    it('should throw error when validation fails', async () => {
      mockPrismaService.user.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(authService.validateUser('external_123', 'feishu')).rejects.toThrow('Failed to validate or create user');
    });
  });

  describe('login', () => {
    it('should generate access token and return user info', async () => {
      const user = {
        id: '1',
        username: 'test_user',
        role: 'EDITOR',
      };

      const mockToken = 'mock_jwt_token';
      mockJwtService.sign.mockReturnValue(mockToken);

      const result = await authService.login(user);

      expect(result).toEqual({
        access_token: mockToken,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: user.id,
        username: user.username,
        role: user.role,
      });
    });

    it('should throw error when token generation fails', async () => {
      const user = {
        id: '1',
        username: 'test_user',
        role: 'EDITOR',
      };

      mockJwtService.sign.mockRejectedValue(new Error('Token generation error'));

      await expect(authService.login(user)).rejects.toThrow('Failed to generate access token');
    });
  });

  describe('validateToken', () => {
    it('should return payload when token is valid', async () => {
      const mockPayload = {
        sub: '1',
        username: 'test_user',
        role: 'EDITOR',
      };

      mockJwtService.verify.mockReturnValue(mockPayload);

      const result = await authService.validateToken('valid_token');

      expect(result).toEqual(mockPayload);
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid_token');
    });

    it('should throw UnauthorizedException when token is invalid', async () => {
      mockJwtService.verify.mockRejectedValue(new Error('Invalid token'));

      await expect(authService.validateToken('invalid_token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
