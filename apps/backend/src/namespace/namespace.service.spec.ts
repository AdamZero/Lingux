import { Test, TestingModule } from '@nestjs/testing';
import { NamespaceService } from './namespace.service';
import { PrismaService } from '../prisma.service';
import { MachineTranslationService } from '../translation/services/machine-translation.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TranslationJobManager } from '../translation/translation-job-manager';

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
    findMany: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  locale: {
    findUnique: jest.fn(),
  },
  translation: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn(),
  },
  key: {
    findMany: jest.fn(),
  },
};

const mockMachineTranslationService = {
  getDefaultProvider: jest.fn(),
  createTranslationJob: jest.fn(),
};

describe('NamespaceService', () => {
  let service: NamespaceService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NamespaceService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: MachineTranslationService,
          useValue: mockMachineTranslationService,
        },
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

    it('should export namespaces as JSON (all mode)', async () => {
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
        'all',
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

    it('should export namespaces as YAML (all mode)', async () => {
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
        'all',
      );

      expect(typeof result).toBe('string');
      expect(result).toContain('common:');
      expect(result).toContain('hello:');
      expect(result).toContain('zh-CN: 你好');
    });

    it('should export namespaces as Excel buffer (all mode)', async () => {
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
        'all',
      );

      expect(Buffer.isBuffer(result)).toBe(true);
      expect((result as Buffer).length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException if some namespaces not found (all mode)', async () => {
      const namespaceIds = ['ns-1', 'ns-2'];
      prisma.namespace.findMany.mockResolvedValue([
        { id: 'ns-1', name: 'common', projectId, keys: [] },
      ]);

      await expect(
        service.exportMultiple(projectId, namespaceIds, 'json', 'all'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle empty namespaces (all mode)', async () => {
      prisma.namespace.findMany.mockResolvedValue([
        {
          id: 'ns-1',
          name: 'common',
          projectId,
          keys: [],
        },
      ]);

      const result = await service.exportMultiple(
        projectId,
        ['ns-1'],
        'json',
        'all',
      );
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({ common: {} });
    });

    it('should handle namespace with long name for Excel (truncate to 31 chars, all mode)', async () => {
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

      const result = await service.exportMultiple(
        projectId,
        ['ns-1'],
        'xlsx',
        'all',
      );
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('translate', () => {
    const projectId = 'proj-1';
    const userId = 'user-1';

    beforeEach(() => {
      // 清理并发控制状态
      TranslationJobManager.finishProcessing(projectId);
      TranslationJobManager.finishProcessing('ns-1');
    });

    it('should create translation job for entire project', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'hello',
          namespace: { id: 'ns-1', name: 'common' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '你好' },
          ],
        },
      ]);
      mockMachineTranslationService.getDefaultProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'Test Provider',
      });
      mockMachineTranslationService.createTranslationJob.mockResolvedValue(
        'job-1',
      );

      const result = await service.translate(projectId, undefined, userId);

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'PENDING',
        totalKeys: 1,
        type: 'project',
        namespaceCount: 1,
      });
      expect(mockMachineTranslationService.createTranslationJob).toHaveBeenCalled();
    });

    it('should create translation job for specific namespaces', async () => {
      const namespaceIds = ['ns-1', 'ns-2'];

      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'hello',
          namespace: { id: 'ns-1', name: 'common' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '你好' },
          ],
        },
        {
          id: 'key-2',
          name: 'world',
          namespace: { id: 'ns-2', name: 'home' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '世界' },
          ],
        },
      ]);
      mockMachineTranslationService.getDefaultProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'Test Provider',
      });
      mockMachineTranslationService.createTranslationJob.mockResolvedValue(
        'job-1',
      );

      const result = await service.translate(projectId, namespaceIds, userId);

      expect(result).toEqual({
        jobId: 'job-1',
        status: 'PENDING',
        totalKeys: 2,
        type: 'namespace',
        namespaceCount: 2,
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no target locales', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
      ]);

      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no keys found', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([]);

      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no default provider', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'hello',
          namespace: { id: 'ns-1', name: 'common' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '你好' },
          ],
        },
      ]);
      mockMachineTranslationService.getDefaultProvider.mockResolvedValue(null);

      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no items to translate', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'hello',
          namespace: { id: 'ns-1', name: 'common' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '你好' },
            { locale: { code: 'en-US' }, content: 'Hello' },
          ],
        },
      ]);
      mockMachineTranslationService.getDefaultProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'Test Provider',
      });

      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if concurrent translation', async () => {
      // 先启动一个翻译任务
      prisma.project.findUnique.mockResolvedValue({
        id: projectId,
        baseLocale: 'zh-CN',
      });
      prisma.projectLocale.findMany.mockResolvedValue([
        { locale: { id: 'loc-1', code: 'zh-CN' } },
        { locale: { id: 'loc-2', code: 'en-US' } },
      ]);
      prisma.key.findMany.mockResolvedValue([
        {
          id: 'key-1',
          name: 'hello',
          namespace: { id: 'ns-1', name: 'common' },
          translations: [
            { locale: { code: 'zh-CN' }, content: '你好' },
          ],
        },
      ]);
      mockMachineTranslationService.getDefaultProvider.mockResolvedValue({
        id: 'provider-1',
        name: 'Test Provider',
      });
      mockMachineTranslationService.createTranslationJob.mockResolvedValue(
        'job-1',
      );

      // 第一次调用成功
      await service.translate(projectId, undefined, userId);

      // 第二次调用应该失败（并发控制）
      await expect(
        service.translate(projectId, undefined, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
