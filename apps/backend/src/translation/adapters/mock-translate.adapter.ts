import {
  ITranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
  AdapterConfig,
  TranslationProviderInfo,
} from './translation-adapter.interface';

/**
 * Mock 翻译适配器
 * 用于开发和测试环境，无需真实 API 密钥
 */
export class MockTranslateAdapter implements ITranslationAdapter {
  private config: AdapterConfig | null = null;
  private mockDelay = 500; // 模拟网络延迟

  initialize(config: AdapterConfig): void {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  getProviderInfo(): TranslationProviderInfo {
    return {
      name: 'Mock Translator',
      type: 'MOCK',
      supportedLanguages: [
        'zh',
        'en',
        'ja',
        'ko',
        'fr',
        'de',
        'es',
        'ru',
        'ar',
        'pt',
      ],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 5000,
      maxTextsPerRequest: 100,
      rateLimitPerMinute: 60,
    };
  }

  async translate(
    text: string,
    options: TranslateOptions,
  ): Promise<TranslateResult> {
    this.assertInitialized();
    this.validateText(text);

    // 模拟网络延迟
    await this.delay(this.mockDelay);

    const targetLang = options.targetLanguage || 'en';
    const sourceLang = options.sourceLanguage || this.detectLanguageMock(text);

    // 生成模拟翻译结果
    const translatedText = this.generateMockTranslation(
      text,
      sourceLang,
      targetLang,
    );

    return {
      translatedText,
      detectedSourceLanguage: options.sourceLanguage ? undefined : sourceLang,
      confidence: 0.95,
    };
  }

  async translateBatch(
    texts: string[],
    options: TranslateOptions,
  ): Promise<BatchTranslateResult> {
    this.assertInitialized();

    // 模拟网络延迟
    await this.delay(this.mockDelay);

    const translations: TranslateResult[] = [];
    let totalChars = 0;

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
    // Mock 适配器总是健康的
    return true;
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
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private detectLanguageMock(text: string): string {
    // 简单的语言检测模拟
    if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    if (/[\u0400-\u04ff]/.test(text)) return 'ru';
    if (/[\u0600-\u06ff]/.test(text)) return 'ar';
    return 'en';
  }

  private generateMockTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): string {
    // 生成模拟翻译文本
    const prefix = this.getLanguagePrefix(targetLang);
    return `[${prefix}] ${text}`;
  }

  private getLanguagePrefix(lang: string): string {
    const prefixes: Record<string, string> = {
      zh: '中文',
      en: 'EN',
      ja: '日本語',
      ko: '한국어',
      fr: 'FR',
      de: 'DE',
      es: 'ES',
      ru: 'RU',
      ar: 'AR',
      pt: 'PT',
    };
    return prefixes[lang] || lang.toUpperCase();
  }
}
