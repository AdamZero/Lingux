import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  WorkspaceStatsDto,
  WorkspaceTaskDto,
  TaskType,
  TaskPriority,
  TaskStatus,
} from './dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async getStats(
    projectId: string,
    userId: string,
  ): Promise<WorkspaceStatsDto> {
    // 获取用户有 EDIT 权限的命名空间
    const userProject = await this.prisma.project.findFirst({
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

    if (!userProject) {
      return { pending: 0, reviewing: 0, approved: 0 };
    }

    // 统计 pending 数量
    let pendingCount = 0;
    for (const namespace of userProject.namespaces) {
      for (const key of namespace.keys) {
        pendingCount += key.translations.length;
      }
    }

    // 统计 reviewing 数量（当前用户提交的）
    const reviewingCount = await this.prisma.translation.count({
      where: {
        status: 'REVIEWING',
        submitterId: userId,
        key: {
          namespace: {
            projectId,
          },
        },
      },
    });

    // 统计 approved 数量（当前用户本月提交的）
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const approvedCount = await this.prisma.translation.count({
      where: {
        status: 'APPROVED',
        submitterId: userId,
        approvedAt: {
          gte: startOfMonth,
        },
        key: {
          namespace: {
            projectId,
          },
        },
      },
    });

    return {
      pending: pendingCount,
      reviewing: reviewingCount,
      approved: approvedCount,
    };
  }

  async getTasks(
    projectId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const skip = (page - 1) * pageSize;

    // 根据用户角色确定任务类型
    const isReviewer = user.role === 'REVIEWER' || user.role === 'ADMIN';

    // 查询任务
    const whereCondition: any = {
      key: {
        namespace: {
          projectId,
        },
      },
    };

    if (isReviewer) {
      // 审核员查看待审核的任务
      whereCondition.status = 'REVIEWING';
    } else {
      // 翻译员查看待翻译的任务
      whereCondition.status = 'PENDING';
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
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.translation.count({
        where: whereCondition,
      }),
    ]);

    const tasks: WorkspaceTaskDto[] = translations.map((translation) => {
      const type = isReviewer ? TaskType.REVIEW : TaskType.TRANSLATION;
      const status =
        translation.status === 'REVIEWING'
          ? TaskStatus.REVIEWING
          : TaskStatus.PENDING;

      // 计算优先级
      let priority = TaskPriority.MEDIUM;
      if (translation.dueDate) {
        const daysUntilDue = Math.ceil(
          (new Date(translation.dueDate).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        );
        if (daysUntilDue < 3) {
          priority = TaskPriority.HIGH;
        } else if (daysUntilDue > 7) {
          priority = TaskPriority.LOW;
        }
      }

      return {
        id: translation.id,
        type,
        title: `翻译 ${translation.key.name}`,
        description: translation.key.description || undefined,
        priority,
        status,
        dueDate: translation.dueDate?.toISOString(),
        key: {
          id: translation.key.id,
          name: translation.key.name,
          namespace: translation.key.namespace.name,
          description: translation.key.description || undefined,
        },
        sourceTranslation: {
          id: translation.id,
          content: translation.content,
          locale: translation.locale.code,
        },
        targetLocale: {
          code: translation.locale.code,
          name: translation.locale.name,
        },
        createdAt: translation.createdAt.toISOString(),
        updatedAt: translation.updatedAt.toISOString(),
      };
    });

    return {
      items: tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
