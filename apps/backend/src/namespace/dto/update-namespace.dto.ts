import { PartialType } from '@nestjs/mapped-types';
import { CreateNamespaceDto } from './create-namespace.dto';
import { IsString, IsOptional } from 'class-validator';

export class UpdateNamespaceDto extends PartialType(CreateNamespaceDto) {
  @IsString()
  @IsOptional()
  name?: string;
}
