import { BadRequestException, Body, Controller, Delete, Get, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MateriaService } from 'src/materia/materia.service';

@Controller('registro-materia')
export class RegistroMateriaController {
    constructor(private materiaService: MateriaService) { }

    @Post('/Registrar-Materias')
    async editEstudiante(@Body() materias: any[]) {
        return this.materiaService.registrarMaterias(materias)
    }

    @Post('/cargar-Horario-materia')
    async cargarDesdeJson(@Body() body: { data: any[] }) {
        if (!Array.isArray(body.data)) {
            throw new BadRequestException('El campo data debe ser un array');
        }
        const result = await this.materiaService.cargarHorariosDesdeJson(body.data);
        return {
            message: `Se procesaron ${result.ok} horarios.`,
            errores: result.errores
        };
    }

    //esta funcion registra las materias de los estudiantes cursadas de forma masiva es decir mas de uno, tambien les crea usuarios y contrasenas 
    @Post('/estudiantes/registro-materias')
    async crearEstudianteCompleto(@Body() body: any) {
        return await this.materiaService.crearEstudiantesLote(body);
    }

    @Get('/buscar/estudiante/:nroRegistro')
    async buscarEstudiante(@Request() req?: any) {
        const nroRegistro = String(req.params.nroRegistro);
        return await this.materiaService.getPensumDeEstudiantePorRegistro(nroRegistro);
    }

    @Post('/inscripcion-materias')
    async inscribirMaterias(@Body() body: {
        id_persona: string,
        gestion: string,
        materias: { codigo: number, codigo_horario: number }[]
    }) {
        return this.materiaService.registerIncripcionMateria(body);
    }
    @Delete('/eliminar/inscripcion')
    async eliminarInscripcion(
        @Body() body: {
            id_persona: string,
            codigo: number,
            codigo_horario: number,
            gestion: string
        }
    ) {
        return this.materiaService.eliminarInscripcionMateria(body);
    }

    @UseGuards(JwtAuthGuard)
    @Get('/materias-paginado')
    async getEstudiantesMateriasPaginado(
        @Request() req: any,
        @Query('page') page: string,
        @Query('pageSize') pageSize: string,
        @Query('fechaInicio') fechaInicio?: string,
        @Query('fechaFin') fechaFin?: string,
    ) {
        const userId = req.user?.userId;
        const pageNum = page ? Number(page) : 1;
        const pageSizeNum = pageSize ? Number(pageSize) : 10;

        const result = await this.materiaService.getEstudiantesMateriasPaginado({
            page: pageNum,
            pageSize: pageSizeNum,
            user: userId,
            fechaInicio,
            fechaFin
        });

        return result;
    }
  @UseGuards(JwtAuthGuard)
  @Delete("/eliminar/inscripcion")
  async eliminarInscripcionMateria(@Body() body: any) {
    return this.materiaService.eliminarInscripcionMateria(body);
  }

  @UseGuards(JwtAuthGuard)
  @Post("/registrar/inscripcion")
  async registrarInscripcionMateria(@Body() body: any) {

    return this.materiaService.registerIncripcionMateria(body);
  }

}
