import { CarreraService } from 'src/carrera/carrera.service';
import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
import { FacultadService } from 'src/facultad/facultad.service';
import { CreateCarrera } from 'src/carrera/dto/create-carrera.dto';

@Controller('case-study-management')
export class CaseStudyManagementController {
    constructor(
        private facultadService:FacultadService,
        private carreraService:CarreraService
    ){}


    @Get('/facultades')
    async getAllFacultades() {
        return this.facultadService.getAllFacultades();
    }
    @Get('/carreras/:page/:pageSize')
    async getAllCarreras(@Request() req) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.carreraService.getAllCarreras({ page, pageSize});
    }
    @Post('/crear-carrera')
    async createCarrera(@Body() body:CreateCarrera) {
        return this.carreraService.createCarrera(body);
    }
    @Put('/actualizar-carrera/:id')
    async updateCarrera(@Request() req, @Body() body: CreateCarrera) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateCarrera(id, body);
    }
    @Put('/actualizar-estado-carrera/:id')
    async updateEstadoCarrera(@Request() req,@Body() body: any) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateStateCarrera(id, body);
    }

}
