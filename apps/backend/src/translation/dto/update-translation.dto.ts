import { PartialType } from '@nestjs/mapped-types';
import {
  CreateTranslationDto,
  TranslationStatus,
} from './create-translation.dto';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

export class UpdateTranslationDto extends PartialType(CreateTranslationDto) {
  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(TranslationStatus)
  @IsOptional()
  status?: TranslationStatus;

  @IsBoolean()
  @IsOptional()
  isLlmTranslated?: boolean;
}
