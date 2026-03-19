import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  WorkspaceStatsDto,
  WorkspaceTaskDto,
  TaskType,
  TaskPriority,
  TaskStatus,
  ReleaseTaskDto,
  ApprovalTaskDto,
} from './dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  // ==================== 角色判定 ====================

  async getUserRole(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { accessMode: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isOwner = await this.prisma.projectOwner.findUnique({
      where: { projectId_userId: { projectId, userId } },
    }) !== null;

    let isMember = false;
    if (project.accessMode === 'PUBLIC') {
      isMember = true;
    } else {
      isMember = await this.prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      }) !== null;
    }

    return {
      isAdmin: user?.role === 'ADMIN',
      isOwner,
      isMember: isOwner || isMember,
    };
  }

  // ==================== 统计接口（新）====================

  async getStats(projectId: string, userId: string): Promise<WorkspaceStatsDto> {
    const role = await this.getUserRole(projectId, userId);

    if (role.isAdmin) {
      return this.getAdminStats(projectId);
    } else if (role.isOwner) {
      return this.getOwnerStats(projectId, userId);
    } else if (role.isMember) {
      return this.getMemberStats(projectId, userId);
    }

    throw new NotFoundException('Project not found or no access');
  }

  // Admin 统计（全局视角）
  private async getAdminStats(projectId: string): Promise<WorkspaceStatsDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { approvalEnabled: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // 待审批的发布申请
    const pendingApproval = project.approvalEnabled
      ? await this.prisma.releaseSession.count({
          where: {
            projectId,
            status: 'IN_REVIEW',
          },
        })
      : 0;

    // 本月发布次数
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyReleases = await this.prisma.release.count({
      where: {
        projectId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // 项目成员数
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId },
    });

    // Owner 数量
    const ownerCount = await this.prisma.projectOwner.count({
      where: { projectId },
    });

    return {
      pendingApproval,
      myPendingRelease: 0, // Admin 不关注个人
      monthlyReleases,
      memberCount: memberCount + ownerCount,
    };
  }

  // Owner 统计
  private async getOwnerStats(projectId: string, userId: string): Promise<WorkspaceStatsDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { approvalEnabled: true },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    // 待我审批的发布申请
    const pendingApproval = project.approvalEnabled
      ? await this.prisma.releaseSession.count({
          where: {
            projectId,
            status: 'IN_REVIEW',
          },
        })
      : 0;

    // 我的待发布变更（DRAFT 状态的发布申请）
    const myPendingRelease = await this.prisma.releaseSession.count({
      where: {
        projectId,
        status: 'DRAFT',
      },
    });

    // 本月发布次数
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyReleases = await this.prisma.release.count({
      where: {
        projectId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // 项目成员数
    const memberCount = await this.prisma.projectMember.count({
      where: { projectId },
    });

    // Owner 数量
    const ownerCount = await this.prisma.projectOwner.count({
      where: { projectId },
    });

    return {
      pendingApproval,
      myPendingRelease,
      monthlyReleases,
      memberCount: memberCount + ownerCount,
    };
  }

  // Member 统计
  private async getMemberStats(projectId: string, userId: string): Promise<WorkspaceStatsDto> {
    // 我的待发布变更（DRAFT 状态的发布申请）
    const myPendingRelease = await this.prisma.releaseSession.count({
      where: {
        projectId,
        status: 'DRAFT',
      },
    });

    // 我的发布申请状态统计
    const mySessions = await this.prisma.releaseSession.groupBy({
      by: ['status'],
      where: {
        projectId,
      },
      _count: {
        status: true,
      },
    });

    const sessionStats = {
      draft: 0,
      inReview: 0,
      approved: 0,
      rejected: 0,
    };

    mySessions.forEach((s) => {
      switch (s.status) {
        case 'DRAFT':
          sessionStats.draft = s._count.status;
          break;
        case 'IN_REVIEW':
          sessionStats.inReview = s._count.status;
          break;
        case 'APPROVED':
          sessionStats.approved = s._count.status;
          break;
        case 'REJECTED':
          sessionStats.rejected = s._count.status;
          break;
      }
    });

    // 本月贡献（修改的翻译数量）
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyContributions = await this.prisma.translation.count({
      where: {
        key: {
          namespace: {
            projectId,
          },
        },
        submitterId: userId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    // 项目总发布次数
    const monthlyReleases = await this.prisma.release.count({
      where: {
        projectId,
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    return {
      pendingApproval: 0, // Member 不关注待审批
      myPendingRelease,
      monthlyReleases,
      memberCount: monthlyContributions, // 用 memberCount 字段存贡献数
    };
  }

  // ==================== 任务接口（新）====================

  async getTasks(
    projectId: string,
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const role = await this.getUserRole(projectId, userId);

    if (role.isAdmin || role.isOwner) {
      return this.getApprovalTasks(projectId, userId, page, pageSize);
    } else if (role.isMember) {
      return this.getMyReleaseTasks(projectId, userId, page, pageSize);
    }

    return { items: [], total: 0, page, pageSize, totalPages: 0 };
  }

  // Owner/Admin：待审批的发布申请
  private async getApprovalTasks(
    projectId: string,
    userId: string,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { approvalEnabled: true },
    });

    if (!project?.approvalEnabled) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.releaseSession.findMany({
        where: {
          projectId,
          status: 'IN_REVIEW',
        },
        include: {
          project: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.releaseSession.count({
        where: {
          projectId,
          status: 'IN_REVIEW',
        },
      }),
    ]);

    const tasks: ApprovalTaskDto[] = sessions.map((session) => ({
      id: session.id,
      type: 'RELEASE_APPROVAL' as const,
      title: `审批发布申请`,
      description: session.note || '无描述',
      status: 'PENDING' as const,
      scope: session.scope as any,
      createdAt: session.createdAt.toISOString(),
    }));

    return {
      items: tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // Member：我的发布申请
  private async getMyReleaseTasks(
    projectId: string,
    userId: string,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    const [sessions, total] = await this.prisma.$transaction([
      this.prisma.releaseSession.findMany({
        where: {
          projectId,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.releaseSession.count({
        where: {
          projectId,
        },
      }),
    ]);

    const tasks: ReleaseTaskDto[] = sessions.map((session) => ({
      id: session.id,
      type: 'MY_RELEASE' as const,
      title: `发布申请`,
      status: session.status as any,
      scope: session.scope as any,
      createdAt: session.createdAt.toISOString(),
    }));

    return {
      items: tasks,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
