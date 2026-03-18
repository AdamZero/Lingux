import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceService } from './workspace.service';

describe('WorkspaceController', () => {
  let controller: WorkspaceController;
  let service: WorkspaceService;

  const mockWorkspaceService = {
    getStats: jest.fn(),
    getTasks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: mockWorkspaceService,
        },
      ],
    }).compile();

    controller = module.get<WorkspaceController>(WorkspaceController);
    service = module.get<WorkspaceService>(WorkspaceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStats', () => {
    it('should return stats from service', async () => {
      const projectId = 'test-project';
      const userId = 'test-user';
      const mockStats = { pending: 5, reviewing: 3, approved: 10 };

      mockWorkspaceService.getStats.mockResolvedValue(mockStats);

      const mockReq = { user: { userId } };
      const result = await controller.getStats(projectId, mockReq as any);

      expect(service.getStats).toHaveBeenCalledWith(projectId, userId);
      expect(result).toEqual(mockStats);
    });
  });

  describe('getTasks', () => {
    it('should return paginated tasks from service', async () => {
      const projectId = 'test-project';
      const userId = 'test-user';
      const page = 1;
      const pageSize = 20;
      const mockTasks = {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };

      mockWorkspaceService.getTasks.mockResolvedValue(mockTasks);

      const mockReq = { user: { userId } };
      const result = await controller.getTasks(projectId, page, pageSize, mockReq as any);

      expect(service.getTasks).toHaveBeenCalledWith(projectId, userId, page, pageSize);
      expect(result).toEqual(mockTasks);
    });
  });
});
