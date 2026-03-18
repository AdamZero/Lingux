import { useQuery } from "@tanstack/react-query";
import apiClient from "@/api/client";

export interface WorkspaceStats {
  pending: number;
  reviewing: number;
  approved: number;
}

export const useWorkspaceStats = (projectId: string) => {
  return useQuery<WorkspaceStats>({
    queryKey: ["workspace", "stats", projectId],
    queryFn: async () => {
      return await apiClient.get("/workspace/stats", {
        params: { projectId },
      });
    },
    enabled: !!projectId,
    placeholderData: {
      pending: 0,
      reviewing: 0,
      approved: 0,
    },
  });
};

export default useWorkspaceStats;
