import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLoggerService } from './common/logger/logger.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly logger: WinstonLoggerService) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit() {
    try {
      this.logger.log('Connecting to database...');
      await this.$connect();
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to connect to database',
        error instanceof Error ? error.stack : undefined,
      );
      // Don't exit here to allow manual database start
      // process.exit(1);
    }
  }
}
