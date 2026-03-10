import { IsString, IsNotEmpty } from 'class-validator';

export class CreateLocaleDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
