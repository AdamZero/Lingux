import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateNamespaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
