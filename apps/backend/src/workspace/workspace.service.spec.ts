import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma.service';
import { TaskPriority, TaskStatus, TaskType } from './dto/workspace.dto';

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
                translations: [
                  { id: 't1', status: 'PENDING' },
                ],
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
    it('should return paginated tasks with correct priority calculation', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';
      const page = 1;
      const pageSize = 20;

      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockTranslations = [
        {
          id: 't1',
          status: 'PENDING',
          content: 'Test content',
          dueDate: tomorrow,
          createdAt: now,
          updatedAt: now,
          key: {
            id: 'k1',
            name: 'test.key',
            description: 'Test key',
            namespace: {
              id: 'ns1',
              name: 'Common',
            },
          },
          locale: {
            id: 'l1',
            code: 'en-US',
            name: 'English',
          },
          submitter: null,
        },
        {
          id: 't2',
          status: 'PENDING',
          content: 'Urgent content',
          dueDate: now,
          createdAt: now,
          updatedAt: now,
          key: {
            id: 'k2',
            name: 'urgent.key',
            description: null,
            namespace: {
              id: 'ns1',
              name: 'Common',
            },
          },
          locale: {
            id: 'l1',
            code: 'en-US',
            name: 'English',
          },
          submitter: {
            id: 'u1',
            name: 'Test User',
          },
        },
      ];

      const mockCount = 2;

      const mockUser = { id: userId, role: 'TRANSLATOR' };
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([mockTranslations, mockCount]);

      const result = await service.getTasks(projectId, userId, page, pageSize);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);

      // 检查优先级计算：dueDate 为今天应该是 HIGH，明天也是 HIGH（因为不到 3 天）
      expect(result.items[0].priority).toBe(TaskPriority.HIGH);
      expect(result.items[1].priority).toBe(TaskPriority.HIGH);
    });

    it('should handle empty results', async () => {
      const projectId = 'test-project-id';
      const userId = 'test-user-id';

      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, role: 'TRANSLATOR' });
      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      const result = await service.getTasks(projectId, userId, 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
