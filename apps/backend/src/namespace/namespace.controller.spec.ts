import { Test, TestingModule } from '@nestjs/testing';
import { NamespaceController } from './namespace.controller';
import { NamespaceService } from './namespace.service';
import { CreateNamespaceDto } from './dto/create-namespace.dto';
import { UpdateNamespaceDto } from './dto/update-namespace.dto';
import { NotFoundException } from '@nestjs/common';

const mockNamespaceService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('NamespaceController', () => {
  let controller: NamespaceController;
  let service: typeof mockNamespaceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NamespaceController],
      providers: [
        {
          provide: NamespaceService,
          useValue: mockNamespaceService,
        },
      ],
    }).compile();

    controller = module.get<NamespaceController>(NamespaceController);
    service = module.get(NamespaceService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const projectId = 'proj-1';

  describe('create', () => {
    it('should create a namespace', async () => {
      const createDto: CreateNamespaceDto = { name: 'common' };
      const expectedResult = { id: 'ns-1', ...createDto, projectId };
      mockNamespaceService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(projectId, createDto);
      expect(result).toEqual(expectedResult);
      expect(mockNamespaceService.create).toHaveBeenCalledWith(projectId, createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of namespaces', async () => {
      const expectedResult = [{ id: 'ns-1', name: 'common', projectId }];
      mockNamespaceService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(projectId);
      expect(result).toEqual(expectedResult);
      expect(mockNamespaceService.findAll).toHaveBeenCalledWith(projectId);
    });
  });

  describe('findOne', () => {
    it('should return a single namespace', async () => {
      const namespaceId = 'ns-1';
      const expectedResult = { id: namespaceId, name: 'common', projectId };
      mockNamespaceService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(projectId, namespaceId);
      expect(result).toEqual(expectedResult);
      expect(mockNamespaceService.findOne).toHaveBeenCalledWith(projectId, namespaceId);
    });
  });

  describe('update', () => {
    it('should update a namespace', async () => {
      const namespaceId = 'ns-1';
      const updateDto: UpdateNamespaceDto = { name: 'updated-common' };
      const expectedResult = { id: namespaceId, ...updateDto, projectId };
      mockNamespaceService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(projectId, namespaceId, updateDto);
      expect(result).toEqual(expectedResult);
      expect(mockNamespaceService.update).toHaveBeenCalledWith(projectId, namespaceId, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a namespace', async () => {
      const namespaceId = 'ns-1';
      mockNamespaceService.remove.mockResolvedValue({ success: true });

      await controller.remove(projectId, namespaceId);
      expect(mockNamespaceService.remove).toHaveBeenCalledWith(projectId, namespaceId);
    });
  });
});
