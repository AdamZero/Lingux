import { Module } from '@nestjs/common';
import { LocaleService } from './locale.service';
import { LocaleController } from './locale.controller';

@Module({
  controllers: [LocaleController],
  providers: [LocaleService],
})
export class LocaleModule {}
