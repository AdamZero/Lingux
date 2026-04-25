import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50, { message: 'Description must not exceed 50 characters' })
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  localeIds?: string[];

  @IsBoolean()
  @IsOptional()
  autoTranslateEnabled?: boolean;

  @IsString()
  @IsOptional()
  autoTranslateProviderId?: string;
}
