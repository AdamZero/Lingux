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
