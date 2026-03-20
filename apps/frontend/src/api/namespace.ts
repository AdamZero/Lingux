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
  totalKeys: number;
  translatedKeys: number;
  failedKeys: number;
  details: Array<{
    keyId: string;
    keyName: string;
    localeCode: string;
    success: boolean;
    error?: string;
  }>;
}

// 获取项目下的所有命名空间
export const getNamespaces = async (
  projectId: string,
): Promise<Namespace[]> => {
  return apiClient.get(`/projects/${projectId}/namespaces`);
};

// 一键翻译命名空间 - 自动翻译所有缺失的翻译
export const translateNamespace = async (
  projectId: string,
  namespaceId: string,
): Promise<TranslateNamespaceResult> => {
  return apiClient.post(
    `/projects/${projectId}/namespaces/${namespaceId}/translate`,
  );
};
