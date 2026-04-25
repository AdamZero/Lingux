import {
  BaseTranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
} from './translation-adapter.interface';

interface CustomApiResponse {
  translations?: Array<{
    text: string;
    detectedSourceLanguage?: string;
    confidence?: number;
  }>;
  error?: string;
}

/**
 * 自定义翻译API适配器
 * 支持符合通用规范的自定义翻译API
 *
 * 期望的API格式：
 * POST /translate
 * Request: { texts: string[], sourceLanguage?: string, targetLanguage: string, format?: string }
 * Response: { translations: [{ text: string, detectedSourceLanguage?: string, confidence?: number }] }
 */
export class CustomTranslateAdapter extends BaseTranslationAdapter {
  constructor() {
    super({
      name: 'Custom Translation API',
      type: 'CUSTOM',
      supportedLanguages: [],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 10000,
      maxTextsPerRequest: 100,
      rateLimitPerMinute: 60,
    });
  }

  async translate(
    text: string,
    options: TranslateOptions,
  ): Promise<TranslateResult> {
    this.assertInitialized();
    this.validateTextLength(text);

    const result = await this.translateBatch([text], options);
    return result.translations[0];
  }

  async translateBatch(
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult> {
    this.assertInitialized();
    this.validateBatchTexts(texts);

    const targetLang = this.normalizeLanguageCode(options.targetLanguage);
    const sourceLang = options.sourceLanguage
      ? this.normalizeLanguageCode(options.sourceLanguage)
      : undefined;

    // 从配置中获取端点路径，默认为 /translate
    const endpoint = this.config!.config?.endpoint || '/translate';
    const url = new URL(endpoint, this.config!.baseUrl);

    const body = {
      texts,
      targetLanguage: targetLang,
      ...(sourceLang && { sourceLanguage: sourceLang }),
      ...(options.format && { format: options.format }),
      ...(options.context && { context: options.context }),
      ...(options.glossaryId && { glossaryId: options.glossaryId }),
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // 支持多种认证方式
      const authType = this.config!.config?.authType || 'bearer';
      switch (authType) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${this.config!.apiKey}`;
          break;
        case 'api-key':
          headers['X-API-Key'] = this.config!.apiKey;
          break;
        case 'custom': {
          const customHeader =
            this.config!.config?.authHeader || 'Authorization';
          headers[customHeader] = this.config!.apiKey;
          break;
        }
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom API error (${response.status}): ${errorText}`);
      }

      const data: CustomApiResponse = await response.json();

      if (data.error) {
        throw new Error(`Custom API error: ${data.error}`);
      }

      if (!data.translations || data.translations.length === 0) {
        throw new Error('Custom API returned empty translations');
      }

      const translations: TranslateResult[] = data.translations.map((t) => ({
        translatedText: t.text,
        detectedSourceLanguage: t.detectedSourceLanguage,
        confidence: t.confidence,
      }));

      const totalCharacters = texts.reduce((sum, text) => sum + text.length, 0);

      return {
        translations,
        totalCharacters,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Translation failed: ${String(error)}`);
    }
  }

  async getSupportedLanguages(): Promise<string[]> {
    this.assertInitialized();

    // 如果配置中预定义了支持的语言，直接返回
    const config = this.config!.config;
    if (config?.supportedLanguages && config.supportedLanguages.length > 0) {
      this.providerInfo.supportedLanguages = config.supportedLanguages;
      return config.supportedLanguages;
    }

    // 尝试从API获取支持的语言列表
    const languagesEndpoint = this.config!.config?.languagesEndpoint;
    if (languagesEndpoint) {
      try {
        const url = new URL(languagesEndpoint, this.config!.baseUrl);
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.config!.apiKey}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.languages)) {
            this.providerInfo.supportedLanguages = data.languages.map(
              (l: string) => l.toLowerCase(),
            );
            return this.providerInfo.supportedLanguages;
          }
        }
      } catch {
        // 如果获取失败，返回空数组
      }
    }

    // 默认返回常见语言代码
    const defaultLanguages = [
      'zh-cn',
      'zh-tw',
      'en',
      'ja',
      'ko',
      'fr',
      'de',
      'es',
      'pt',
      'ru',
      'it',
      'ar',
    ];
    this.providerInfo.supportedLanguages = defaultLanguages;
    return defaultLanguages;
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.assertInitialized();

      // 如果配置了健康检查端点，使用它
      const healthEndpoint = this.config!.config?.healthEndpoint;
      if (healthEndpoint) {
        const url = new URL(healthEndpoint, this.config!.baseUrl);
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.config!.apiKey}`,
          },
        });
        return response.ok;
      }

      // 否则尝试获取支持的语言列表
      const languages = await this.getSupportedLanguages();
      return languages.length > 0;
    } catch {
      return false;
    }
  }
}
