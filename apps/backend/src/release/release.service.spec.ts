import { Test, TestingModule } from '@nestjs/testing';
import { ReleaseService } from './release.service';
import { PrismaService } from '../prisma.service';
import {
  BadRequestException,
  ConflictException,
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
    create: jest.fn(),
    update: jest.fn(),
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
    it('should throw ConflictException if baseReleaseId mismatches current', async () => {
      prisma.project.findUnique.mockResolvedValue(projectContext);

      await expect(
        service.previewRelease(projectId, {
          baseReleaseId: 'rel-x',
          scope: { type: 'all' },
          localeCodes: ['en-US'],
        }),
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

      const result = await service.previewRelease(projectId, {
        baseReleaseId: 'rel-0',
        scope: { type: 'keys', keyIds: ['key-1'] },
        localeCodes: ['en-US'],
      });

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

      const result = await service.previewRelease(projectId, {
        baseReleaseId: 'rel-0',
        scope: { type: 'keys', keyIds: ['key-1'] },
        localeCodes: ['en-US'],
      });

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
        service.previewRelease(projectId, {
          baseReleaseId: 'rel-0',
          scope: { type: 'all' },
          localeCodes: ['en-US'],
        }),
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
});
