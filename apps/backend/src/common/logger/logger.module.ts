import { Global, Module } from '@nestjs/common';
import { WinstonLoggerService } from './logger.service';
import { AsyncContextModule } from '../context/async-context.module';

@Global()
@Module({
  imports: [AsyncContextModule],
  providers: [WinstonLoggerService],
  exports: [WinstonLoggerService],
})
export class LoggerModule {}
