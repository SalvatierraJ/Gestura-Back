import { TribunalDocenteService } from './../tribunal-docente/tribunal-docente.service';
import { Body, Controller, Get,Post,Put,Request } from '@nestjs/common';

@Controller('docentesmanagement')
export class DocentesmanagementController {

    constructor(
        private TribunalDocenteService: TribunalDocenteService
    ) {}

    @Get('/docentes/:page/:pageSize')
    async getAllDocentes(@Request() req) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.TribunalDocenteService.getTribunalesDocentes({ page, pageSize });
    }
    @Post('/crear-docente')
    async createDocente(@Body() body: any) {
        return this.TribunalDocenteService.createTribunalDocente(body);
    }
    @Put('/actualizar-docente/:id')
    async updateDocente(@Request() req, @Body() body: any) {
        const id = Number(req.params.id);
        return this.TribunalDocenteService.updateTribunalDocente(id, body);
    }
    @Put('/actualizar-estado-docente/:id')
    async updateEstadoDocente(@Request() req, @Body() body: any) {
        const id = Number(req.params.id);
        return this.TribunalDocenteService.updateEstadoTribunalDocente(id, body);
    }

}
