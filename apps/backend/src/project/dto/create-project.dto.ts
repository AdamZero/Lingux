import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Description must not exceed 50 characters' })
  description?: string;

  @IsString()
  @IsOptional()
  baseLocale?: string = 'zh-CN';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  localeIds?: string[];

  @IsBoolean()
  @IsOptional()
  autoTranslateEnabled?: boolean = false;
}
