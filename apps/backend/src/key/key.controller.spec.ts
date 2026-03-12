import { Test, TestingModule } from '@nestjs/testing';
import { KeyController } from './key.controller';
import { KeyService } from './key.service';
import { CreateKeyDto, KeyType } from './dto/create-key.dto';
import { UpdateKeyDto } from './dto/update-key.dto';

const mockKeyService = {
  create: jest.fn(),
  findAll: jest.fn(),
  lookupByName: jest.fn(),
  copyTranslations: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('KeyController', () => {
  let controller: KeyController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [KeyController],
      providers: [
        {
          provide: KeyService,
          useValue: mockKeyService,
        },
      ],
    }).compile();

    controller = module.get<KeyController>(KeyController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  const projectId = 'proj-1';
  const namespaceId = 'ns-1';

  describe('create', () => {
    it('should create a key', async () => {
      const createDto: CreateKeyDto = {
        name: 'login.submit',
        type: KeyType.TEXT,
      };
      const expectedResult = { id: 'key-1', ...createDto, namespaceId };
      mockKeyService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(projectId, namespaceId, createDto);
      expect(result).toEqual(expectedResult);
      expect(mockKeyService.create).toHaveBeenCalledWith(
        projectId,
        namespaceId,
        createDto,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of keys', async () => {
      const expectedResult = [
        { id: 'key-1', name: 'login.submit', namespaceId },
      ];
      mockKeyService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(projectId, namespaceId);
      expect(result).toEqual(expectedResult);
      expect(mockKeyService.findAll).toHaveBeenCalledWith(
        projectId,
        namespaceId,
      );
    });
  });

  describe('lookupByName', () => {
    it('should lookup keys by name', async () => {
      const name = 'login.submit';
      const excludeKeyId = 'key-exclude';
      const expectedResult: unknown[] = [];
      mockKeyService.lookupByName.mockResolvedValue(expectedResult);

      const result = await controller.lookupByName(
        projectId,
        name,
        excludeKeyId,
      );
      expect(result).toEqual(expectedResult);
      expect(mockKeyService.lookupByName).toHaveBeenCalledWith(
        projectId,
        name,
        excludeKeyId,
      );
    });
  });

  describe('copyTranslations', () => {
    it('should copy translations from another key', async () => {
      const keyId = 'key-1';
      const sourceKeyId = 'key-src';
      const expectedResult = { copied: 2, skipped: 0, mode: 'fillMissing' };
      mockKeyService.copyTranslations.mockResolvedValue(expectedResult);

      const result = await controller.copyTranslations(
        projectId,
        namespaceId,
        keyId,
        {
          sourceKeyId,
          mode: 'fillMissing',
        },
      );

      expect(result).toEqual(expectedResult);
      expect(mockKeyService.copyTranslations).toHaveBeenCalledWith(
        projectId,
        namespaceId,
        keyId,
        sourceKeyId,
        'fillMissing',
      );
    });
  });

  describe('findOne', () => {
    it('should return a single key', async () => {
      const keyId = 'key-1';
      const expectedResult = { id: keyId, name: 'login.submit', namespaceId };
      mockKeyService.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(projectId, namespaceId, keyId);
      expect(result).toEqual(expectedResult);
      expect(mockKeyService.findOne).toHaveBeenCalledWith(
        projectId,
        namespaceId,
        keyId,
      );
    });
  });

  describe('update', () => {
    it('should update a key', async () => {
      const keyId = 'key-1';
      const updateDto: UpdateKeyDto = { name: 'login.new_submit' };
      const expectedResult = { id: keyId, ...updateDto, namespaceId };
      mockKeyService.update.mockResolvedValue(expectedResult);

      const result = await controller.update(
        projectId,
        namespaceId,
        keyId,
        updateDto,
      );
      expect(result).toEqual(expectedResult);
      expect(mockKeyService.update).toHaveBeenCalledWith(
        projectId,
        namespaceId,
        keyId,
        updateDto,
      );
    });
  });

  describe('remove', () => {
    it('should remove a key', async () => {
      const keyId = 'key-1';
      mockKeyService.remove.mockResolvedValue({ success: true });

      await controller.remove(projectId, namespaceId, keyId);
      expect(mockKeyService.remove).toHaveBeenCalledWith(
        projectId,
        namespaceId,
        keyId,
      );
    });
  });
});
