import { Module } from '@nestjs/common';
import { NamespaceService } from './namespace.service';
import { NamespaceController } from './namespace.controller';

@Module({
  controllers: [NamespaceController],
  providers: [NamespaceService],
})
export class NamespaceModule {}
