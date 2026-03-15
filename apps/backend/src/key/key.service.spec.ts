import { Test, TestingModule } from '@nestjs/testing';
import { KeyService } from './key.service';
import { PrismaService } from '../prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { KeyType } from './dto/create-key.dto';

const mockPrismaService = {
  key: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  translation: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    createMany: jest.fn(),
  },
  namespace: {
    findFirst: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('KeyService', () => {
  let service: KeyService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KeyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<KeyService>(KeyService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn !== 'function') {
        throw new Error('Invalid transaction callback');
      }
      return (fn as (tx: typeof mockPrismaService) => unknown)(prisma);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const projectId = 'proj-1';
  const namespaceId = 'ns-1';

  describe('create', () => {
    const createDto = { name: 'login.submit', type: KeyType.TEXT };

    it('should create a key', async () => {
      const expectedResult = { id: 'key-1', ...createDto, namespaceId };
      prisma.namespace.findFirst.mockResolvedValue({
        id: namespaceId,
        projectId,
      });
      prisma.key.findFirst.mockResolvedValue(null);
      prisma.key.create.mockResolvedValue(expectedResult);

      const result = await service.create(projectId, namespaceId, createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.namespace.findFirst).toHaveBeenCalledWith({
        where: { id: namespaceId, projectId },
      });
      expect(prisma.key.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { namespaceId, name: createDto.name },
        }),
      );
      expect(prisma.key.create).toHaveBeenCalledWith({
        data: { ...createDto, namespaceId },
      });
    });

    it('should throw ConflictException if key already exists', async () => {
      prisma.namespace.findFirst.mockResolvedValue({
        id: namespaceId,
        projectId,
      });
      prisma.key.findFirst.mockResolvedValue({
        id: 'key-1',
        name: createDto.name,
        namespaceId,
      });

      await expect(
        service.create(projectId, namespaceId, createDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if namespace does not exist', async () => {
      prisma.namespace.findFirst.mockResolvedValue(null);
      await expect(
        service.create(projectId, namespaceId, createDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all keys for a namespace', async () => {
      const expectedResult = [
        { id: 'key-1', name: 'login.submit', namespaceId },
      ];
      prisma.key.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll(projectId, namespaceId);
      expect(result).toEqual(expectedResult);
      expect(prisma.key.findMany).toHaveBeenCalledWith({
        where: {
          namespaceId: namespaceId,
          namespace: { projectId },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          translations: {
            orderBy: {
              updatedAt: 'desc',
            },
            include: {
              locale: true,
            },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    const id = 'key-1';

    it('should return a single key', async () => {
      const expectedResult = { id, name: 'login.submit', namespaceId };
      prisma.key.findFirst.mockResolvedValue(expectedResult);

      const result = await service.findOne(projectId, namespaceId, id);
      expect(result).toEqual(expectedResult);
      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: {
          id,
          namespaceId,
          namespace: { projectId },
        },
        include: {
          translations: {
            orderBy: {
              updatedAt: 'desc',
            },
            include: {
              locale: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException if key not found', async () => {
      prisma.key.findFirst.mockResolvedValue(null);
      await expect(service.findOne(projectId, namespaceId, id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('lookupByName', () => {
    it('should lookup keys by name', async () => {
      const name = 'login.submit';
      const excludeKeyId = 'key-exclude';
      const expectedResult = [{ id: 'key-2', name }];
      prisma.key.findMany.mockResolvedValue(expectedResult);

      const result = await service.lookupByName(projectId, name, excludeKeyId);
      expect(result).toEqual(expectedResult);
      expect(prisma.key.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name,
            namespace: { projectId },
            NOT: { id: excludeKeyId },
          }),
        }),
      );
    });
  });

  describe('copyTranslations', () => {
    it('should copy translations in fillMissing mode', async () => {
      prisma.key.findFirst
        .mockResolvedValueOnce({ id: 'target-1', namespaceId })
        .mockResolvedValueOnce({ id: 'source-1' });
      prisma.translation.findMany.mockResolvedValue([
        { localeId: 'loc-1', content: 'Hello' },
        { localeId: 'loc-2', content: '你好' },
      ]);
      prisma.translation.createMany.mockResolvedValue({ count: 2 });

      const result = await service.copyTranslations(
        projectId,
        namespaceId,
        'target-1',
        'source-1',
        'fillMissing',
      );

      expect(result).toEqual({ copied: 2, skipped: 0, mode: 'fillMissing' });
      expect(prisma.translation.deleteMany).not.toHaveBeenCalled();
      expect(prisma.translation.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: true,
        }),
      );
    });

    it('should copy translations in overwrite mode', async () => {
      prisma.key.findFirst
        .mockResolvedValueOnce({ id: 'target-1', namespaceId })
        .mockResolvedValueOnce({ id: 'source-1' });
      prisma.translation.findMany.mockResolvedValue([
        { localeId: 'loc-1', content: 'Hello' },
      ]);
      prisma.translation.createMany.mockResolvedValue({ count: 1 });

      const result = await service.copyTranslations(
        projectId,
        namespaceId,
        'target-1',
        'source-1',
        'overwrite',
      );

      expect(result).toEqual({ copied: 1, skipped: 0, mode: 'overwrite' });
      expect(prisma.translation.deleteMany).toHaveBeenCalled();
      expect(prisma.translation.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skipDuplicates: false,
        }),
      );
    });
  });

  describe('update', () => {
    const id = 'key-1';
    const updateDto = { name: 'login.new_submit' };

    it('should update a key', async () => {
      const expectedResult = { id, ...updateDto, namespaceId };
      prisma.key.update.mockResolvedValue(expectedResult);

      const result = await service.update(
        projectId,
        namespaceId,
        id,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
      expect(prisma.key.update).toHaveBeenCalledWith({
        where: { id },
        data: updateDto,
      });
    });

    it('should throw NotFoundException if key to update is not found', async () => {
      prisma.key.update.mockRejectedValue(new Error());
      await expect(
        service.update(projectId, namespaceId, id, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const id = 'key-1';

    it('should delete a key', async () => {
      prisma.key.findFirst.mockResolvedValue({ id });
      prisma.translation.deleteMany.mockResolvedValue({ count: 2 });
      prisma.key.delete.mockResolvedValue({ id });

      const result = await service.remove(projectId, namespaceId, id);
      expect(result).toEqual({ success: true });
      expect(prisma.key.findFirst).toHaveBeenCalledWith({
        where: {
          id,
          namespaceId,
          namespace: { projectId },
        },
        select: { id: true },
      });
      expect(prisma.translation.deleteMany).toHaveBeenCalledWith({
        where: { keyId: id },
      });
      expect(prisma.key.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it('should throw NotFoundException if key to delete is not found', async () => {
      prisma.key.findFirst.mockResolvedValue(null);
      await expect(service.remove(projectId, namespaceId, id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.translation.deleteMany).not.toHaveBeenCalled();
      expect(prisma.key.delete).not.toHaveBeenCalled();
    });
  });
});
