import { IsNotEmpty,IsString} from "class-validator";
export class CreateCarrera {
    @IsNotEmpty()
    @IsString()
    nombre_carrera:string  
    @IsNotEmpty()
    @IsString()               
    id_facultad:string
}