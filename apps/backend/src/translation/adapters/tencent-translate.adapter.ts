import {
  ITranslationAdapter,
  TranslateOptions,
  TranslateResult,
  BatchTranslateResult,
  AdapterConfig,
  TranslationProviderInfo,
} from './translation-adapter.interface';
import * as tencentcloud from 'tencentcloud-sdk-nodejs-tmt';
import { WinstonLoggerService } from '../../common/logger/logger.service';

const TmtClient = tencentcloud.tmt.v20180321.Client;

/**
 * 腾讯翻译适配器
 * 使用腾讯云官方 Node.js SDK
 * 文档: https://cloud.tencent.com/document/product/551/15612
 */
export class TencentTranslateAdapter implements ITranslationAdapter {
  private config: AdapterConfig | null = null;
  private client: InstanceType<typeof TmtClient> | null = null;
  private logger: WinstonLoggerService | null = null;

  constructor(logger?: WinstonLoggerService) {
    this.logger = logger || null;
  }

  setLogger(logger: WinstonLoggerService): void {
    this.logger = logger;
  }

  initialize(config: AdapterConfig): void {
    this.config = {
      timeout: 30000,
      ...config,
    };

    const { apiKey, baseUrl } = this.config;
    const [secretId, secretKey] = apiKey.split(':');

    if (!secretId || !secretKey) {
      throw new Error('Invalid API key format. Expected "secretId:secretKey"');
    }

    this.log('info', '[TencentAdapter] Initializing with config', {
      baseUrl,
      region: 'ap-guangzhou',
      secretIdPrefix: secretId.substring(0, 4) + '****',
    });

    // 初始化腾讯云客户端
    this.client = new TmtClient({
      credential: {
        secretId,
        secretKey,
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint:
            baseUrl?.replace('https://', '') || 'tmt.tencentcloudapi.com',
          reqTimeout: this.config.timeout,
        },
      },
    });
  }

  getProviderInfo(): TranslationProviderInfo {
    return {
      name: 'Tencent Translate',
      type: 'TENCENT',
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
        'it',
        'vi',
        'th',
        'id',
        'ms',
        'tr',
        'pl',
        'nl',
        'sv',
        'cs',
      ],
      supportsBatchTranslation: true,
      supportsHtml: true,
      maxCharactersPerRequest: 2000,
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

    // 腾讯 API 需要简化的语言代码（截取 - 前一部分）
    const sourceLang = (options.sourceLanguage || 'auto').split('-')[0];
    const targetLang = options.targetLanguage.split('-')[0];

    const requestParams = {
      SourceText: text,
      Source: sourceLang,
      Target: targetLang,
      ProjectId: 0,
    };

    this.log('info', '[TencentAdapter] Translate request', {
      ...requestParams,
      SourceText: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    });

    try {
      const response = await this.client!.TextTranslate(requestParams);

      this.log('info', '[TencentAdapter] Translate response', {
        TargetText: response.TargetText?.substring(0, 50),
        Source: response.Source,
        RequestId: response.RequestId,
      });

      return {
        translatedText: response.TargetText || '',
        detectedSourceLanguage: response.Source,
        confidence: undefined,
      };
    } catch (error: any) {
      this.log('error', '[TencentAdapter] Translate error', {
        message: error.message,
        code: error.code,
        requestId: error.requestId,
        stack: error.stack,
        error: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      throw new Error(
        `Tencent Translate API error: ${error.message || 'Unknown error'}`,
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

    this.log('info', `[TencentAdapter] Batch translate: ${texts.length} texts`);

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      this.log('info', `[TencentAdapter] Translating ${i + 1}/${texts.length}`);
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
    this.log('info', '[TencentAdapter] Health check started');

    try {
      const result = await this.translate('Hello', {
        targetLanguage: 'zh',
        sourceLanguage: 'en',
      });

      this.log('info', '[TencentAdapter] Health check passed', {
        translatedText: result.translatedText,
        detectedSourceLanguage: result.detectedSourceLanguage,
      });

      return true;
    } catch (error: any) {
      this.log('error', '[TencentAdapter] Health check failed', {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      return false;
    }
  }

  private log(
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (this.logger) {
      if (level === 'error') {
        this.logger.error(message, undefined, metadata);
      } else if (level === 'warn') {
        this.logger.warn(message, metadata);
      } else if (level === 'debug') {
        this.logger.debug(message, metadata);
      } else {
        this.logger.log(message, metadata);
      }
    }
  }

  private assertInitialized(): void {
    if (!this.config || !this.client) {
      throw new Error('Adapter not initialized. Call initialize() first.');
    }
  }

  private validateText(text: string): void {
    if (!text || text.trim().length === 0) {
      throw new Error('Text is required');
    }
    if (text.length > 2000) {
      throw new Error('Text exceeds maximum length of 2000 characters');
    }
  }
}
