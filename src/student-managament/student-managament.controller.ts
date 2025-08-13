import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DefensaService } from 'src/defensa/defensa.service';
import { UpdateEstudianteStateOrDeleteDto } from 'src/estudiante/dto/update-estado-o-borrado.dto';
import { EstudianteService } from 'src/estudiante/estudiante.service';

@Controller('student-managament')
export class StudentManagamentController {

    constructor(private estudianteService: EstudianteService, private defensaService: DefensaService) { }
    @UseGuards(JwtAuthGuard)
    @Get('/estudiantes')
    async getAll(
        @Query('page') page = '1',
        @Query('pageSize') pageSize = '10',
        @Query('word') word = '',
        @Request() req: any,
    ) {
        return this.estudianteService.getAllEstudiantes({
            page: Number(page),
            pageSize: Number(pageSize),
            user: Number(req.user?.userId),
            word,
        });
    }

    @Put('/estudiante/:id/estado-o-borrado')
    updateEstadoOBorrado(
        @Param('id') id: string,
        @Body() body:  UpdateEstudianteStateOrDeleteDto,
    ) {
        return this.estudianteService.updateStateOrDeleteEstudiante(Number(id), body);
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
    @Post('/estudiantes-masivo')
    async createMasiveSudents(@Body() body: any) {
        return this.estudianteService.createEstudiantesMasivos(body);
    }




}
