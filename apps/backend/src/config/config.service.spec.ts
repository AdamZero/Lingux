import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('ConfigService', () => {
  let service: ConfigService;
  let prisma: PrismaService;

  const mockPrisma = {
    config: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getFeatureFlags', () => {
    it('should return all feature flags', async () => {
      const mockConfigs = [
        {
          key: 'feature.review',
          value: { enabled: true },
          description: 'Review feature',
        },
        {
          key: 'feature.import',
          value: { enabled: false },
          description: 'Import feature',
        },
        {
          key: 'feature.export',
          value: { enabled: true },
          description: null,
        },
      ];

      mockPrisma.config.findMany.mockResolvedValue(mockConfigs);

      const result = await service.getFeatureFlags();

      expect(prisma.config.findMany).toHaveBeenCalledWith({
        where: {
          key: {
            startsWith: 'feature.',
          },
        },
      });

      expect(result).toEqual([
        { key: 'review', enabled: true, description: 'Review feature' },
        { key: 'import', enabled: false, description: 'Import feature' },
        { key: 'export', enabled: true, description: undefined },
      ]);
    });

    it('should handle empty feature flags', async () => {
      mockPrisma.config.findMany.mockResolvedValue([]);

      const result = await service.getFeatureFlags();

      expect(result).toEqual([]);
    });

    it('should handle missing enabled field', async () => {
      const mockConfigs = [
        {
          key: 'feature.test',
          value: {},
          description: 'Test feature',
        },
      ];

      mockPrisma.config.findMany.mockResolvedValue(mockConfigs);

      const result = await service.getFeatureFlags();

      expect(result).toEqual([
        { key: 'test', enabled: false, description: 'Test feature' },
      ]);
    });
  });

  describe('updateFeatureFlag', () => {
    it('should update feature flag successfully', async () => {
      const key = 'review';
      const enabled = true;
      const configKey = 'feature.review';

      const existingConfig = {
        key: configKey,
        value: { enabled: false },
        description: 'Review feature',
      };

      const updatedConfig = {
        key: configKey,
        value: { enabled: true },
        description: 'Review feature',
      };

      mockPrisma.config.findUnique.mockResolvedValue(existingConfig);
      mockPrisma.config.update.mockResolvedValue(updatedConfig);

      const result = await service.updateFeatureFlag(key, enabled);

      expect(prisma.config.findUnique).toHaveBeenCalledWith({
        where: { key: configKey },
      });

      expect(prisma.config.update).toHaveBeenCalledWith({
        where: { key: configKey },
        data: {
          value: {
            enabled: true,
          },
        },
      });

      expect(result).toEqual({
        key: 'review',
        enabled: true,
        description: 'Review feature',
      });
    });

    it('should throw NotFoundException when feature flag does not exist', async () => {
      const key = 'nonexistent';
      const enabled = true;

      mockPrisma.config.findUnique.mockResolvedValue(null);

      await expect(service.updateFeatureFlag(key, enabled)).rejects.toThrow(
        NotFoundException,
      );

      await expect(service.updateFeatureFlag(key, enabled)).rejects.toThrow(
        'Feature flag nonexistent not found',
      );
    });

    it('should preserve other fields when updating enabled', async () => {
      const key = 'review';
      const enabled = true;
      const configKey = 'feature.review';

      const existingConfig = {
        key: configKey,
        value: { enabled: false, someOtherField: 'value' },
        description: 'Review feature',
      };

      const updatedConfig = {
        key: configKey,
        value: { enabled: true, someOtherField: 'value' },
        description: 'Review feature',
      };

      mockPrisma.config.findUnique.mockResolvedValue(existingConfig);
      mockPrisma.config.update.mockResolvedValue(updatedConfig);

      await service.updateFeatureFlag(key, enabled);

      expect(prisma.config.update).toHaveBeenCalledWith({
        where: { key: configKey },
        data: {
          value: {
            enabled: true,
            someOtherField: 'value',
          },
        },
      });
    });
  });
});
