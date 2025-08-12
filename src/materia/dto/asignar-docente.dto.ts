
import { IsInt, IsOptional } from 'class-validator';

export class AsignarDocenteDto {
  @IsInt()
  id_horario: number;

  @IsOptional()
  @IsInt()
  id_docente?: number | null;
}
