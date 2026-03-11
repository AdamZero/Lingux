import { Test, TestingModule } from '@nestjs/testing';
import { TranslationService } from './translation.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import {
  CreateTranslationDto,
  TranslationStatus,
} from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';

const mockPrismaService = {
  translation: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
  locale: {
    findUnique: jest.fn(),
  },
  key: {
    findFirst: jest.fn(),
  },
};

describe('TranslationService', () => {
  let service: TranslationService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TranslationService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TranslationService>(TranslationService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const projectId = 'proj-1';
  const namespaceId = 'ns-1';
  const keyId = 'key-1';
  const localeCode = 'en-US';
  const localeId = 'locale-en-US';

  beforeEach(() => {
    prisma.locale.findUnique.mockResolvedValue({
      id: localeId,
      code: localeCode,
    });
    prisma.key.findFirst.mockResolvedValue({
      id: keyId,
      namespaceId,
      namespace: { projectId },
    });
    prisma.auditLog.create.mockResolvedValue({ id: 'audit-1' });
  });

  describe('create', () => {
    const createDto: CreateTranslationDto = { content: 'Hello', localeCode };

    it('should create a translation', async () => {
      const expectedResult = {
        id: 'trans-1',
        ...createDto,
        keyId,
        localeId,
        status: TranslationStatus.PENDING,
        isLlmTranslated: false,
      };
      prisma.translation.create.mockResolvedValue(expectedResult);

      const result = await service.create(
        projectId,
        namespaceId,
        keyId,
        createDto,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findUnique).toHaveBeenCalledWith({
        where: { code: localeCode },
      });
      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: { id: keyId, namespaceId, namespace: { projectId } },
      });
      expect(prisma.translation.create).toHaveBeenCalledWith({
        data: {
          content: createDto.content,
          status: TranslationStatus.PENDING,
          isLlmTranslated: false,
          keyId,
          localeId,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'TRANSLATION_CREATE',
          targetType: 'Translation',
          targetId: expectedResult.id,
          payload: {
            projectId,
            namespaceId,
            keyId,
            localeCode,
            status: TranslationStatus.PENDING,
          },
          userId: null,
        },
      });
    });

    it('should throw NotFoundException if locale not found', async () => {
      prisma.locale.findUnique.mockResolvedValue(null);
      await expect(
        service.create(projectId, namespaceId, keyId, createDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if key not found', async () => {
      prisma.key.findFirst.mockResolvedValue(null);
      await expect(
        service.create(projectId, namespaceId, keyId, createDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all translations for a key', async () => {
      const expectedResult = [
        { id: 'trans-1', content: 'Hello', keyId, localeId },
      ];
      prisma.translation.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll(projectId, namespaceId, keyId);
      expect(result).toEqual(expectedResult);
      expect(prisma.translation.findMany).toHaveBeenCalledWith({
        where: {
          keyId,
          key: {
            namespaceId,
            namespace: { projectId },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          locale: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single translation', async () => {
      const expectedResult = {
        id: 'trans-1',
        content: 'Hello',
        keyId,
        localeId,
      };
      prisma.translation.findFirst.mockResolvedValue(expectedResult);

      const result = await service.findOne(
        projectId,
        namespaceId,
        keyId,
        localeCode,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findUnique).toHaveBeenCalledWith({
        where: { code: localeCode },
      });
      expect(prisma.translation.findFirst).toHaveBeenCalledWith({
        where: {
          keyId,
          localeId,
          key: {
            namespaceId,
            namespace: { projectId },
          },
        },
        include: {
          locale: true,
        },
      });
    });

    it('should throw NotFoundException if translation not found', async () => {
      prisma.translation.findFirst.mockResolvedValue(null);
      await expect(
        service.findOne(projectId, namespaceId, keyId, localeCode),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTranslationDto = { content: 'Hi there' };

    it('should update a translation', async () => {
      const expectedResult = {
        id: 'trans-1',
        content: 'Hi there',
        keyId,
        localeId,
      };
      prisma.translation.findUnique.mockResolvedValue({
        id: 'trans-1',
        keyId,
        localeId,
        content: 'Hello',
        status: TranslationStatus.PENDING,
      });
      prisma.translation.update.mockResolvedValue(expectedResult);

      const result = await service.update(
        projectId,
        namespaceId,
        keyId,
        localeCode,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findUnique).toHaveBeenCalledWith({
        where: { code: localeCode },
      });
      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: { id: keyId, namespaceId, namespace: { projectId } },
      });
      expect(prisma.translation.findUnique).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
      });
      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
        data: {
          content: updateDto.content,
          status: TranslationStatus.PENDING,
          reviewComment: null,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if translation to update is not found', async () => {
      prisma.translation.findUnique.mockResolvedValue({
        id: 'trans-1',
        keyId,
        localeId,
        content: 'Hello',
        status: TranslationStatus.PENDING,
      });
      prisma.translation.update.mockRejectedValue(new Error());
      await expect(
        service.update(projectId, namespaceId, keyId, localeCode, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('submitReview', () => {
    it('should submit a pending translation for review', async () => {
      const pendingTranslation = {
        id: 'trans-1',
        status: TranslationStatus.PENDING,
        content: 'Hello',
      };
      const expectedResult = {
        id: 'trans-1',
        status: TranslationStatus.REVIEWING,
      };
      prisma.translation.findUnique.mockResolvedValue(pendingTranslation);
      prisma.translation.update.mockResolvedValue(expectedResult);

      const result = await service.submitReview(
        projectId,
        namespaceId,
        keyId,
        localeCode,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
        data: { status: TranslationStatus.REVIEWING },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if translation is not pending', async () => {
      prisma.translation.findUnique.mockResolvedValue({
        id: 'trans-1',
        status: TranslationStatus.REVIEWING,
        content: 'Hello',
      });

      await expect(
        service.submitReview(projectId, namespaceId, keyId, localeCode),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('approve', () => {
    it('should approve a translation', async () => {
      const expectedResult = {
        id: 'trans-1',
        status: TranslationStatus.APPROVED,
      };
      prisma.translation.findUnique.mockResolvedValue({
        id: 'trans-1',
        status: TranslationStatus.REVIEWING,
      });
      prisma.translation.update.mockResolvedValue(expectedResult);

      const result = await service.approve(
        projectId,
        namespaceId,
        keyId,
        localeCode,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.translation.findUnique).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
      });
      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
        data: { status: TranslationStatus.APPROVED, reviewComment: null },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('should reject a translation', async () => {
      const reason = 'Needs changes';
      const expectedResult = {
        id: 'trans-1',
        status: TranslationStatus.PENDING,
      };
      prisma.translation.findUnique.mockResolvedValue({
        id: 'trans-1',
        status: TranslationStatus.REVIEWING,
      });
      prisma.translation.update.mockResolvedValue(expectedResult);

      const result = await service.reject(
        projectId,
        namespaceId,
        keyId,
        localeCode,
        reason,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
        data: { status: TranslationStatus.PENDING, reviewComment: reason },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish an approved translation', async () => {
      const approvedTranslation = {
        id: 'trans-1',
        status: TranslationStatus.APPROVED,
      };
      const expectedResult = {
        ...approvedTranslation,
        status: TranslationStatus.PUBLISHED,
      };
      prisma.translation.findUnique.mockResolvedValue(approvedTranslation);
      prisma.translation.update.mockResolvedValue(expectedResult);

      const result = await service.publish(
        projectId,
        namespaceId,
        keyId,
        localeCode,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: { id: keyId, namespaceId, namespace: { projectId } },
      });
      expect(prisma.translation.findUnique).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
      });
      expect(prisma.translation.update).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
        data: { status: TranslationStatus.PUBLISHED },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if translation is not approved', async () => {
      const pendingTranslation = {
        id: 'trans-1',
        status: TranslationStatus.PENDING,
      };
      prisma.translation.findUnique.mockResolvedValue(pendingTranslation);

      await expect(
        service.publish(projectId, namespaceId, keyId, localeCode),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if translation not found', async () => {
      prisma.translation.findUnique.mockResolvedValue(null);

      await expect(
        service.publish(projectId, namespaceId, keyId, localeCode),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a translation', async () => {
      prisma.translation.delete.mockResolvedValue({ id: 'trans-1' });

      const result = await service.remove(
        projectId,
        namespaceId,
        keyId,
        localeCode,
      );
      expect(result).toEqual({ success: true });
      expect(prisma.translation.delete).toHaveBeenCalledWith({
        where: { keyId_localeId: { keyId, localeId } },
      });
    });

    it('should throw NotFoundException if translation to delete is not found', async () => {
      prisma.translation.delete.mockRejectedValue(new Error());
      await expect(
        service.remove(projectId, namespaceId, keyId, localeCode),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
