import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: ReviewsService;

  const mockReviewsService = {
    getReviewTasks: jest.fn(),
    approveReview: jest.fn(),
    rejectReview: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: mockReviewsService,
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get<ReviewsService>(ReviewsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getReviewTasks', () => {
    it('should return paginated review tasks', async () => {
      const projectId = 'test-project';
      const status = 'pending';
      const page = 1;
      const pageSize = 20;
      const mockTasks = {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };

      mockReviewsService.getReviewTasks.mockResolvedValue(mockTasks);

      const result = await controller.getReviewTasks(projectId, status, page, pageSize);

      expect(service.getReviewTasks).toHaveBeenCalledWith(projectId, status, page, pageSize);
      expect(result).toEqual(mockTasks);
    });
  });

  describe('approveReview', () => {
    it('should approve a review', async () => {
      const id = 'test-id';
      const userId = 'user-id';
      const mockResult = { id, status: 'APPROVED', reviewerId: userId };

      mockReviewsService.approveReview.mockResolvedValue(mockResult);

      const mockReq = { user: { userId } };
      const result = await controller.approveReview(id, mockReq as any);

      expect(service.approveReview).toHaveBeenCalledWith(id, userId);
      expect(result).toEqual(mockResult);
    });
  });

  describe('rejectReview', () => {
    it('should reject a review with reason and suggestion', async () => {
      const id = 'test-id';
      const userId = 'user-id';
      const reason = 'Quality issue';
      const suggestion = 'Fix grammar';
      const mockResult = { id, status: 'PENDING', reviewComment: reason };

      mockReviewsService.rejectReview.mockResolvedValue(mockResult);

      const mockReq = { user: { userId } };
      const result = await controller.rejectReview(id, mockReq as any, reason, suggestion);

      expect(service.rejectReview).toHaveBeenCalledWith(id, userId, reason, suggestion);
      expect(result).toEqual(mockResult);
    });

    it('should reject a review without suggestion', async () => {
      const id = 'test-id';
      const userId = 'user-id';
      const reason = 'Quality issue';
      const mockResult = { id, status: 'PENDING', reviewComment: reason };

      mockReviewsService.rejectReview.mockResolvedValue(mockResult);

      const mockReq = { user: { userId } };
      const result = await controller.rejectReview(id, mockReq as any, reason);

      expect(service.rejectReview).toHaveBeenCalledWith(id, userId, reason, undefined);
      expect(result).toEqual(mockResult);
    });
  });
});
