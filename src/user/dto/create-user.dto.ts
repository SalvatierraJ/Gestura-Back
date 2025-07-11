import { IsNotEmpty,IsString} from "class-validator";
export class CreateUserDto {
    @IsNotEmpty()
    @IsString()
    Nombre_Usuario:string  
    @IsNotEmpty()
    @IsString()               
    Password:string               
    Id_Rol:Number[] 
    Id_Persona:bigint
}