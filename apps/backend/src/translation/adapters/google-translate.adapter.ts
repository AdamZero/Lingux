import {
  BaseTranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
} from './translation-adapter.interface';

interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
      detectedSourceLanguage?: string;
    }>;
  };
}

interface GoogleLanguagesResponse {
  data: {
    languages: Array<{
      language: string;
      name: string;
    }>;
  };
}

/**
 * Google Cloud Translation API 适配器
 * 支持Google翻译API v2
 */
export class GoogleTranslateAdapter extends BaseTranslationAdapter {
  private readonly apiVersion = 'v2';

  constructor() {
    super({
      name: 'Google Cloud Translation',
      type: 'GOOGLE',
      supportedLanguages: [],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 5000,
      maxTextsPerRequest: 128,
      rateLimitPerMinute: 1000,
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

    const url = new URL(
      `${this.config!.baseUrl}/language/translate/${this.apiVersion}`,
    );
    url.searchParams.append('key', this.config!.apiKey);

    const body: Record<string, any> = {
      q: texts,
      target: targetLang,
      format: options.format === 'html' ? 'html' : 'text',
    };

    if (sourceLang) {
      body.source = sourceLang;
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Google Translate API error: ${error.error?.message || response.statusText}`,
        );
      }

      const data: GoogleTranslateResponse = await response.json();

      const translations: TranslateResult[] = data.data.translations.map(
        (t) => ({
          translatedText: this.decodeHtmlEntities(t.translatedText),
          detectedSourceLanguage: t.detectedSourceLanguage,
          confidence: undefined,
        }),
      );

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

    const url = new URL(
      `${this.config!.baseUrl}/language/translate/${this.apiVersion}/languages`,
    );
    url.searchParams.append('key', this.config!.apiKey);

    try {
      const response = await fetch(url.toString());

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `Google Translate API error: ${error.error?.message || response.statusText}`,
        );
      }

      const data: GoogleLanguagesResponse = await response.json();
      const languages = data.data.languages.map((lang) =>
        lang.language.toLowerCase(),
      );

      this.providerInfo.supportedLanguages = languages;
      return languages;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get supported languages: ${String(error)}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      this.assertInitialized();
      const languages = await this.getSupportedLanguages();
      return languages.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 解码HTML实体
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
    };

    return text.replace(
      /&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g,
      (match) => entities[match] || match,
    );
  }
}
