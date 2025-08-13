import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCarreraStateDto {
  @IsOptional() @IsBoolean()
  delete?: boolean;   

  @IsOptional() @IsBoolean()
  estado?: boolean;
}