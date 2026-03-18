import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WinstonLoggerService } from '../logger/logger.service';
import { AsyncContextService } from '../context/async-context.service';
import { maskSensitiveData } from '../logger/utils/mask.util';
import '../../auth/types/auth.types'; // 引入类型扩展

@Injectable()
export class RequestLogMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly asyncContext: AsyncContextService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = uuidv4();
    const startTime = Date.now();

    // 提取用户ID（如果已认证）
    const userId = req.user?.id;

    // 创建请求上下文
    const context = {
      requestId,
      userId,
      path: req.path,
      method: req.method,
      startTime,
    };

    // 在 AsyncLocalStorage 中运行
    this.asyncContext.run(context, () => {
      // 记录请求开始
      this.logger.log('Request started', {
        requestId,
        userId,
        method: req.method,
        path: req.path,
        query: maskSensitiveData(req.query),
        body: maskSensitiveData(req.body),
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });

      // 响应完成时记录
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;

        if (statusCode >= 500) {
          this.logger.error('Request failed', undefined, {
            requestId,
            userId,
            method: req.method,
            path: req.path,
            statusCode,
            duration: `${duration}ms`,
          });
        } else if (statusCode >= 400) {
          this.logger.warn('Request client error', {
            requestId,
            userId,
            method: req.method,
            path: req.path,
            statusCode,
            duration: `${duration}ms`,
          });
        } else {
          this.logger.log('Request completed', {
            requestId,
            userId,
            method: req.method,
            path: req.path,
            statusCode,
            duration: `${duration}ms`,
          });
        }
      });

      next();
    });
  }
}
