import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prisma: PrismaService;

  const mockPrisma = {
    project: {
      findFirst: jest.fn(),
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
    it('should return workspace stats for user with EDIT permission', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      const mockProject = {
        id: projectId,
        namespaces: [
          {
            id: 'ns-1',
            keys: [
              {
                id: 'key-1',
                translations: [{ id: 't1', status: 'PENDING' }],
              },
            ],
          },
        ],
      };

      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.translation.count
        .mockResolvedValueOnce(1) // reviewing count
        .mockResolvedValueOnce(1); // approved count

      const result = await service.getStats(projectId, userId);

      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: projectId,
          users: {
            some: {
              id: userId,
            },
          },
        },
        include: {
          namespaces: {
            include: {
              keys: {
                include: {
                  translations: {
                    where: {
                      status: 'PENDING',
                    },
                  },
                },
              },
            },
          },
        },
      });

      expect(result).toEqual({
        pending: 1,
        reviewing: 1,
        approved: 1,
      });
    });

    it('should return zeros when user has no access', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await service.getStats(projectId, userId);

      expect(result).toEqual({
        pending: 0,
        reviewing: 0,
        approved: 0,
      });
    });
  });

  describe('getTasks', () => {
    it('should handle empty results', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        role: 'TRANSLATOR',
      });
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.getTasks(projectId, userId, 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
