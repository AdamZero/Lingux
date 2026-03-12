import { Test, TestingModule } from '@nestjs/testing';
import { ProjectService } from './project.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  project: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  projectLocale: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  locale: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ProjectService', () => {
  let service: ProjectService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ProjectService>(ProjectService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a project with default locale connected', async () => {
      const createDto = { name: 'Test Project', description: 'A test project' };
      const dbResult = {
        id: '1',
        ...createDto,
        baseLocale: 'zh-CN',
        createdAt: new Date(),
        updatedAt: new Date(),
        projectLocales: [
          {
            enabled: true,
            locale: { id: 'loc-zh', code: 'zh-CN', name: 'Chinese' },
          },
        ],
        users: [],
      };
      const expectedResult = {
        id: dbResult.id,
        name: dbResult.name,
        description: dbResult.description,
        baseLocale: dbResult.baseLocale,
        createdAt: dbResult.createdAt,
        updatedAt: dbResult.updatedAt,
        users: dbResult.users,
        locales: [dbResult.projectLocales[0].locale],
      };
      prisma.locale.findUnique.mockResolvedValue({ id: 'loc-zh' });
      prisma.project.create.mockResolvedValue(dbResult);

      const result = await service.create(createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findUnique).toHaveBeenCalledWith({
        where: { code: 'zh-CN' },
        select: { id: true },
      });
      expect(prisma.project.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          baseLocale: 'zh-CN',
          projectLocales: {
            createMany: {
              data: [
                {
                  localeId: 'loc-zh',
                  enabled: true,
                  disabledAt: null,
                },
              ],
            },
          },
        },
        include: {
          projectLocales: {
            where: { enabled: true },
            orderBy: {
              updatedAt: 'desc',
            },
            include: { locale: true },
          },
        },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const dbResult = [
        {
          id: '1',
          name: 'Test Project',
          projectLocales: [
            {
              enabled: true,
              locale: { id: 'loc-zh', code: 'zh-CN', name: 'Chinese' },
            },
          ],
        },
      ];
      const expectedResult = [
        {
          id: '1',
          name: 'Test Project',
          locales: [dbResult[0].projectLocales[0].locale],
        },
      ];
      prisma.project.findMany.mockResolvedValue(dbResult);

      const result = await service.findAll();
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findMany).toHaveBeenCalledWith({
        orderBy: {
          updatedAt: 'desc',
        },
        include: {
          projectLocales: {
            where: { enabled: true },
            orderBy: {
              updatedAt: 'desc',
            },
            include: { locale: true },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const id = '1';
      const dbResult = {
        id,
        name: 'Test Project',
        projectLocales: [
          {
            enabled: true,
            locale: { id: 'loc-zh', code: 'zh-CN', name: 'Chinese' },
          },
        ],
      };
      const expectedResult = {
        id,
        name: 'Test Project',
        locales: [dbResult.projectLocales[0].locale],
      };
      prisma.project.findUnique.mockResolvedValue(dbResult);

      const result = await service.findOne(id);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id },
        include: {
          projectLocales: {
            where: { enabled: true },
            orderBy: {
              updatedAt: 'desc',
            },
            include: { locale: true },
          },
        },
      });
    });

    it('should throw NotFoundException if project not found', async () => {
      const id = '1';
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(service.findOne(id)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const id = '1';
      const updateDto = { name: 'Updated Project' };
      const dbResult = {
        id,
        ...updateDto,
        projectLocales: [
          {
            enabled: true,
            locale: { id: 'loc-zh', code: 'zh-CN', name: 'Chinese' },
          },
        ],
      };
      const expectedResult = {
        id,
        ...updateDto,
        locales: [dbResult.projectLocales[0].locale],
      };
      prisma.project.update.mockResolvedValue(dbResult);

      const result = await service.update(id, updateDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id },
        data: updateDto,
        include: {
          projectLocales: {
            where: { enabled: true },
            orderBy: {
              updatedAt: 'desc',
            },
            include: { locale: true },
          },
        },
      });
    });

    it('should throw NotFoundException if project to update is not found', async () => {
      const id = '1';
      const updateDto = { name: 'Updated Project' };
      prisma.project.update.mockRejectedValue(new Error());

      await expect(service.update(id, updateDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const id = '1';
      prisma.project.delete.mockResolvedValue({ id });

      const result = await service.remove(id);
      expect(result).toEqual({ success: true });
      expect(prisma.project.delete).toHaveBeenCalledWith({ where: { id } });
    });

    it('should throw NotFoundException if project to delete is not found', async () => {
      const id = '1';
      prisma.project.delete.mockRejectedValue(new Error());

      await expect(service.remove(id)).rejects.toThrow(NotFoundException);
    });
  });
});
