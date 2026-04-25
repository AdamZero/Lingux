import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseService } from './release.service';
import { PrismaService } from '../prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TranslationStatus } from '@prisma/client';

const mockPrismaService = {
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  namespace: {
    findMany: jest.fn(),
  },
  key: {
    findMany: jest.fn(),
  },
  release: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  releaseArtifact: {
    findMany: jest.fn(),
    createMany: jest.fn(),
    findUnique: jest.fn(),
  },
  releaseSession: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ReleaseService', () => {
  let service: ReleaseService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReleaseService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReleaseService>(ReleaseService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();

    prisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) => {
        return await fn(prisma as unknown as never);
      },
    );

    prisma.user.findUnique.mockResolvedValue({ id: 'system-1' });
    prisma.project.update.mockResolvedValue({});
  });

  const projectId = 'proj-1';

  const projectContext = {
    id: projectId,
    baseLocale: 'zh-CN',
    currentReleaseId: 'rel-0',
    projectLocales: [
      { locale: { code: 'zh-CN' } },
      { locale: { code: 'en-US' } },
    ],
  };

  const keyRow = {
    id: 'key-1',
    name: 'login.submit',
    namespace: { id: 'ns-1', name: 'common' },
    translations: [
      {
        locale: { code: 'zh-CN' },
        content: '提交 {name}',
        status: TranslationStatus.PENDING,
      },
      {
        locale: { code: 'en-US' },
        content: 'Submit {name}',
        status: TranslationStatus.APPROVED,
      },
    ],
  };

  describe('previewRelease', () => {
    const userId = 'user-1';

    it('should throw ConflictException if baseReleaseId mismatches current', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);

      await expect(
        service.previewRelease(
          projectId,
          {
            baseReleaseId: 'rel-x',
            scope: { type: 'all' },
            localeCodes: ['en-US'],
          },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should return base/next json when valid', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);
      prisma.releaseArtifact.findMany.mockResolvedValue([
        { localeCode: 'en-US', data: { common: { 'login.submit': 'Old' } } },
      ]);
      prisma.key.findMany.mockResolvedValue([keyRow]);
      prisma.releaseSession.findFirst.mockResolvedValue(null);
      prisma.releaseSession.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          ({ id: 'sess-1', ...data }) as never,
      );

      const result = await service.previewRelease(
        projectId,
        {
          baseReleaseId: 'rel-0',
          scope: { type: 'keys', keyIds: ['key-1'] },
          localeCodes: ['en-US'],
        },
        userId,
      );

      expect(result.sessionId).toBe('sess-1');
      expect(result.status).toBe('DRAFT');
      expect(result.baseReleaseId).toBe('rel-0');
      expect(result.canPublish).toBe(true);
      expect(result.errors).toEqual([]);

      const base = JSON.parse(result.baseJson) as Record<
        string,
        Record<string, Record<string, string>>
      >;
      const next = JSON.parse(result.nextJson) as Record<
        string,
        Record<string, Record<string, string>>
      >;
      expect(base.common['login.submit']['en-US']).toBe('Old');
      expect(next.common['login.submit']['en-US']).toBe('Submit {name}');
    });

    it('should return errors when validation fails', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);
      prisma.releaseArtifact.findMany.mockResolvedValue([]);
      prisma.key.findMany.mockResolvedValue([
        {
          ...keyRow,
          translations: [
            {
              locale: { code: 'zh-CN' },
              content: '提交',
              status: TranslationStatus.PENDING,
            },
          ],
        },
      ]);
      prisma.releaseSession.findFirst.mockResolvedValue(null);
      prisma.releaseSession.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) =>
          ({ id: 'sess-2', ...data }) as never,
      );

      const result = await service.previewRelease(
        projectId,
        {
          baseReleaseId: 'rel-0',
          scope: { type: 'keys', keyIds: ['key-1'] },
          localeCodes: ['en-US'],
        },
        userId,
      );

      expect(result.canPublish).toBe(false);
      expect(result.errors).toEqual([
        expect.objectContaining({
          localeCode: 'en-US',
          keyId: 'key-1',
          reason: 'MISSING_TRANSLATION',
        }),
      ]);
    });

    it('should throw ConflictException when active session is locked', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);
      prisma.releaseArtifact.findMany.mockResolvedValue([]);
      prisma.key.findMany.mockResolvedValue([keyRow]);
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-locked',
        status: 'IN_REVIEW',
      });

      await expect(
        service.previewRelease(
          projectId,
          {
            baseReleaseId: 'rel-0',
            scope: { type: 'all' },
            localeCodes: ['en-US'],
          },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('submitReleaseSession', () => {
    it('should throw UnprocessableEntityException when session has validation errors', async () => {
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        projectId,
        status: 'DRAFT',
        validationErrors: [
          {
            localeCode: 'en-US',
            keyId: 'key-1',
            namespaceId: 'ns-1',
            keyName: 'login.submit',
            namespaceName: 'common',
            reason: 'MISSING_TRANSLATION',
          },
        ],
      });

      await expect(
        service.submitReleaseSession(projectId, 'sess-1'),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('publishReleaseSession', () => {
    it('should throw BadRequestException when session not approved', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        projectId,
        status: 'IN_REVIEW',
      });

      await expect(
        service.publishReleaseSession(projectId, 'sess-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create release and update project currentReleaseId', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        projectId,
        status: 'APPROVED',
        baseReleaseId: 'rel-0',
        scope: { type: 'all', localeCodes: ['en-US'] },
        localeCodes: ['en-US'],
        note: 'v2',
        nextArtifacts: {
          'en-US': { common: { 'login.submit': 'Submit {name}' } },
        },
      });
      prisma.release.findFirst.mockResolvedValue({ version: 1 });
      prisma.release.create.mockResolvedValue({
        id: 'rel-2',
        projectId,
        basedOnReleaseId: 'rel-0',
        version: 2,
        note: 'v2',
        scope: { type: 'all', localeCodes: ['en-US'] },
        createdAt: new Date(),
      });

      const result = await service.publishReleaseSession(
        projectId,
        'sess-1',
        'user-1',
      );

      expect(result.releaseId).toBe('rel-2');
      expect(result.currentReleaseId).toBe('rel-2');
      expect(prisma.releaseArtifact.createMany).toHaveBeenCalled();
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { currentReleaseId: 'rel-2' },
      });
      expect(prisma.releaseSession.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('getLatestArtifact', () => {
    it('should throw NotFoundException if no release published', async () => {
      prisma.project.findUnique.mockResolvedValue({ currentReleaseId: null });
      await expect(
        service.getLatestArtifact(projectId, 'en-US'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelDraft', () => {
    it('should allow creator to cancel their own draft', async () => {
      const sessionId = 'sess-1';
      const userId = 'user-1';

      prisma.releaseSession.findFirst.mockResolvedValue({
        id: sessionId,
        projectId,
        status: 'DRAFT',
        createdBy: userId,
      });
      prisma.releaseSession.delete.mockResolvedValue({ id: sessionId });

      await service.cancelDraft(projectId, sessionId, userId, false);

      expect(prisma.releaseSession.delete).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });

    it('should allow admin to cancel any draft', async () => {
      const sessionId = 'sess-1';
      const adminId = 'admin-1';
      const creatorId = 'user-1';

      prisma.releaseSession.findFirst.mockResolvedValue({
        id: sessionId,
        projectId,
        status: 'DRAFT',
        createdBy: creatorId,
      });
      prisma.releaseSession.delete.mockResolvedValue({ id: sessionId });

      await service.cancelDraft(projectId, sessionId, adminId, true);

      expect(prisma.releaseSession.delete).toHaveBeenCalledWith({
        where: { id: sessionId },
      });
    });

    it('should throw NotFoundException when session not found', async () => {
      prisma.releaseSession.findFirst.mockResolvedValue(null);

      await expect(
        service.cancelDraft(projectId, 'sess-1', 'user-1', false),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when session is not DRAFT', async () => {
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        projectId,
        status: 'IN_REVIEW',
        createdBy: 'user-1',
      });

      await expect(
        service.cancelDraft(projectId, 'sess-1', 'user-1', false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when non-creator non-admin tries to cancel', async () => {
      prisma.releaseSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        projectId,
        status: 'DRAFT',
        createdBy: 'creator-1',
      });

      await expect(
        service.cancelDraft(projectId, 'sess-1', 'other-user', false),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReleasePublic', () => {
    it('should return release details without projectId', async () => {
      const releaseId = 'rel-1';
      const releaseData = {
        id: releaseId,
        projectId,
        basedOnReleaseId: null,
        version: 1,
        note: 'Test release',
        scope: { type: 'all' },
        createdAt: new Date('2024-01-01'),
      };

      prisma.release.findUnique.mockResolvedValue(releaseData);
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        name: 'Test Project',
      });
      prisma.releaseSession.findMany.mockResolvedValue([
        {
          id: 'sess-1',
          status: 'PUBLISHED',
          submittedAt: null,
          reviewedAt: null,
          reviewNote: null,
          publishedAt: new Date('2024-01-02'),
          createdBy: 'user-1',
        },
      ]);
      prisma.releaseArtifact.findMany.mockResolvedValue([
        { localeCode: 'zh-CN' },
        { localeCode: 'en-US' },
      ]);

      const result = await service.getReleasePublic(releaseId);

      expect(result.id).toBe(releaseId);
      expect(result.projectName).toBe('Test Project');
      expect(result.localeCodes).toEqual(['zh-CN', 'en-US']);
      expect(result.status).toBe('PUBLISHED');
      expect(result.session).toBeDefined();
    });

    it('should throw NotFoundException when release not found', async () => {
      prisma.release.findUnique.mockResolvedValue(null);
      prisma.releaseSession.findFirst.mockResolvedValue(null);

      await expect(service.getReleasePublic('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return release session details when id is a session', async () => {
      const sessionId = 'sess-1';
      const sessionData = {
        id: sessionId,
        projectId,
        status: 'DRAFT',
        createdBy: 'user-1',
        baseReleaseId: null,
        scope: { type: 'all' },
        localeCodes: ['zh-CN', 'en-US'],
        note: 'Test session',
        validationErrors: null,
        baseJson: null,
        nextJson: null,
        submittedAt: null,
        reviewedAt: null,
        reviewNote: null,
        publishedAt: null,
        archivedAt: null,
        createdAt: new Date('2024-01-01'),
        project: {
          id: projectId,
          name: 'Test Project',
          currentReleaseId: null,
        },
      };

      prisma.release.findUnique.mockResolvedValue(null);
      prisma.releaseSession.findFirst.mockResolvedValue(sessionData);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: 'Test User',
      });

      const result = await service.getReleasePublic(sessionId);

      expect(result.id).toBe(sessionId);
      expect(result.type).toBe('SESSION');
      expect(result.projectName).toBe('Test Project');
      expect(result.status).toBe('DRAFT');
      expect(result.version).toBeNull();
      expect(result.localeCodes).toEqual(['zh-CN', 'en-US']);
      expect(result.createdByUser).toEqual({ id: 'user-1', name: 'Test User' });
    });

    it('should return PUBLISHED status when no session exists', async () => {
      const releaseId = 'rel-1';

      prisma.release.findUnique.mockResolvedValue({
        id: releaseId,
        projectId,
        basedOnReleaseId: null,
        version: 1,
        note: null,
        scope: { type: 'all' },
        createdAt: new Date(),
      });
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        name: 'Test Project',
      });
      prisma.releaseSession.findMany.mockResolvedValue([]);
      prisma.releaseArtifact.findMany.mockResolvedValue([]);

      const result = await service.getReleasePublic(releaseId);

      expect(result.status).toBe('PUBLISHED');
      expect(result.session).toBeUndefined();
    });
  });

  describe('getArtifactPublic', () => {
    it('should return artifact without projectId', async () => {
      const releaseId = 'rel-1';
      const artifactData = { 'common.key': 'value' };

      prisma.release.findUnique.mockResolvedValue({ id: releaseId });
      prisma.releaseArtifact.findUnique.mockResolvedValue({
        data: artifactData,
      });

      const result = await service.getArtifactPublic(releaseId, 'zh-CN');

      expect(result).toEqual(artifactData);
    });

    it('should throw NotFoundException when release not found', async () => {
      prisma.release.findUnique.mockResolvedValue(null);

      await expect(
        service.getArtifactPublic('non-existent', 'zh-CN'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when artifact not found', async () => {
      const releaseId = 'rel-1';

      prisma.release.findUnique.mockResolvedValue({ id: releaseId });
      prisma.releaseArtifact.findUnique.mockResolvedValue(null);

      await expect(
        service.getArtifactPublic(releaseId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
