export class CreateRolDto {
    nombre: string;
    carreras: number[];
    modulosPermisos?: {
        idModulo: number;
        permisos: number[];
    }[];
    esTotal?: boolean;
}