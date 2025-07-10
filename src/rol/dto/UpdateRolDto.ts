export class UpdateRolDto {
    id: number;
    nombre: string;
    carreras: number[];
    modulosPermisos?: {
        idModulo: number;
        permisos: number[];
    }[];
    esTotal?: boolean;
}