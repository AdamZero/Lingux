import { Test, TestingModule } from '@nestjs/testing';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';

describe('ConfigController', () => {
  let controller: ConfigController;
  let service: ConfigService;

  const mockConfigService = {
    getFeatureFlags: jest.fn(),
    updateFeatureFlag: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigController],
      providers: [
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    controller = module.get<ConfigController>(ConfigController);
    service = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFeatureFlags', () => {
    it('should return feature flags from service', async () => {
      const mockFlags = [
        { key: 'review', enabled: true, description: 'Review feature' },
        { key: 'import', enabled: false },
      ];

      mockConfigService.getFeatureFlags.mockResolvedValue(mockFlags);

      const result = await controller.getFeatureFlags();

      expect(service.getFeatureFlags).toHaveBeenCalled();
      expect(result).toEqual(mockFlags);
    });
  });

  describe('updateFeatureFlag', () => {
    it('should update feature flag', async () => {
      const key = 'review';
      const enabled = true;
      const mockResult = { key, enabled, description: 'Updated' };

      mockConfigService.updateFeatureFlag.mockResolvedValue(mockResult);

      const result = await controller.updateFeatureFlag(key, enabled);

      expect(service.updateFeatureFlag).toHaveBeenCalledWith(key, enabled);
      expect(result).toEqual(mockResult);
    });
  });
});
