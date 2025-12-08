import { Controller, Get } from '@nestjs/common';
import { ModuloPeriodoService } from './modulo-periodo.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('modulo-periodo')
@Controller('modulo-periodo')
export class ModuloPeriodoController {

    constructor(
        private periodoService: ModuloPeriodoService
    ) { }

    @Get('/periodos-gestion-actual')
    @ApiOperation({ 
        summary: 'Obtener períodos de la gestión actual', 
        description: 'Obtiene todos los períodos académicos (semestres, trimestres, etc.) de la gestión académica actual' 
    })
    @ApiResponse({ status: 200, description: 'Lista de períodos obtenida exitosamente' })
    async obtenerPeriodoModulo() {
        return this.periodoService.obtenerPeriodosGestionActual();
    }

}
