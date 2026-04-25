import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { App } from "antd";
import apiClient from "@/api/client";
import type {
  ReleaseSessionStatus,
  ReleaseSession,
  PreviewReleasePayload,
  PreviewReleaseResponse,
  CreateReleaseResponse,
  GetActiveReleaseSessionResponse,
  GetReleaseSessionResponse,
  RollbackReleasePayload,
  RollbackReleaseResponse,
} from "@/types/release";

/**
 * Release 类型定义
 */
export type ReleaseStatus = ReleaseSessionStatus | "PUBLISHING" | "ROLLED_BACK";

export interface Release {
  id: string;
  version: number;
  note?: string;
  status: ReleaseStatus;
  localeCodes: string[];
  publishedAt?: string;
  createdAt: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  basedOnReleaseId?: string | null;
  scope?: {
    type: "all" | "namespaces" | "keys";
    namespaceIds?: string[];
    keyIds?: string[];
  };
  tags?: string[];
  scheduledAt?: string;
}

export interface ReleaseListResponse {
  items: Release[];
  nextCursor: { before: string; beforeId: string } | null;
}

export { ReleaseSession, ReleaseSessionStatus };

/**
 * Query keys for releases
 */
export const releaseKeys = {
  all: ["releases"] as const,
  lists: (projectId: string) =>
    [...releaseKeys.all, "list", projectId] as const,
  list: (projectId: string, status?: string | null) =>
    [...releaseKeys.lists(projectId), { status }] as const,
  activeSession: (projectId: string) =>
    ["release-session-active", projectId] as const,
  session: (projectId: string, sessionId: string) =>
    ["release-session", projectId, sessionId] as const,
  detail: (projectId: string, releaseId: string) =>
    ["release", projectId, releaseId] as const,
};

/**
 * Hook for managing releases
 */
export function useReleases(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  const { notification } = App.useApp();

  /**
   * 获取发布列表
   */
  const releasesQuery = useQuery<ReleaseListResponse>({
    queryKey: releaseKeys.list(projectId || ""),
    queryFn: async () => {
      if (!projectId) return { items: [], nextCursor: null };
      return await apiClient.get(`/projects/${projectId}/releases`);
    },
    enabled: !!projectId,
  });

  /**
   * 获取活跃会话
   */
  const activeSessionQuery = useQuery<GetActiveReleaseSessionResponse>({
    queryKey: releaseKeys.activeSession(projectId || ""),
    queryFn: async () => {
      if (!projectId) return { currentReleaseId: null, session: null };
      return await apiClient.get(
        `/projects/${projectId}/release-sessions/active`,
      );
    },
    enabled: !!projectId,
  });

  /**
   * 创建发布预览
   */
  const previewMutation = useMutation<
    PreviewReleaseResponse,
    Error,
    PreviewReleasePayload
  >({
    mutationFn: async (payload) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/releases/preview`,
        payload,
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
      }
    },
  });

  /**
   * 强制创建发布预览（软删除他人草稿后创建）
   */
  const forceCreateMutation = useMutation<
    PreviewReleaseResponse,
    Error,
    PreviewReleasePayload & { reason: string }
  >({
    mutationFn: async (payload) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/release-sessions/force-create`,
        payload,
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
      }
    },
  });

  /**
   * 提交审核
   */
  const submitMutation = useMutation<
    { session: unknown },
    Error,
    { sessionId: string; note?: string }
  >({
    mutationFn: async ({ sessionId, note }) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/release-sessions/${sessionId}/submit`,
        { note },
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
    },
  });

  /**
   * 审批通过
   */
  const approveMutation = useMutation<
    { session: unknown },
    Error,
    { sessionId: string; note?: string }
  >({
    mutationFn: async ({ sessionId, note }) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/release-sessions/${sessionId}/approve`,
        { note },
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
    },
  });

  /**
   * 驳回
   */
  const rejectMutation = useMutation<
    { session: unknown },
    Error,
    { sessionId: string; reason: string }
  >({
    mutationFn: async ({ sessionId, reason }) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/release-sessions/${sessionId}/reject`,
        { reason },
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
    },
  });

  /**
   * 发布
   */
  const publishMutation = useMutation<
    CreateReleaseResponse,
    Error,
    string // sessionId
  >({
    mutationFn: async (sessionId) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/release-sessions/${sessionId}/publish`,
        {},
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
    },
  });

  /**
   * 回滚
   */
  const rollbackMutation = useMutation<
    RollbackReleaseResponse,
    Error,
    { releaseId: string; toReleaseId?: string }
  >({
    mutationFn: async ({ releaseId, toReleaseId }) => {
      if (!projectId) throw new Error("未选择项目");
      return await apiClient.post(
        `/projects/${projectId}/releases/${releaseId}/rollback`,
        { toReleaseId } as RollbackReleasePayload,
      );
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: ["project", projectId],
        });
      }
    },
  });

  /**
   * 撤销草稿
   */
  const cancelDraftMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await apiClient.delete(
        `/projects/${projectId}/release-sessions/${sessionId}`,
      );
    },
    onSuccess: () => {
      // 刷新活跃会话和发布列表
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
      notification.success({ message: "草稿已撤销" });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      notification.error({
        message: err.response?.data?.message || "撤销失败",
      });
    },
  });

  /**
   * 下载产物
   */
  const downloadArtifact = async (
    releaseId: string,
    localeCode: string,
  ): Promise<Record<string, unknown>> => {
    if (!projectId) throw new Error("未选择项目");
    return await apiClient.get(
      `/projects/${projectId}/releases/${releaseId}/artifacts/${localeCode}`,
    );
  };

  /**
   * 获取指定发布会话详情
   */
  const getSession = async (
    sessionId: string,
  ): Promise<GetReleaseSessionResponse> => {
    if (!projectId) throw new Error("未选择项目");
    return await apiClient.get(
      `/projects/${projectId}/release-sessions/${sessionId}`,
    );
  };

  /**
   * 获取指定发布详情
   */
  const getRelease = async (releaseId: string): Promise<Release> => {
    if (!projectId) throw new Error("未选择项目");
    return await apiClient.get(`/projects/${projectId}/releases/${releaseId}`);
  };

  return {
    // Data
    releases: releasesQuery.data?.items || [],
    isLoading: releasesQuery.isLoading,
    activeSession: activeSessionQuery.data?.session || null,
    currentReleaseId: activeSessionQuery.data?.currentReleaseId || null,

    // Queries (for advanced usage)
    releasesQuery,
    activeSessionQuery,

    // Mutations
    previewMutation,
    forceCreateMutation,
    submitMutation,
    approveMutation,
    rejectMutation,
    publishMutation,
    rollbackMutation,
    cancelDraftMutation,

    // Actions
    downloadArtifact,
    getSession,
    getRelease,

    // Utils
    invalidateReleases: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.lists(projectId),
        });
      }
    },
    invalidateActiveSession: () => {
      if (projectId) {
        queryClient.invalidateQueries({
          queryKey: releaseKeys.activeSession(projectId),
        });
      }
    },

    // Cancel Draft
    cancelDraft: cancelDraftMutation.mutate,
    isCanceling: cancelDraftMutation.isPending,
  };
}

export default useReleases;
