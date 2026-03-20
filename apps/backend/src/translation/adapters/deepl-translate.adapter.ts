import {
  BaseTranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
} from './translation-adapter.interface';

interface DeepLTranslateResponse {
  translations: Array<{
    detected_source_language?: string;
    text: string;
  }>;
}

interface DeepLLanguagesResponse {
  language: string;
  name: string;
  supports_formality?: boolean;
}

/**
 * DeepL Translation API 适配器
 * 支持DeepL API Free和Pro版本
 */
export class DeepLTranslateAdapter extends BaseTranslationAdapter {
  constructor() {
    super({
      name: 'DeepL',
      type: 'DEEPL',
      supportedLanguages: [],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 5000,
      maxTextsPerRequest: 50,
      rateLimitPerMinute: 100,
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

    const targetLang = this.mapToDeepLLanguageCode(options.targetLanguage);
    const sourceLang = options.sourceLanguage
      ? this.mapToDeepLLanguageCode(options.sourceLanguage)
      : undefined;

    const url = new URL(`${this.config!.baseUrl}/v2/translate`);

    const body = new URLSearchParams();
    texts.forEach((text) => body.append('text', text));
    body.append('target_lang', targetLang.toUpperCase());

    if (sourceLang) {
      body.append('source_lang', sourceLang.toUpperCase());
    }

    // DeepL支持HTML标签处理
    if (options.format === 'html') {
      body.append('tag_handling', 'html');
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${this.config!.apiKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `DeepL API error: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = `DeepL API error: ${errorJson.message || errorText}`;
        } catch {
          errorMessage = `DeepL API error: ${errorText}`;
        }
        throw new Error(errorMessage);
      }

      const data: DeepLTranslateResponse = await response.json();

      const translations: TranslateResult[] = data.translations.map((t) => ({
        translatedText: t.text,
        detectedSourceLanguage: t.detected_source_language?.toLowerCase(),
        confidence: undefined,
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

    try {
      const targetLangs = await this.fetchLanguages('target');
      this.providerInfo.supportedLanguages = targetLangs;
      return targetLangs;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to get supported languages: ${String(error)}`);
    }
  }

  private async fetchLanguages(type: 'source' | 'target'): Promise<string[]> {
    const url = new URL(`${this.config!.baseUrl}/v2/languages`);
    url.searchParams.append('type', type);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `DeepL-Auth-Key ${this.config!.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${type} languages: ${response.statusText}`,
      );
    }

    const data: DeepLLanguagesResponse[] = await response.json();
    return data.map((lang) => lang.language.toLowerCase());
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
   * 将标准语言代码映射为DeepL特定代码
   */
  private mapToDeepLLanguageCode(code: string): string {
    const normalized = code.toLowerCase();

    // DeepL特定语言代码映射
    const deeplMappings: Record<string, string> = {
      'zh-cn': 'zh',
      'zh-tw': 'zh',
      'zh-hans': 'zh',
      'zh-hant': 'zh',
      en: 'en-us',
      'en-gb': 'en-gb',
      'en-us': 'en-us',
      pt: 'pt-pt',
      'pt-br': 'pt-br',
      'pt-pt': 'pt-pt',
    };

    return deeplMappings[normalized] || normalized;
  }
}
