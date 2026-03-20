import { Module } from '@nestjs/common';
import { NamespaceService } from './namespace.service';
import { NamespaceController } from './namespace.controller';
import { TranslationModule } from '../translation/translation.module';

@Module({
  imports: [TranslationModule],
  controllers: [NamespaceController],
  providers: [NamespaceService],
})
export class NamespaceModule {}
