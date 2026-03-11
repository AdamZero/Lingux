import { Injectable, ConflictException } from '@nestjs/common';
import { CreateLocaleDto } from './dto/create-locale.dto';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LocaleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLocaleDto: CreateLocaleDto) {
    const existing = await this.prisma.locale.findUnique({
      where: { code: createLocaleDto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Locale with code ${createLocaleDto.code} already exists`,
      );
    }
    return this.prisma.locale.create({
      data: createLocaleDto,
    });
  }

  async findAll() {
    return this.prisma.locale.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }
}
