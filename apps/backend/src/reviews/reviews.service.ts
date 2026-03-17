import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { TranslationStatus } from '@prisma/client';

export interface ReviewTask {
  id: string;
  keyName: string;
  keyDescription?: string;
  namespace: string;
  content: string;
  localeCode: string;
  localeName: string;
  submitterName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewTasksResponse {
  items: ReviewTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async getReviewTasks(
    projectId: string,
    status?: 'pending' | 'completed',
    page: number = 1,
    pageSize: number = 20,
  ): Promise<ReviewTasksResponse> {
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const whereCondition: any = {
      key: {
        namespace: {
          projectId,
        },
      },
    };

    // 根据前端定义的状态映射
    // pending = REVIEWING
    // completed = APPROVED + REJECTED
    if (status === 'pending') {
      whereCondition.status = 'REVIEWING';
    } else if (status === 'completed') {
      whereCondition.status = {
        in: ['APPROVED', 'REJECTED'],
      };
    }

    const [translations, total] = await this.prisma.$transaction([
      this.prisma.translation.findMany({
        where: whereCondition,
        include: {
          key: {
            include: {
              namespace: true,
            },
          },
          locale: true,
          submitter: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.translation.count({
        where: whereCondition,
      }),
    ]);

    const items: ReviewTask[] = translations.map((translation) => ({
      id: translation.id,
      keyName: translation.key.name,
      keyDescription: translation.key.description || undefined,
      namespace: translation.key.namespace.name,
      content: translation.content,
      localeCode: translation.locale.code,
      localeName: translation.locale.name,
      submitterName: translation.submitter?.name || undefined,
      status: translation.status,
      createdAt: translation.createdAt.toISOString(),
      updatedAt: translation.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async approveReview(id: string, userId: string) {
    const translation = await this.prisma.translation.findUnique({
      where: { id },
    });

    if (!translation) {
      throw new NotFoundException(`Translation ${id} not found`);
    }

    return this.prisma.translation.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewerId: userId,
        approvedAt: new Date(),
      },
    });
  }

  async rejectReview(id: string, userId: string, reason: string, suggestion?: string) {
    const translation = await this.prisma.translation.findUnique({
      where: { id },
    });

    if (!translation) {
      throw new NotFoundException(`Translation ${id} not found`);
    }

    return this.prisma.translation.update({
      where: { id },
      data: {
        status: 'PENDING',
        reviewerId: userId,
        reviewComment: reason,
      },
    });
  }
}
