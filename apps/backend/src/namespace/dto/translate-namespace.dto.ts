import { IsOptional, IsArray, IsString } from 'class-validator';

export class TranslateNamespaceDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  namespaceIds?: string[];
}
