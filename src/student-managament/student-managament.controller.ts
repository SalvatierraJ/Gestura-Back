import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DefensaService } from 'src/defensa/defensa.service';
import { EstudianteService } from 'src/estudiante/estudiante.service';

@Controller('student-managament')
export class StudentManagamentController {

    constructor(private estudianteService: EstudianteService, private defensaService: DefensaService) { }
    @UseGuards(JwtAuthGuard)
    @Get('/estudiantes/:page/:pageSize')
    async getAllCarreras(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.estudianteService.getAllEstudiantes({ page, pageSize,user: user.userId  });
    }

    @Post('/nuevo-estudiante')
    async createCarrera(@Body() body: any) {
        return this.estudianteService.createEstudiantes(body);
    }

    @Put('/editar-estudiante/:id')
    async editEstudiante(@Request() req, @Body() body: any) {
        const id = Number(req.params.id);
        return this.estudianteService.updateEstudiante(id, body)
    }

    @Post('/generar-Defensa')
    async crearDefensa(@Body() body: any) {
        const estudianteIds = Array.isArray(body.estudianteIds)
            ? body.estudianteIds.map(Number)
            : [Number(body.estudianteIds)];
        return this.defensaService.generarDefensa(estudianteIds, body);
    }



}
