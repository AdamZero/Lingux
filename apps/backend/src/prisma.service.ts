import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLoggerService } from './common/logger/logger.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(@Optional() private readonly logger?: WinstonLoggerService) {
    const connectionString = process.env.DATABASE_URL;
    // In test environment without DATABASE_URL, we need to provide a valid config
    // Using the default constructor which will look for DATABASE_URL env var
    if (!connectionString) {
      // Set a dummy DATABASE_URL for the super() call
      process.env.DATABASE_URL =
        'postgresql://dummy:dummy@localhost:5432/dummy';
    }
    super({
      adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    });
    // Restore original value (undefined) after super() call
    if (!connectionString) {
      delete process.env.DATABASE_URL;
    }
  }

  async onModuleInit() {
    // Skip connection in test environment (when DATABASE_URL is not set)
    if (!process.env.DATABASE_URL) {
      return;
    }
    try {
      this.logger?.log('Connecting to database...');
      await this.$connect();
      this.logger?.log('Database connected successfully');
    } catch (error) {
      this.logger?.error(
        'Failed to connect to database',
        error instanceof Error ? error.stack : undefined,
      );
      // Don't exit here to allow manual database start
      // process.exit(1);
    }
  }
}
