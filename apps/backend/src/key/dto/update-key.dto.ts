import { PartialType } from '@nestjs/mapped-types';
import { CreateKeyDto, KeyType } from './create-key.dto';
import { IsString, IsOptional, IsEnum } from 'class-validator';

export class UpdateKeyDto extends PartialType(CreateKeyDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(KeyType)
  @IsOptional()
  type?: KeyType;
}
