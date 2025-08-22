export class CreatePlantillaDto {
  nombre_archivo: string;
  ruta_archivo: string;
  id_usuario: bigint;
  id_modulo: bigint;
}

export class PlantillaResponseDto {
  id_plantilla: bigint;
  nombre_archivo: string;
  ruta_archivo: string;
  id_usuario: bigint;
  id_modulo: bigint;
  created_at: Date;
  updated_at: Date;
}

export class PlantillasUploadResponseDto {
  success: boolean;
  message: string;
  plantillas: any[]; // Cambiamos a any[] temporalmente para evitar errores de tipo
  jobs: any[];
  uuids: string[];
}
