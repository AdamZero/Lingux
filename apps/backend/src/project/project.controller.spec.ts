import { Test, TestingModule } from '@nestjs/testing';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

const mockProjectService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  findAuditLogs: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('ProjectController', () => {
  let controller: ProjectController;
  let service: typeof mockProjectService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectController],
      providers: [
        {
          provide: ProjectService,
          useValue: mockProjectService,
        },
      ],
    }).compile();

    controller = module.get<ProjectController>(ProjectController);
    service = module.get(ProjectService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a project', async () => {
      const createDto: CreateProjectDto = {
        name: 'Test Project',
        description: 'Test Description',
      };
      const expectedResult = { id: '1', ...createDto };
      service.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);
      expect(result).toEqual(expectedResult);
      expect(service.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const expectedResult = [{ id: '1', name: 'Test Project' }];
      service.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();
      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const id = '1';
      const expectedResult = { id, name: 'Test Project' };
      service.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(id);
      expect(result).toEqual(expectedResult);
      expect(service.findOne).toHaveBeenCalledWith(id);
    });
  });

  describe('findAuditLogs', () => {
    it('should return audit logs for a project', async () => {
      const projectId = 'proj-1';
      const query = { limit: '10', actionPrefix: 'translation.' };
      const expectedResult = { items: [], nextCursor: null };
      service.findAuditLogs.mockResolvedValue(expectedResult);

      const result = await controller.findAuditLogs(projectId, query);
      expect(result).toEqual(expectedResult);
      expect(service.findAuditLogs).toHaveBeenCalledWith(projectId, query);
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const id = '1';
      const updateDto: UpdateProjectDto = { name: 'Updated Project' };
      const expectedResult = { id, ...updateDto };
      service.update.mockResolvedValue(expectedResult);

      const result = await controller.update(id, updateDto);
      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith(id, updateDto);
    });
  });

  describe('remove', () => {
    it('should remove a project', async () => {
      const id = '1';
      service.remove.mockResolvedValue({ success: true });

      await controller.remove(id);
      expect(service.remove).toHaveBeenCalledWith(id);
    });
  });
});
