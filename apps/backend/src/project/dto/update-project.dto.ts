import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
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
