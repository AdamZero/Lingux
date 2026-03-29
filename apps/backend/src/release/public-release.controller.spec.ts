import { Test, TestingModule } from '@nestjs/testing';
import { PublicReleaseController } from './public-release.controller';
import { ReleaseService } from './release.service';

const mockReleaseService = {
  getReleasePublic: jest.fn(),
  getArtifactPublic: jest.fn(),
};

describe('PublicReleaseController', () => {
  let controller: PublicReleaseController;
  let service: typeof mockReleaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicReleaseController],
      providers: [
        {
          provide: ReleaseService,
          useValue: mockReleaseService,
        },
      ],
    }).compile();

    controller = module.get<PublicReleaseController>(PublicReleaseController);
    service = module.get(ReleaseService);
    jest.clearAllMocks();
  });

  describe('getReleasePublic', () => {
    it('should return release details', async () => {
      const releaseId = 'rel-1';
      const releaseData = {
        id: releaseId,
        projectId: 'proj-1',
        projectName: 'Test Project',
        version: 1,
        status: 'PUBLISHED',
        localeCodes: ['zh-CN', 'en-US'],
      };

      service.getReleasePublic.mockResolvedValue(releaseData);

      const result = await controller.getReleasePublic(releaseId);

      expect(result).toEqual(releaseData);
      expect(service.getReleasePublic).toHaveBeenCalledWith(releaseId);
    });
  });

  describe('getArtifactPublic', () => {
    it('should return artifact data', async () => {
      const releaseId = 'rel-1';
      const localeCode = 'zh-CN';
      const artifactData = { 'common.key': 'value' };

      service.getArtifactPublic.mockResolvedValue(artifactData);

      const result = await controller.getArtifactPublic(releaseId, localeCode);

      expect(result).toEqual(artifactData);
      expect(service.getArtifactPublic).toHaveBeenCalledWith(
        releaseId,
        localeCode,
      );
    });
  });
});
