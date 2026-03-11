import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum TranslationStatus {
  PENDING = 'PENDING',
  TRANSLATING = 'TRANSLATING',
  REVIEWING = 'REVIEWING',
  APPROVED = 'APPROVED',
  PUBLISHED = 'PUBLISHED',
}

export class CreateTranslationDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsNotEmpty()
  localeCode: string;

  @IsEnum(TranslationStatus)
  @IsOptional()
  status?: TranslationStatus = TranslationStatus.PENDING;

  @IsBoolean()
  @IsOptional()
  isLlmTranslated?: boolean = false;
}
