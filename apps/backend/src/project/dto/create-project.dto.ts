import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsBoolean,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
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
