import { Test, TestingModule } from '@nestjs/testing';
import { TranslationController } from './translation.controller';
import { TranslationService } from './translation.service';
import { CreateTranslationDto, TranslationStatus } from './dto/create-translation.dto';
import { UpdateTranslationDto } from './dto/update-translation.dto';
import { HttpStatus } from '@nestjs/common';

const mockTranslationService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  publish: jest.fn(),
  remove: jest.fn(),
};

describe('TranslationController', () => {
  let controller: TranslationController;
  let service: typeof mockTranslationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TranslationController],
      providers: [
        {
          provide: TranslationService,
          useValue: mockTranslationService,
        },
      ],
    }).compile();

    controller = module.get<TranslationController>(TranslationController);
    service = module.get(TranslationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const projectId = 'proj-1';
  const namespaceId = 'ns-1';
  const keyId = 'key-1';
  const localeCode = 'en-US';

  describe('create', () => {
    it('should create a translation', async () => {
      const createDto: CreateTranslationDto = { content: 'Hello', localeCode };
      const expectedResult = { id: 'trans-1', ...createDto, keyId };
      mockTranslationService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(projectId, namespaceId, keyId, createDto);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.create).toHaveBeenCalledWith(projectId, namespaceId, keyId, createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of translations', async () => {
      const expectedResult = [{ id: 'trans-1', content: 'Hello', keyId }];
      mockTranslationService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(projectId, namespaceId, keyId);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.findAll).toHaveBeenCalledWith(projectId, namespaceId, keyId);
    });
  });

  describe('findOne', () => {
    it('should return a single translation', async () => {
      const expectedResult = { id: 'trans-1', content: 'Hello', keyId, localeCode };
      mockTranslationService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(projectId, namespaceId, keyId, localeCode);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.findOne).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode);
    });
  });

  describe('update', () => {
    it('should update a translation', async () => {
      const updateDto: UpdateTranslationDto = { content: 'Hi there' };
      const expectedResult = { id: 'trans-1', ...updateDto, keyId, localeCode };
      mockTranslationService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(projectId, namespaceId, keyId, localeCode, updateDto);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.update).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode, updateDto);
    });
  });

  describe('approve', () => {
    it('should approve a translation', async () => {
      const expectedResult = { id: 'trans-1', status: TranslationStatus.APPROVED };
      mockTranslationService.approve.mockResolvedValue(expectedResult);

      const result = await controller.approve(projectId, namespaceId, keyId, localeCode);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.approve).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode);
    });
  });

  describe('reject', () => {
    it('should reject a translation', async () => {
      const expectedResult = { id: 'trans-1', status: TranslationStatus.PENDING };
      mockTranslationService.reject.mockResolvedValue(expectedResult);

      const result = await controller.reject(projectId, namespaceId, keyId, localeCode);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.reject).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode);
    });
  });

  describe('publish', () => {
    it('should publish a translation', async () => {
      const expectedResult = { id: 'trans-1', status: TranslationStatus.PUBLISHED };
      mockTranslationService.publish.mockResolvedValue(expectedResult);

      const result = await controller.publish(projectId, namespaceId, keyId, localeCode);
      expect(result).toEqual(expectedResult);
      expect(mockTranslationService.publish).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode);
    });
  });

  describe('remove', () => {
    it('should remove a translation', async () => {
      mockTranslationService.remove.mockResolvedValue({ success: true });

      await controller.remove(projectId, namespaceId, keyId, localeCode);
      expect(mockTranslationService.remove).toHaveBeenCalledWith(projectId, namespaceId, keyId, localeCode);
    });
  });
});
