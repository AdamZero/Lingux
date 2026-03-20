// 在加载其他模块之前先加载环境变量
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { WinstonLoggerService } from './common/logger/logger.service';

async function bootstrap() {
  // 创建应用时使用 WinstonLoggerService
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // 使用 WinstonLoggerService 作为应用日志器
  const winstonLogger = app.get(WinstonLoggerService);
  app.useLogger(winstonLogger);

  app.enableCors();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  await app.listen(process.env.PORT ?? 3000);
  winstonLogger.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
}
bootstrap();
