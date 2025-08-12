import { Controller, Get } from '@nestjs/common';
import { ModuloPeriodoService } from './modulo-periodo.service';

@Controller('modulo-periodo')
export class ModuloPeriodoController {

    constructor(
        private periodoService: ModuloPeriodoService
    ) { }

    @Get('/periodos-gestion-actual')
    async obtenerPeriodoModulo() {
        return this.periodoService.obtenerPeriodosGestionActual();
    }

}
