import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { Logger } from 'winston';
import { createWinstonLogger } from './winston.config';
import { AsyncContextService } from '../context/async-context.service';

@Injectable()
export class WinstonLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor(private readonly asyncContext: AsyncContextService) {
    this.logger = createWinstonLogger('lingux-backend');
  }

  private getContextMetadata() {
    const context = this.asyncContext.getContext();
    if (!context) {
      return {};
    }
    return {
      requestId: context.requestId,
      userId: context.userId,
      path: context.path,
      method: context.method,
    };
  }

  log(message: string, metadata?: Record<string, unknown>) {
    this.logger.info(message, {
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    });
  }

  error(message: string, trace?: string, metadata?: Record<string, unknown>) {
    this.logger.error(message, {
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
      stack: trace,
    });
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.logger.warn(message, {
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    });
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.logger.debug(message, {
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    });
  }

  verbose(message: string, metadata?: Record<string, unknown>) {
    this.logger.verbose?.(message, {
      metadata: {
        ...this.getContextMetadata(),
        ...metadata,
      },
    });
  }

  // 兼容 NestJS LoggerService 接口
  setLogLevels?(_levels: LogLevel[]) {
    // Winston 自动处理级别
  }
}
