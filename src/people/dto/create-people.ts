import { IsNotEmpty, IsString } from "class-validator";
export class CreatePeopleDto {
    @IsString()
    Nombre: string
    @IsString()
    Apellido1: string
    @IsString()
    Apellido2?: string
    @IsNotEmpty()
    @IsString()
    Correo: string
    CI: string
}