import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/client";

export type TaskType = "TRANSLATION" | "REVIEW";
export type TaskStatus = "PENDING" | "REVIEWING";
export type TaskPriority = "HIGH" | "MEDIUM" | "LOW";

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  key: {
    id: string;
    name: string;
    namespace: string;
    description?: string;
  };
  sourceTranslation?: {
    id: string;
    content: string;
    locale: string;
  };
  targetLocale: {
    code: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TasksResponse {
  items: Task[];
  total: number;
}

interface UseWorkspaceTasksParams {
  projectId: string;
  status?: TaskStatus;
  limit?: number;
}

export const useWorkspaceTasks = (params: UseWorkspaceTasksParams) => {
  const { projectId, status, limit = 10 } = params;

  return useQuery<TasksResponse>({
    queryKey: ["workspace", "tasks", projectId, status, limit],
    queryFn: async () => {
      return await apiClient.get("/workspace/tasks", {
        params: { projectId, status, limit },
      });
    },
    enabled: !!projectId,
    placeholderData: {
      items: [],
      total: 0,
    },
  });
};

export default useWorkspaceTasks;
