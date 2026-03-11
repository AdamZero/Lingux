import { Test, TestingModule } from '@nestjs/testing';
import { KeyService } from './key.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';
import { KeyType } from './dto/create-key.dto';

const mockPrismaService = {
  key: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  namespace: {
    findFirst: jest.fn(),
  },
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
      prisma.key.create.mockResolvedValue(expectedResult);

      const result = await service.create(projectId, namespaceId, createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.namespace.findFirst).toHaveBeenCalledWith({
        where: { id: namespaceId, projectId },
      });
      expect(prisma.key.create).toHaveBeenCalledWith({
        data: { ...createDto, namespaceId },
      });
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
      prisma.key.delete.mockResolvedValue({ id });

      const result = await service.remove(projectId, namespaceId, id);
      expect(result).toEqual({ success: true });
      expect(prisma.key.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it('should throw NotFoundException if key to delete is not found', async () => {
      prisma.key.delete.mockRejectedValue(new Error());
      await expect(service.remove(projectId, namespaceId, id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
