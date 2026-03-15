import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export type ReleaseScopeType = 'all' | 'namespaces' | 'keys';

export class CreateReleaseDto {
  @IsString()
  @IsOptional()
  baseReleaseId?: string;

  @IsObject()
  scope!: {
    type: ReleaseScopeType;
    namespaceIds?: string[];
    keyIds?: string[];
  };

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  localeCodes?: string[];

  @IsString()
  @IsOptional()
  note?: string;
}

export class PreviewReleaseDto extends CreateReleaseDto {}

export class PublishReleaseDto {
  @IsString()
  sessionId!: string;
}

export class ReleaseSessionNoteDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class ReleaseSessionRejectDto {
  @IsString()
  reason!: string;
}

export class ListReleasesQueryDto {
  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  before?: string;

  @IsString()
  @IsOptional()
  beforeId?: string;
}

export class RollbackReleaseDto {
  @IsString()
  @IsOptional()
  toReleaseId?: string;
}
