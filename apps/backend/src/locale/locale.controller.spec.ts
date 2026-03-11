import { Test, TestingModule } from '@nestjs/testing';
import { LocaleController } from './locale.controller';
import { LocaleService } from './locale.service';
import { CreateLocaleDto } from './dto/create-locale.dto';

const mockLocaleService = {
  create: jest.fn(),
  findAll: jest.fn(),
};

describe('LocaleController', () => {
  let controller: LocaleController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocaleController],
      providers: [
        {
          provide: LocaleService,
          useValue: mockLocaleService,
        },
      ],
    }).compile();

    controller = module.get<LocaleController>(LocaleController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a locale', async () => {
      const createDto: CreateLocaleDto = { code: 'en-US', name: 'English' };
      const expectedResult = { id: 'locale-1', ...createDto };
      mockLocaleService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(createDto);
      expect(result).toEqual(expectedResult);
      expect(mockLocaleService.create).toHaveBeenCalledWith(createDto);
    });
  });

  describe('findAll', () => {
    it('should return an array of locales', async () => {
      const expectedResult = [
        { id: 'locale-1', code: 'en-US', name: 'English' },
      ];
      mockLocaleService.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll();
      expect(result).toEqual(expectedResult);
      expect(mockLocaleService.findAll).toHaveBeenCalled();
    });
  });
});
