import { Module } from '@nestjs/common';
import { KeyService } from './key.service';
import { KeyController } from './key.controller';
import { TranslationModule } from '../translation/translation.module';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule, TranslationModule],
  controllers: [KeyController],
  providers: [KeyService],
  exports: [KeyService],
})
export class KeyModule {}
