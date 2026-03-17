import { Test, TestingModule } from '@nestjs/testing';
import { EnterpriseService } from './enterprise.service';
import { PrismaService } from '../prisma.service';

const mockPrismaService = {
  enterprise: {
    findFirst: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  enterpriseMember: {
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('EnterpriseService', () => {
  let service: EnterpriseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnterpriseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EnterpriseService>(EnterpriseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrGetEnterprise', () => {
    it('should create a new enterprise when none exists', async () => {
      const enterpriseInfo = {
        name: 'Test Enterprise',
        externalId: 'test-external-id',
        platform: 'feishu',
        domain: 'test.com',
      };

      mockPrismaService.enterprise.findFirst.mockResolvedValue(null);
      mockPrismaService.enterprise.create.mockResolvedValue({
        id: '1',
        ...enterpriseInfo,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createOrGetEnterprise(
        enterpriseInfo.name,
        enterpriseInfo.externalId,
        enterpriseInfo.platform,
        enterpriseInfo.domain,
      );

      expect(mockPrismaService.enterprise.findFirst).toHaveBeenCalledWith({
        where: { externalId: enterpriseInfo.externalId },
      });
      expect(mockPrismaService.enterprise.create).toHaveBeenCalledWith({
        data: enterpriseInfo,
      });
      expect(result.name).toBe(enterpriseInfo.name);
    });

    it('should return existing enterprise when found by externalId', async () => {
      const existingEnterprise = {
        id: '1',
        name: 'Existing Enterprise',
        externalId: 'existing-external-id',
        platform: 'feishu',
        domain: 'existing.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.enterprise.findFirst.mockResolvedValue(
        existingEnterprise,
      );

      const result = await service.createOrGetEnterprise(
        'New Name',
        existingEnterprise.externalId,
        'feishu',
        'new.com',
      );

      expect(mockPrismaService.enterprise.findFirst).toHaveBeenCalledWith({
        where: { externalId: existingEnterprise.externalId },
      });
      expect(mockPrismaService.enterprise.create).not.toHaveBeenCalled();
      expect(result.id).toBe(existingEnterprise.id);
    });
  });

  describe('associateUserWithEnterprise', () => {
    it('should create a new enterprise member when none exists', async () => {
      const userId = 'user-1';
      const enterpriseId = 'enterprise-1';
      const role = 'member';

      mockPrismaService.enterpriseMember.findFirst.mockResolvedValue(null);
      mockPrismaService.enterpriseMember.create.mockResolvedValue({
        id: '1',
        userId,
        enterpriseId,
        role,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.associateUserWithEnterprise(
        userId,
        enterpriseId,
        role,
      );

      expect(mockPrismaService.enterpriseMember.findFirst).toHaveBeenCalledWith(
        {
          where: { userId, enterpriseId },
        },
      );
      expect(mockPrismaService.enterpriseMember.create).toHaveBeenCalledWith({
        data: { userId, enterpriseId, role },
      });
      expect(result.role).toBe(role);
    });

    it('should update existing enterprise member role', async () => {
      const existingMember = {
        id: '1',
        userId: 'user-1',
        enterpriseId: 'enterprise-1',
        role: 'member',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newRole = 'admin';

      mockPrismaService.enterpriseMember.findFirst.mockResolvedValue(
        existingMember,
      );
      mockPrismaService.enterpriseMember.update.mockResolvedValue({
        ...existingMember,
        role: newRole,
      });

      const result = await service.associateUserWithEnterprise(
        existingMember.userId,
        existingMember.enterpriseId,
        newRole,
      );

      expect(mockPrismaService.enterpriseMember.update).toHaveBeenCalledWith({
        where: { id: existingMember.id },
        data: { role: newRole },
      });
      expect(result.role).toBe(newRole);
    });
  });

  describe('getUserEnterprises', () => {
    it('should return user enterprises', async () => {
      const userId = 'user-1';
      const expectedEnterprises = [
        {
          id: '1',
          userId,
          enterpriseId: 'enterprise-1',
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
          enterprise: {
            id: 'enterprise-1',
            name: 'Test Enterprise',
            externalId: 'test-external-id',
            platform: 'feishu',
            domain: 'test.com',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockPrismaService.enterpriseMember.findMany.mockResolvedValue(
        expectedEnterprises,
      );

      const result = await service.getUserEnterprises(userId);

      expect(mockPrismaService.enterpriseMember.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: { enterprise: true },
      });
      expect(result).toEqual(expectedEnterprises);
    });
  });

  describe('getEnterpriseById', () => {
    it('should return enterprise by id', async () => {
      const enterpriseId = 'enterprise-1';
      const expectedEnterprise = {
        id: enterpriseId,
        name: 'Test Enterprise',
        externalId: 'test-external-id',
        platform: 'feishu',
        domain: 'test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.enterprise.findUnique.mockResolvedValue(
        expectedEnterprise,
      );

      const result = await service.getEnterpriseById(enterpriseId);

      expect(mockPrismaService.enterprise.findUnique).toHaveBeenCalledWith({
        where: { id: enterpriseId },
      });
      expect(result).toEqual(expectedEnterprise);
    });

    it('should throw error when enterprise not found', async () => {
      const enterpriseId = 'non-existent';

      mockPrismaService.enterprise.findUnique.mockResolvedValue(null);

      await expect(service.getEnterpriseById(enterpriseId)).rejects.toThrow();
    });
  });

  describe('getEnterpriseMembers', () => {
    it('should return enterprise members', async () => {
      const enterpriseId = 'enterprise-1';
      const expectedMembers = [
        {
          id: '1',
          userId: 'user-1',
          enterpriseId,
          role: 'admin',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'user-1',
            username: 'test-user',
            email: 'test@example.com',
            role: 'EDITOR',
            externalId: 'external-1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ];

      mockPrismaService.enterpriseMember.findMany.mockResolvedValue(
        expectedMembers,
      );

      const result = await service.getEnterpriseMembers(enterpriseId);

      expect(mockPrismaService.enterpriseMember.findMany).toHaveBeenCalledWith({
        where: { enterpriseId },
        include: { user: true },
      });
      expect(result).toEqual(expectedMembers);
    });
  });
});
