import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseController } from './release.controller';
import { ReleaseService } from './release.service';

const mockReleaseService = {
  previewRelease: jest.fn(),
  publishReleaseSession: jest.fn(),
  getActiveReleaseSession: jest.fn(),
  getReleaseSession: jest.fn(),
  submitReleaseSession: jest.fn(),
  approveReleaseSession: jest.fn(),
  rejectReleaseSession: jest.fn(),
  listReleases: jest.fn(),
  getRelease: jest.fn(),
  rollback: jest.fn(),
  getArtifact: jest.fn(),
  getLatestArtifact: jest.fn(),
};

describe('ReleaseController', () => {
  let controller: ReleaseController;
  let service: typeof mockReleaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReleaseController],
      providers: [
        {
          provide: ReleaseService,
          useValue: mockReleaseService,
        },
      ],
    }).compile();

    controller = module.get<ReleaseController>(ReleaseController);
    service = module.get(ReleaseService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should preview release', async () => {
    const projectId = 'proj-1';
    const dto = { baseReleaseId: 'rel-1', scope: { type: 'all' } };
    const expected = { ok: true };
    service.previewRelease.mockResolvedValue(expected);

    const result = await controller.preview(projectId, dto as never);
    expect(result).toEqual(expected);
    expect(service.previewRelease).toHaveBeenCalledWith(projectId, dto);
  });

  it('should create release', async () => {
    const projectId = 'proj-1';
    const dto = { sessionId: 'sess-1' };
    const expected = { releaseId: 'rel-2', currentReleaseId: 'rel-2' };
    service.publishReleaseSession.mockResolvedValue(expected);

    const result = await controller.create(projectId, dto as never);
    expect(result).toEqual(expected);
    expect(service.publishReleaseSession).toHaveBeenCalledWith(
      projectId,
      'sess-1',
    );
  });

  it('should list releases', async () => {
    const projectId = 'proj-1';
    const query = { limit: '10' };
    const expected = { items: [], nextCursor: null };
    service.listReleases.mockResolvedValue(expected);

    const result = await controller.list(projectId, query as never);
    expect(result).toEqual(expected);
    expect(service.listReleases).toHaveBeenCalledWith(projectId, query);
  });

  it('should get release', async () => {
    const projectId = 'proj-1';
    const releaseId = 'rel-1';
    const expected = { id: releaseId };
    service.getRelease.mockResolvedValue(expected);

    const result = await controller.get(projectId, releaseId);
    expect(result).toEqual(expected);
    expect(service.getRelease).toHaveBeenCalledWith(projectId, releaseId);
  });

  it('should rollback release', async () => {
    const projectId = 'proj-1';
    const releaseId = 'rel-1';
    const expected = { currentReleaseId: 'rel-0' };
    service.rollback.mockResolvedValue(expected);

    const result = await controller.rollback(projectId, releaseId, {
      toReleaseId: 'rel-0',
    });
    expect(result).toEqual(expected);
    expect(service.rollback).toHaveBeenCalledWith(
      projectId,
      releaseId,
      'rel-0',
    );
  });

  it('should get artifact', async () => {
    const projectId = 'proj-1';
    const releaseId = 'rel-1';
    const localeCode = 'en-US';
    const expected = { common: { hello: 'Hello' } };
    service.getArtifact.mockResolvedValue(expected);

    const result = await controller.getArtifact(
      projectId,
      releaseId,
      localeCode,
    );
    expect(result).toEqual(expected);
    expect(service.getArtifact).toHaveBeenCalledWith(
      projectId,
      releaseId,
      localeCode,
    );
  });

  it('should get latest artifact', async () => {
    const projectId = 'proj-1';
    const localeCode = 'en-US';
    const expected = { common: { hello: 'Hello' } };
    service.getLatestArtifact.mockResolvedValue(expected);

    const result = await controller.getLatestArtifact(projectId, localeCode);
    expect(result).toEqual(expected);
    expect(service.getLatestArtifact).toHaveBeenCalledWith(
      projectId,
      localeCode,
    );
  });
});
