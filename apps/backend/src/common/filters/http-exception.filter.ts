import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WinstonLoggerService } from '../logger/logger.service';
import { AsyncContextService } from '../context/async-context.service';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: WinstonLoggerService,
    private readonly asyncContext: AsyncContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorMessage =
      typeof message === 'string'
        ? message
        : (message as { message: string }).message || 'Unknown error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: errorMessage,
      requestId: this.asyncContext.getRequestId(),
    };

    // 记录错误日志
    if (status >= 500) {
      this.logger.error(
        `Exception: ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
        {
          statusCode: status,
          path: request.url,
          method: request.method,
          userId: request.user?.id,
          body: request.body,
          query: request.query,
        },
      );
    } else {
      this.logger.warn(`Client Error: ${errorMessage}`, {
        statusCode: status,
        path: request.url,
        method: request.method,
        userId: request.user?.id,
      });
    }

    response.status(status).json(errorResponse);
  }
}
