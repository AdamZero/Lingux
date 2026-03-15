import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    EnterpriseModule,
    ProjectModule,
    NamespaceModule,
    KeyModule,
    TranslationModule,
    LocaleModule,
    ReleaseModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
