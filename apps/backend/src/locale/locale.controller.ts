import { Controller, Get, Post, Body } from '@nestjs/common';
import { LocaleService } from './locale.service';
import { CreateLocaleDto } from './dto/create-locale.dto';

@Controller('locales')
export class LocaleController {
  constructor(private readonly localeService: LocaleService) {}

  @Post()
  create(@Body() createLocaleDto: CreateLocaleDto) {
    return this.localeService.create(createLocaleDto);
  }

  @Get()
  findAll() {
    return this.localeService.findAll();
  }
}
