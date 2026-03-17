export class WorkspaceStatsDto {
  pending: number;
  reviewing: number;
  approved: number;
}

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
