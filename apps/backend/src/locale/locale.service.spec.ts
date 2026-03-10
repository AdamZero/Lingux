import { Test, TestingModule } from '@nestjs/testing';
import { LocaleService } from './locale.service';
import { PrismaService } from '../prisma.service';
import { ConflictException } from '@nestjs/common';
import { CreateLocaleDto } from './dto/create-locale.dto';

const mockPrismaService = {
  locale: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
};

describe('LocaleService', () => {
  let service: LocaleService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocaleService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<LocaleService>(LocaleService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: CreateLocaleDto = { code: 'en-US', name: 'English' };

    it('should create a locale', async () => {
      const expectedResult = { id: 'locale-1', ...createDto };
      prisma.locale.findUnique.mockResolvedValue(null);
      prisma.locale.create.mockResolvedValue(expectedResult);

      const result = await service.create(createDto);
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findUnique).toHaveBeenCalledWith({ where: { code: createDto.code } });
      expect(prisma.locale.create).toHaveBeenCalledWith({ data: createDto });
    });

    it('should throw ConflictException if locale already exists', async () => {
      prisma.locale.findUnique.mockResolvedValue({ id: 'locale-1', ...createDto });
      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return an array of locales', async () => {
      const expectedResult = [{ id: 'locale-1', code: 'en-US', name: 'English' }];
      prisma.locale.findMany.mockResolvedValue(expectedResult);

      const result = await service.findAll();
      expect(result).toEqual(expectedResult);
      expect(prisma.locale.findMany).toHaveBeenCalled();
    });
  });
});
