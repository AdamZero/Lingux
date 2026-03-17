import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { ProjectModule } from './project/project.module';
import { NamespaceModule } from './namespace/namespace.module';
import { KeyModule } from './key/key.module';
import { TranslationModule } from './translation/translation.module';
import { LocaleModule } from './locale/locale.module';
import { ReleaseModule } from './release/release.module';
import { AuthModule } from './auth/auth.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { LoggerModule } from './common/logger/logger.module';
import { AsyncContextModule } from './common/context/async-context.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLogMiddleware } from './common/middleware/request-log.middleware';
import { APP_FILTER } from '@nestjs/core';
import { WorkspaceModule } from './workspace/workspace.module';
import { ConfigModule } from './config/config.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    AsyncContextModule,
    LoggerModule,
    PrismaModule,
    AuthModule,
    EnterpriseModule,
    ProjectModule,
    NamespaceModule,
    KeyModule,
    TranslationModule,
    LocaleModule,
    ReleaseModule,
    WorkspaceModule,
    ConfigModule,
    ReviewsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestLogMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
