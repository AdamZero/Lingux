import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export enum KeyType {
  TEXT = 'TEXT',
  RICH_TEXT = 'RICH_TEXT',
  ASSET = 'ASSET',
}

export class CreateKeyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(KeyType)
  @IsOptional()
  type?: KeyType = KeyType.TEXT;
}
