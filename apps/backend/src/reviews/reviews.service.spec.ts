import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let prisma: PrismaService;

  const mockPrisma = {
    translation: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getReviewTasks', () => {
    it('should return paginated review tasks for pending status', async () => {
      const projectId = 'test-project';
      const status = 'pending';
      const page = 1;
      const pageSize = 20;

      const now = new Date();
      const mockTranslations = [
        {
          id: 't1',
          status: 'REVIEWING',
          content: 'Test translation',
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
          submitter: {
            id: 'u1',
            name: 'Test User',
          },
        },
      ];

      const mockCount = 1;

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([
        mockTranslations,
        mockCount,
      ]);

      const result = await service.getReviewTasks(
        projectId,
        status,
        page,
        pageSize,
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();

      expect(result).toEqual({
        items: [
          {
            id: 't1',
            keyName: 'test.key',
            keyDescription: 'Test key',
            namespace: 'Common',
            content: 'Test translation',
            localeCode: 'en-US',
            localeName: 'English',
            submitterName: 'Test User',
            status: 'REVIEWING',
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('should handle completed status filter', async () => {
      const projectId = 'test-project';
      const status = 'completed';

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.getReviewTasks(projectId, status, 1, 20);

      expect(mockPrisma.translation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: {
              in: ['APPROVED', 'REJECTED'],
            },
          }),
        }),
      );
    });

    it('should handle no status filter', async () => {
      const projectId = 'test-project';

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.getReviewTasks(projectId, undefined, 1, 20);

      expect(mockPrisma.translation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            key: {
              namespace: {
                projectId,
              },
            },
          },
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      const projectId = 'test-project';
      const page = 2;
      const pageSize = 10;

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue([[], 0]);

      await service.getReviewTasks(projectId, undefined, page, pageSize);

      expect(mockPrisma.translation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe('approveReview', () => {
    it('should approve a review successfully', async () => {
      const translationId = 't1';
      const userId = 'u1';

      const existingTranslation = {
        id: translationId,
        status: 'REVIEWING',
        content: 'Test',
      };

      const updatedTranslation = {
        ...existingTranslation,
        status: 'APPROVED',
        reviewerId: userId,
        approvedAt: expect.any(Date),
      };

      mockPrisma.translation.findUnique.mockResolvedValue(existingTranslation);
      mockPrisma.translation.update.mockResolvedValue(updatedTranslation);

      const result = await service.approveReview(translationId, userId);

      expect(prisma.translation.findUnique).toHaveBeenCalledWith({
        where: { id: translationId },
      });

      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { id: translationId },
        data: {
          status: 'APPROVED',
          reviewerId: userId,
          approvedAt: expect.any(Date),
        },
      });

      expect(result).toEqual(updatedTranslation);
    });

    it('should throw NotFoundException when translation not found', async () => {
      const translationId = 'nonexistent';
      const userId = 'u1';

      mockPrisma.translation.findUnique.mockResolvedValue(null);

      await expect(
        service.approveReview(translationId, userId),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.approveReview(translationId, userId),
      ).rejects.toThrow(`Translation ${translationId} not found`);
    });
  });

  describe('rejectReview', () => {
    it('should reject a review successfully', async () => {
      const translationId = 't1';
      const userId = 'u1';
      const reason = 'Translation quality issue';
      const suggestion = 'Please review terminology';

      const existingTranslation = {
        id: translationId,
        status: 'REVIEWING',
        content: 'Test',
      };

      const updatedTranslation = {
        ...existingTranslation,
        status: 'PENDING',
        reviewerId: userId,
        reviewComment: reason,
      };

      mockPrisma.translation.findUnique.mockResolvedValue(existingTranslation);
      mockPrisma.translation.update.mockResolvedValue(updatedTranslation);

      const result = await service.rejectReview(
        translationId,
        userId,
        reason,
        suggestion,
      );

      expect(prisma.translation.findUnique).toHaveBeenCalledWith({
        where: { id: translationId },
      });

      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { id: translationId },
        data: {
          status: 'PENDING',
          reviewerId: userId,
          reviewComment: reason,
        },
      });

      expect(result).toEqual(updatedTranslation);
    });

    it('should handle rejection without suggestion', async () => {
      const translationId = 't1';
      const userId = 'u1';
      const reason = 'Translation quality issue';

      const existingTranslation = {
        id: translationId,
        status: 'REVIEWING',
        content: 'Test',
      };

      mockPrisma.translation.findUnique.mockResolvedValue(existingTranslation);
      mockPrisma.translation.update.mockResolvedValue(existingTranslation);

      await service.rejectReview(translationId, userId, reason);

      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { id: translationId },
        data: {
          status: 'PENDING',
          reviewerId: userId,
          reviewComment: reason,
        },
      });
    });

    it('should throw NotFoundException when translation not found', async () => {
      const translationId = 'nonexistent';
      const userId = 'u1';
      const reason = 'Test reason';

      mockPrisma.translation.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectReview(translationId, userId, reason),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
