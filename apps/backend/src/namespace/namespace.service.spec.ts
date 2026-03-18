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
  projectLocale: {
    upsert: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  locale: {
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
    const createDto = { name: 'common', description: 'Common strings' };

    it('should create a namespace', async () => {
      const expectedResult = { id: 'ns-1', ...createDto, projectId };
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
        projectLocales: [{ locale: { code: 'zh-CN' } }],
      });
      prisma.namespace.create.mockResolvedValue(expectedResult);

      const result = await service.create(projectId, createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: projectId } }),
      );
      expect(prisma.project.update).not.toHaveBeenCalled();
      expect(prisma.projectLocale.upsert).not.toHaveBeenCalled();
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
        orderBy: {
          updatedAt: 'desc',
        },
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

  describe('exportMultiple', () => {
    const projectId = 'proj-1';

    it('should export namespaces as JSON', async () => {
      const namespaceIds = ['ns-1'];
      const mockNamespaces = [
        {
          id: 'ns-1',
          name: 'common',
          projectId,
          keys: [
            {
              id: 'key-1',
              name: 'hello',
              translations: [
                { locale: { code: 'zh-CN' }, content: '你好' },
                { locale: { code: 'en' }, content: 'Hello' },
              ],
            },
          ],
        },
      ];
      prisma.namespace.findMany.mockResolvedValue(mockNamespaces);

      const result = await service.exportMultiple(
        projectId,
        namespaceIds,
        'json',
      );

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveProperty('common');
      expect(parsed.common).toHaveProperty('hello');
      expect(parsed.common.hello).toEqual({
        'zh-CN': '你好',
        en: 'Hello',
      });
    });

    it('should export namespaces as YAML', async () => {
      const namespaceIds = ['ns-1'];
      const mockNamespaces = [
        {
          id: 'ns-1',
          name: 'common',
          projectId,
          keys: [
            {
              id: 'key-1',
              name: 'hello',
              translations: [{ locale: { code: 'zh-CN' }, content: '你好' }],
            },
          ],
        },
      ];
      prisma.namespace.findMany.mockResolvedValue(mockNamespaces);

      const result = await service.exportMultiple(
        projectId,
        namespaceIds,
        'yaml',
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('common:');
      expect(result).toContain('hello:');
      expect(result).toContain('zh-CN: 你好');
    });

    it('should export namespaces as Excel buffer', async () => {
      const namespaceIds = ['ns-1'];
      const mockNamespaces = [
        {
          id: 'ns-1',
          name: 'common',
          projectId,
          keys: [
            {
              id: 'key-1',
              name: 'hello',
              translations: [
                { locale: { code: 'zh-CN' }, content: '你好' },
                { locale: { code: 'en' }, content: 'Hello' },
              ],
            },
          ],
        },
      ];
      prisma.namespace.findMany.mockResolvedValue(mockNamespaces);

      const result = await service.exportMultiple(
        projectId,
        namespaceIds,
        'xlsx',
      );

      expect(Buffer.isBuffer(result)).toBe(true);
      expect((result as Buffer).length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if some namespaces not found', async () => {
      const namespaceIds = ['ns-1', 'ns-2'];
      prisma.namespace.findMany.mockResolvedValue([
        { id: 'ns-1', name: 'common', projectId, keys: [] },
      ]);

      await expect(
        service.exportMultiple(projectId, namespaceIds, 'json'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty namespaces', async () => {
      prisma.namespace.findMany.mockResolvedValue([
        {
          id: 'ns-1',
          name: 'common',
          projectId,
          keys: [],
        },
      ]);

      const result = await service.exportMultiple(projectId, ['ns-1'], 'json');
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({ common: {} });
    });

    it('should handle namespace with long name for Excel (truncate to 31 chars)', async () => {
      const longName = 'a'.repeat(50);
      const mockNamespaces = [
        {
          id: 'ns-1',
          name: longName,
          projectId,
          keys: [
            {
              id: 'key-1',
              name: 'hello',
              translations: [{ locale: { code: 'zh-CN' }, content: '你好' }],
            },
          ],
        },
      ];
      prisma.namespace.findMany.mockResolvedValue(mockNamespaces);

      const result = await service.exportMultiple(projectId, ['ns-1'], 'xlsx');
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
