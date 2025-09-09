import {Controller, Get} from "@nestjs/common";
import {ModulosService} from "./modulos.service";
@Controller("/modules")
export class ModuloController { 
    constructor(private moduloservice : ModulosService) { 
    }
    @Get('getAllmodules') 
    async obtenerModulos() { 
        return await this.moduloservice.getAllModulos();
    }
}