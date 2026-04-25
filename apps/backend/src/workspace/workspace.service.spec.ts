import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    projectOwner: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    projectMember: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    releaseSession: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    release: {
      count: jest.fn(),
    },
    translation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return workspace stats for admin user', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      // Mock getUserRole calls
      mockPrisma.project.findUnique
        .mockResolvedValueOnce({ id: projectId, accessMode: 'PUBLIC' }) // getUserRole
        .mockResolvedValueOnce({ id: projectId, approvalEnabled: true }); // getAdminStats
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'ADMIN',
      });
      mockPrisma.projectOwner.findUnique.mockResolvedValue(null);

      // Mock getAdminStats calls
      mockPrisma.releaseSession.count.mockResolvedValue(1);
      mockPrisma.release.count.mockResolvedValue(2);
      mockPrisma.projectMember.count.mockResolvedValue(3);
      mockPrisma.projectOwner.count.mockResolvedValue(4);

      const result = await service.getStats(projectId, userId);

      expect(result).toEqual({
        pendingApproval: 1,
        myPendingRelease: 0,
        monthlyReleases: 2,
        memberCount: 7, // 3 + 4
      });
    });

    it('should return stats for owner user', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      // Mock getUserRole calls
      mockPrisma.project.findUnique
        .mockResolvedValueOnce({ id: projectId, accessMode: 'PUBLIC' }) // getUserRole
        .mockResolvedValueOnce({ id: projectId, approvalEnabled: true }); // getOwnerStats
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'EDITOR',
      });
      mockPrisma.projectOwner.findUnique.mockResolvedValue({
        projectId,
        userId,
      });

      // Mock getOwnerStats calls
      mockPrisma.releaseSession.count
        .mockResolvedValueOnce(1) // pendingApproval
        .mockResolvedValueOnce(2); // myPendingRelease
      mockPrisma.release.count.mockResolvedValue(3);
      mockPrisma.projectMember.count.mockResolvedValue(4);
      mockPrisma.projectOwner.count.mockResolvedValue(5);

      const result = await service.getStats(projectId, userId);

      expect(result).toEqual({
        pendingApproval: 1,
        myPendingRelease: 2,
        monthlyReleases: 3,
        memberCount: 9, // 4 + 5
      });
    });
  });

  describe('getTasks', () => {
    it('should handle empty results', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      // Mock getUserRole calls
      mockPrisma.project.findUnique.mockResolvedValue({
        id: projectId,
        accessMode: 'PUBLIC',
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'TRANSLATOR',
      });
      mockPrisma.projectOwner.findUnique.mockResolvedValue(null);

      // Mock getTranslatorTasks calls
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.getTasks(projectId, userId, 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
