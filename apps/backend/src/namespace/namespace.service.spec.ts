import { Test, TestingModule } from '@nestjs/testing';
import { NamespaceService } from './namespace.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  namespace: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
};

describe('NamespaceService', () => {
  let service: NamespaceService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NamespaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<NamespaceService>(NamespaceService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const projectId = 'proj-1';
    const createDto = { name: 'common' };

    it('should create a namespace', async () => {
      const expectedResult = { id: 'ns-1', ...createDto, projectId };
      prisma.project.findUnique.mockResolvedValue({ id: projectId });
      prisma.namespace.create.mockResolvedValue(expectedResult);

      const result = await service.create(projectId, createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: projectId },
      });
      expect(prisma.namespace.create).toHaveBeenCalledWith({
        data: { ...createDto, projectId },
      });
    });

    it('should throw NotFoundException if project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create(projectId, createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all namespaces for a project', async () => {
      const projectId = 'proj-1';
      const expectedResult = [{ id: 'ns-1', name: 'common', projectId }];
      prisma.namespace.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll(projectId);
      expect(result).toEqual(expectedResult);
      expect(prisma.namespace.findMany).toHaveBeenCalledWith({
        where: { projectId },
      });
    });
  });

  describe('findOne', () => {
    const projectId = 'proj-1';
    const id = 'ns-1';

    it('should return a single namespace', async () => {
      const expectedResult = { id, name: 'common', projectId };
      prisma.namespace.findFirst.mockResolvedValue(expectedResult);

      const result = await service.findOne(projectId, id);
      expect(result).toEqual(expectedResult);
      expect(prisma.namespace.findFirst).toHaveBeenCalledWith({
        where: { id, projectId },
      });
    });

    it('should throw NotFoundException if namespace not found', async () => {
      prisma.namespace.findFirst.mockResolvedValue(null);
      await expect(service.findOne(projectId, id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ... similar tests for update and remove
});
