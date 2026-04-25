export class WorkspaceStatsDto {
  pendingApproval: number; // 待审批的发布申请
  myPendingRelease: number; // 我的待发布变更
  monthlyReleases: number; // 本月发布次数
  memberCount: number; // 成员数（或贡献数）
}

// 旧的 DTO 保留兼容
export class WorkspaceTaskKeyDto {
  id: string;
  name: string;
  namespace: string;
  description?: string;
}

export class WorkspaceTaskSourceTranslationDto {
  id: string;
  content: string;
  locale: string;
}

export class WorkspaceTaskTargetLocaleDto {
  code: string;
  name: string;
}

export enum TaskType {
  TRANSLATION = 'TRANSLATION',
  REVIEW = 'REVIEW',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  REVIEWING = 'REVIEWING',
}

// 旧的 Task DTO 保留兼容
export class WorkspaceTaskDto {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  key: WorkspaceTaskKeyDto;
  sourceTranslation: WorkspaceTaskSourceTranslationDto;
  targetLocale: WorkspaceTaskTargetLocaleDto;
  createdAt: string;
  updatedAt: string;
}

export class WorkspaceTasksResponseDto {
  items: WorkspaceTaskDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 新的 Task DTO
export interface ApprovalTaskDto {
  id: string;
  type: 'RELEASE_APPROVAL';
  title: string;
  description: string;
  status: 'PENDING';
  scope: any;
  createdAt: string;
}

export interface ReleaseTaskDto {
  id: string;
  type: 'MY_RELEASE';
  title: string;
  status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'PUBLISHED';
  scope: any;
  createdAt: string;
}
