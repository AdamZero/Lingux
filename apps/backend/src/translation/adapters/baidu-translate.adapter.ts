import {
  ITranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
  AdapterConfig,
  TranslationProviderInfo,
} from './translation-adapter.interface';
import * as crypto from 'crypto';

/**
 * 百度翻译适配器
 * 支持百度翻译开放平台 API
 * 文档: https://fanyi-api.baidu.com/doc/21
 */
export class BaiduTranslateAdapter implements ITranslationAdapter {
  private config: AdapterConfig | null = null;

  initialize(config: AdapterConfig): void {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  getProviderInfo(): TranslationProviderInfo {
    return {
      name: 'Baidu Translate',
      type: 'BAIDU',
      supportedLanguages: [
        'zh',
        'en',
        'jp',
        'kor',
        'fra',
        'de',
        'ru',
        'spa',
        'pt',
        'it',
        'vie',
        'th',
        'ara',
        'id',
        'ms',
        'tr',
        'pl',
        'nl',
        'swe',
        'cs',
      ],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 6000,
      maxTextsPerRequest: 1,
      rateLimitPerMinute: 1000,
    };
  }

  async translate(
    text: string,
    options: TranslateOptions,
  ): Promise<TranslateResult> {
    this.assertInitialized();
    this.validateText(text);

    const { apiKey, baseUrl } = this.config!;
    const [appId, secretKey] = apiKey.split(':');

    if (!appId || !secretKey) {
      throw new Error('Invalid API key format. Expected "appId:secretKey"');
    }

    const salt = Date.now().toString();
    const sign = this.generateSign(appId, text, salt, secretKey);

    const params = new URLSearchParams({
      q: text,
      from: this.mapLanguageCode(options.sourceLanguage || 'auto'),
      to: this.mapLanguageCode(options.targetLanguage),
      appid: appId,
      salt,
      sign,
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/trans/vip/translate?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Baidu Translate API error: ${error.error_msg || 'Unknown error'}`,
        );
      }

      const data = await response.json();

      if (data.error_code) {
        throw new Error(`Baidu Translate API error: ${data.error_msg}`);
      }

      return {
        translatedText: data.trans_result?.[0]?.dst || text,
        detectedSourceLanguage: data.from,
        confidence: undefined,
      };
    } catch (error) {
      throw new Error(
        `Baidu Translate request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async translateBatch(
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult> {
    this.assertInitialized();

    const translations: TranslateResult[] = [];
    let totalChars = 0;

    // 百度翻译支持批量，但用 \n 分隔，这里为了简单逐个调用
    for (const text of texts) {
      const result = await this.translate(text, options);
      translations.push(result);
      totalChars += text.length;
    }

    return {
      translations,
      totalCharacters: totalChars,
    };
  }

  async getSupportedLanguages(): Promise<string[]> {
    return this.getProviderInfo().supportedLanguages;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.translate('Hello', {
        targetLanguage: 'zh',
        sourceLanguage: 'en',
      });
      return true;
    } catch {
      return false;
    }
  }

  private assertInitialized(): void {
    if (!this.config) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }
  }

  private validateText(text: string): void {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required');
    }
    if (text.length > 6000) {
      throw new Error('Text exceeds maximum length of 6000 characters');
    }
  }

  private generateSign(
    appId: string,
    query: string,
    salt: string,
    secretKey: string,
  ): string {
    const str = appId + query + salt + secretKey;
    return crypto.createHash('md5').update(str).digest('hex');
  }

  private mapLanguageCode(code: string): string {
    const mappings: Record<string, string> = {
      zh: 'zh',
      en: 'en',
      ja: 'jp',
      jp: 'jp',
      ko: 'kor',
      kor: 'kor',
      fr: 'fra',
      fra: 'fra',
      de: 'de',
      ru: 'ru',
      es: 'spa',
      spa: 'spa',
      pt: 'pt',
      it: 'it',
      vi: 'vie',
      vie: 'vie',
      th: 'th',
      ar: 'ara',
      ara: 'ara',
      id: 'id',
      ms: 'ms',
      tr: 'tr',
      pl: 'pl',
      nl: 'nl',
      sv: 'swe',
      swe: 'swe',
      cs: 'cs',
      auto: 'auto',
    };
    return mappings[code] || code;
  }
}
