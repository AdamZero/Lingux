import apiClient from "./client";

export interface TranslationProvider {
  id: string;
  name: string;
  type:
    | "GOOGLE"
    | "DEEPL"
    | "AZURE"
    | "OPENAI"
    | "BAIDU"
    | "CUSTOM"
    | "MOCK"
    | "TENCENT";
  baseUrl: string;
  isEnabled: boolean;
  isDefault: boolean;
  rateLimitPerMin: number;
  maxCharsPerReq: number;
  maxTextsPerReq: number;
  timeoutMs: number;
}

export interface TranslateRequest {
  providerId?: string;
  text: string;
  sourceLanguage?: string;
  targetLanguage: string;
  format?: "text" | "html";
}

export interface TranslateResult {
  translatedText: string;
  detectedSourceLanguage?: string;
  confidence?: number;
}

export interface BatchTranslateRequest {
  providerId?: string;
  texts: string[];
  sourceLanguage?: string;
  targetLanguage: string;
  format?: "text" | "html";
}

export interface BatchTranslateResult {
  translations: TranslateResult[];
  totalCharacters: number;
}

export interface TranslationJob {
  id: string;
  providerId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL";
  sourceLanguage: string;
  targetLanguage: string;
  texts: string[];
  results?: string[];
  error?: string;
  characterCount: number;
  createdAt: string;
  completedAt?: string;
  Provider?: {
    name: string;
    type: string;
  };
}

export interface CostStatistics {
  providerId: string;
  providerName: string;
  billingPeriod: string;
  totalCharacters: number;
  totalCost: number;
  jobCount: number;
}

// 获取所有翻译供应商
export const getTranslationProviders = async (): Promise<
  TranslationProvider[]
> => {
  return apiClient.get("/translation-providers");
};

// 获取默认供应商
export const getDefaultProvider =
  async (): Promise<TranslationProvider | null> => {
    return apiClient.get("/translation-providers/default");
  };

// 获取供应商详情
export const getProviderInfo = async (providerId: string) => {
  return apiClient.get(`/translation-providers/${providerId}`);
};

// 检查供应商健康状态
export const checkProviderHealth = async (
  providerId: string,
): Promise<{ providerId: string; status: string }> => {
  return apiClient.get(`/translation-providers/${providerId}/health`);
};

// 单文本翻译
export const translate = async (
  request: TranslateRequest,
): Promise<TranslateResult & { providerId: string; sourceText: string }> => {
  return apiClient.post("/translation-providers/translate", request);
};

// 批量翻译
export const translateBatch = async (
  request: BatchTranslateRequest,
): Promise<
  BatchTranslateResult & { providerId: string; sourceTexts: string[] }
> => {
  return apiClient.post("/translation-providers/translate-batch", request);
};

// 创建异步翻译任务
export const createTranslationJob = async (request: {
  providerId?: string;
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  projectId?: string;
}): Promise<{ jobId: string; status: string; message: string }> => {
  return apiClient.post("/translation-providers/jobs", request);
};

// 获取翻译任务状态
export const getTranslationJob = async (
  jobId: string,
): Promise<TranslationJob> => {
  return apiClient.get(`/translation-providers/jobs/${jobId}`);
};

// 获取成本统计
export const getCostStatistics = async (params?: {
  providerId?: string;
  billingPeriod?: string;
}): Promise<CostStatistics[]> => {
  return apiClient.get("/translation-providers/costs/statistics", { params });
};

// 删除翻译供应商
export const deleteTranslationProvider = async (
  providerId: string,
): Promise<{ message: string }> => {
  return apiClient.delete(`/translation-providers/${providerId}`);
};

// 更新翻译供应商
export const updateTranslationProvider = async (
  providerId: string,
  data: Partial<TranslationProvider>,
): Promise<TranslationProvider> => {
  return apiClient.put(`/translation-providers/${providerId}`, data);
};

// 设置默认供应商
export const setDefaultTranslationProvider = async (
  providerId: string,
): Promise<{ message: string }> => {
  return apiClient.put(`/translation-providers/${providerId}/default`);
};

// ========== 新增：翻译任务分析 API ==========

export interface TranslationJobItem {
  id: string;
  keyId: string;
  keyName: string;
  namespaceName?: string;
  sourceContent: string;
  translations: {
    targetLanguage: string;
    translatedContent: string | null;
    status: string;
    errorMessage?: string | null;
    characterCount: number;
  }[];
}

export interface TranslationJobDetail {
  id: string;
  provider: {
    id: string;
    name: string;
    type: string;
  };
  user: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  project?: {
    id: string;
    name: string;
  };
  status: string;
  sourceLanguage: string;
  targetLanguages: string[];
  totalKeys: number;
  translatedKeys: number;
  characterCount: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
  items: TranslationJobItem[];
}

export interface TranslationJobListItem {
  id: string;
  providerName: string;
  providerType: string;
  userId: string | null;
  userName: string | null;
  projectId: string | null;
  projectName: string | null;
  status: string;
  sourceLanguage: string;
  targetLanguages: string[];
  totalKeys: number;
  translatedKeys: number;
  successCount: number;
  failedCount: number;
  characterCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface TranslationJobListResponse {
  items: TranslationJobListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MonthlyStats {
  totalCharacters: number;
  totalJobs: number;
  providers: {
    providerId: string;
    providerName: string;
    providerType: string;
    characterCount: number;
    jobCount: number;
    percentage: number;
  }[];
}

// 获取翻译任务列表
export const getTranslationJobs = async (
  params?: {
    page?: number;
    pageSize?: number;
    userId?: string;
    providerId?: string;
    projectId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<TranslationJobListResponse> => {
  return apiClient.get('/translation-providers/jobs', { params });
};

// 获取翻译任务详情
export const getTranslationJobDetail = async (
  jobId: string,
): Promise<TranslationJobDetail> => {
  return apiClient.get(`/translation-providers/jobs/${jobId}`);
};

// 获取月度统计
export const getMonthlyStats = async (
  params?: { year?: number; month?: number },
): Promise<MonthlyStats> => {
  return apiClient.get('/translation-providers/monthly-stats', { params });
};
