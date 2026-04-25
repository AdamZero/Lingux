import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { LoggerModule } from './common/logger/logger.module';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
