import apiClient from "./client";

export interface Namespace {
  id: string;
  name: string;
  description?: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TranslateNamespaceResult {
  jobId: string;
  status: string;
  totalKeys: number;
  type: "namespace" | "project";
  namespaceCount: number;
}

// 获取项目下的所有命名空间
export const getNamespaces = async (
  projectId: string,
): Promise<Namespace[]> => {
  return apiClient.get(`/projects/${projectId}/namespaces`);
};

// 一键翻译命名空间 - 创建异步翻译任务
export const translateNamespace = async (
  projectId: string,
  namespaceId: string,
): Promise<TranslateNamespaceResult> => {
  return apiClient.post(`/projects/${projectId}/namespaces/translate`, {
    namespaceIds: [namespaceId],
  });
};
