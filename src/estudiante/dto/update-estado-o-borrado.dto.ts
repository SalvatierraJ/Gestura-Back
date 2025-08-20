import { IsBoolean, IsOptional, ValidateIf } from 'class-validator';

export class UpdateEstudianteStateOrDeleteDto {
  @ValidateIf((o) => typeof o.delete !== 'boolean')
  @IsBoolean()
  @IsOptional()
  estado?: boolean;

  @ValidateIf((o) => typeof o.estado !== 'boolean')
  @IsBoolean()
  @IsOptional()
  delete?: boolean;
}