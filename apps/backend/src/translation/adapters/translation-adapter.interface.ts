/**
 * 翻译适配器接口
 * 定义所有翻译供应商适配器必须实现的方法
 */

export interface TranslateOptions {
  /** 源语言代码 */
  sourceLanguage?: string;
  /** 目标语言代码 */
  targetLanguage: string;
  /** 文本格式 (text/html) */
  format?: 'text' | 'html';
  /** 术语表ID */
  glossaryId?: string;
  /** 自定义上下文 */
  context?: string;
}

export interface TranslateResult {
  /** 翻译后的文本 */
  translatedText: string;
  /** 检测到的源语言 */
  detectedSourceLanguage?: string;
  /** 置信度分数 (0-1) */
  confidence?: number;
}

export interface BatchTranslateResult {
  /** 翻译结果数组 */
  translations: TranslateResult[];
  /** 总字符数 */
  totalCharacters: number;
  /** 总Token数（如果适用） */
  totalTokens?: number;
}

export interface AdapterConfig {
  /** API基础URL */
  baseUrl: string;
  /** API密钥（已解密） */
  apiKey: string;
  /** 额外配置 */
  config?: Record<string, any>;
  /** 超时时间（毫秒） */
  timeout?: number;
}

export interface TranslationProviderInfo {
  /** 供应商名称 */
  name: string;
  /** 供应商类型 */
  type: string;
  /** 支持的语言代码列表 */
  supportedLanguages: string[];
  /** 是否支持批量翻译 */
  supportsBatchTranslation: boolean;
  /** 是否支持HTML */
  supportsHtml: boolean;
  /** 单次最大字符数 */
  maxCharactersPerRequest: number;
  /** 单次最大文本数 */
  maxTextsPerRequest: number;
  /** 每分钟请求限制 */
  rateLimitPerMinute: number;
}

export interface ITranslationAdapter {
  /**
   * 初始化适配器
   * @param config 适配器配置
   */
  initialize(config: AdapterConfig): void;

  /**
   * 翻译单个文本
   * @param text 要翻译的文本
   * @param options 翻译选项
   * @returns 翻译结果
   */
  translate(text: string, options: TranslateOptions): Promise<TranslateResult>;

  /**
   * 批量翻译多个文本
   * @param texts 要翻译的文本数组
   * @param options 翻译选项
   * @returns 批量翻译结果
   */
  translateBatch(
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult>;

  /**
   * 检测文本语言
   * @param text 要检测的文本
   * @returns 检测到的语言代码
   */
  detectLanguage?(text: string): Promise<string>;

  /**
   * 获取支持的语言列表
   * @returns 支持的语言代码数组
   */
  getSupportedLanguages(): Promise<string[]>;

  /**
   * 检查适配器是否可用
   * @returns 是否可用
   */
  healthCheck(): Promise<boolean>;

  /**
   * 获取供应商信息
   * @returns 供应商信息
   */
  getProviderInfo(): TranslationProviderInfo;
}

/**
 * 翻译适配器抽象基类
 * 提供通用的功能实现
 */
export abstract class BaseTranslationAdapter implements ITranslationAdapter {
  protected config: AdapterConfig | null = null;
  protected providerInfo: TranslationProviderInfo;

  constructor(providerInfo: TranslationProviderInfo) {
    this.providerInfo = providerInfo;
  }

  initialize(config: AdapterConfig): void {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  abstract translate(
    text: string,
    options: TranslateOptions,
  ): Promise<TranslateResult>;

  abstract translateBatch(
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult>;

  abstract getSupportedLanguages(): Promise<string[]>;

  abstract healthCheck(): Promise<boolean>;

  getProviderInfo(): TranslationProviderInfo {
    return this.providerInfo;
  }

  /**
   * 验证配置是否已初始化
   */
  protected assertInitialized(): void {
    if (!this.config) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }
  }

  /**
   * 验证文本长度是否在限制范围内
   */
  protected validateTextLength(text: string): void {
    if (text.length > this.providerInfo.maxCharactersPerRequest) {
      throw new Error(
        `Text exceeds maximum length of ${this.providerInfo.maxCharactersPerRequest} characters`,
      );
    }
  }

  /**
   * 验证批量文本数量和长度
   */
  protected validateBatchTexts(texts: string[]): void {
    if (texts.length > this.providerInfo.maxTextsPerRequest) {
      throw new Error(
        `Batch size exceeds maximum of ${this.providerInfo.maxTextsPerRequest} texts`,
      );
    }

    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    if (totalChars > this.providerInfo.maxCharactersPerRequest) {
      throw new Error(
        `Total characters in batch exceeds maximum of ${this.providerInfo.maxCharactersPerRequest}`,
      );
    }
  }

  /**
   * 标准化语言代码
   */
  protected normalizeLanguageCode(code: string): string {
    // 统一转换为小写并处理特殊情况
    const normalized = code.toLowerCase();

    // 处理中文特殊代码
    const chineseMappings: Record<string, string> = {
      zh: 'zh-cn',
      'zh-hans': 'zh-cn',
      'zh-hant': 'zh-tw',
      'zh-hk': 'zh-tw',
      'zh-mo': 'zh-tw',
    };

    return chineseMappings[normalized] || normalized;
  }

  /**
   * 分割超长文本
   */
  protected splitLongText(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let currentChunk = '';

    // 按句子分割
    const sentences = text.split(/(?<=[.!?。！？]\s+)/);

    for (const sentence of sentences) {
      if ((currentChunk + sentence).length <= maxLength) {
        currentChunk += sentence;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
