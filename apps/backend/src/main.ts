import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function bootstrap() {
  const envPath = path.join(__dirname, '../../.env');
  console.log('Loading env from:', envPath);
  dotenv.config({ path: envPath });
  console.log('DATABASE_URL after dotenv:', process.env.DATABASE_URL);
  
  const app = await NestFactory.create(AppModule);
  
  app.enableCors();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
