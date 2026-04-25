import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description?: string;
}

@Injectable()
export class ConfigService {
  constructor(private prisma: PrismaService) {}

  async getFeatureFlags(): Promise<FeatureFlag[]> {
    const configs = await this.prisma.config.findMany({
      where: {
        key: {
          startsWith: 'feature.',
        },
      },
    });

    return configs.map((config) => ({
      key: config.key.replace('feature.', ''),
      enabled: (config.value as any).enabled ?? false,
      description: config.description || undefined,
    }));
  }

  async updateFeatureFlag(key: string, enabled: boolean): Promise<FeatureFlag> {
    const configKey = `feature.${key}`;

    const config = await this.prisma.config.findUnique({
      where: { key: configKey },
    });

    if (!config) {
      throw new NotFoundException(`Feature flag ${key} not found`);
    }

    const updated = await this.prisma.config.update({
      where: { key: configKey },
      data: {
        value: {
          ...(config.value as any),
          enabled,
        },
      },
    });

    return {
      key,
      enabled,
      description: updated.description || undefined,
    };
  }
}
