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
    it('should create a project', async () => {
      const createDto = { name: 'Test Project', description: 'A test project' };
      const expectedResult = { id: '1', ...createDto, baseLocale: 'zh-CN', createdAt: new Date(), updatedAt: new Date(), locales: [], users: [] };
      prisma.project.create.mockResolvedValue(expectedResult);

      const result = await service.create(createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.create).toHaveBeenCalledWith({ data: { ...createDto, baseLocale: 'zh-CN' } });
    });
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const expectedResult = [{ id: '1', name: 'Test Project' }];
      prisma.project.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const id = '1';
      const expectedResult = { id, name: 'Test Project' };
      prisma.project.findUnique.mockResolvedValue(expectedResult);

      const result = await service.findOne(id);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({ where: { id }, include: { locales: true } });
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
      const expectedResult = { id, ...updateDto };
      prisma.project.update.mockResolvedValue(expectedResult);

      const result = await service.update(id, updateDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.project.update).toHaveBeenCalledWith({ where: { id }, data: updateDto });
    });

    it('should throw NotFoundException if project to update is not found', async () => {
      const id = '1';
      const updateDto = { name: 'Updated Project' };
      prisma.project.update.mockRejectedValue(new Error());

      await expect(service.update(id, updateDto)).rejects.toThrow(NotFoundException);
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
