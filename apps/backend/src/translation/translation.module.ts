import { Module } from '@nestjs/common';
import { TranslationService } from './translation.service';
import { TranslationController } from './translation.controller';
import { MachineTranslationController } from './machine-translation.controller';
import { EncryptionService, MachineTranslationService } from './services';
import { PrismaModule } from '../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TranslationController, MachineTranslationController],
  providers: [TranslationService, EncryptionService, MachineTranslationService],
  exports: [EncryptionService, MachineTranslationService],
})
export class TranslationModule {}
