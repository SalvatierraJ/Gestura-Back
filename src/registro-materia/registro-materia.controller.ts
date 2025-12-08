import { GeminiService } from './../gemini/gemini.service';
import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { IaService } from 'src/ia/ia.service';
import { AsignarDocenteDto } from 'src/materia/dto/asignar-docente.dto';
import { MateriaService } from 'src/materia/materia.service';
import { RedisService } from 'src/redis/redis.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
interface EstudianteData {
    registro: string | number;
    estado: string;
    turno_inscripcion: string;
    turno_moda: string;
    semestre_ingreso: string;
    semestre_ultimo: string;
}

type EntradaDocente = {
    agd_appaterno: string;
    agd_apmaterno: string;
    agd_nombres: string;
    semestre: string;
    agd_docnro: string;
    mat_codigo: string;
    mdl_descripcion: string;
    mdu_codigo: string;
    pln_grupo: string;
};

@ApiTags('registro-materia')
@Controller('registro-materia')
export class RegistroMateriaController {
    constructor(private materiaService: MateriaService, private readonly redisService: RedisService, private geminiService: GeminiService, private iaService: IaService) { }

    @Post('/Registrar-Materias')
    @ApiOperation({ 
        summary: 'Registrar materias', 
        description: 'Registra una o varias materias en el sistema. Permite crear materias con sus códigos, nombres, créditos, etc.' 
    })
    @ApiBody({ 
        description: 'Array de materias a registrar',
        examples: {
            ejemplo1: {
                value: [
                    { codigo: 'INF-101', nombre: 'Programación I', creditos: 4 },
                    { codigo: 'INF-102', nombre: 'Base de Datos', creditos: 3 }
                ],
                summary: 'Ejemplo de registro de materias'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Materias registradas exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async editEstudiante(@Body() materias: any[]) {
        return this.materiaService.registrarMaterias(materias)
    }

    @Post('/cargar-Horario-materia')
    @ApiOperation({ 
        summary: 'Cargar horarios de materias desde JSON', 
        description: 'Carga horarios de materias desde un array JSON. Útil para importar horarios masivamente desde archivos o sistemas externos.' 
    })
    @ApiBody({ 
        description: 'Array de horarios a cargar',
        examples: {
            ejemplo1: {
                value: {
                    data: [
                        { codigo_materia: 'INF-101', dia: 'Lunes', hora_inicio: '08:00', hora_fin: '10:00', aula: 'Aula 101' },
                        { codigo_materia: 'INF-102', dia: 'Martes', hora_inicio: '10:00', hora_fin: '12:00', aula: 'Aula 102' }
                    ]
                },
                summary: 'Ejemplo de carga de horarios'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Horarios procesados', example: { message: 'Se procesaron 10 horarios.', errores: [] } })
    @ApiResponse({ status: 400, description: 'El campo data debe ser un array' })
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

    @Post('/estudiantes/registro-materias')
    @ApiOperation({ 
        summary: 'Crear estudiantes en lote', 
        description: 'Crea múltiples estudiantes a la vez con sus datos académicos completos. Útil para importar estudiantes desde sistemas externos.' 
    })
    @ApiBody({ 
        description: 'Array de estudiantes a crear',
        examples: {
            ejemplo1: {
                value: [
                    { registro: '2021001234', nombre: 'Juan', apellido: 'Pérez', carrera: 'Ingeniería de Sistemas' },
                    { registro: '2021001235', nombre: 'María', apellido: 'García', carrera: 'Ingeniería de Sistemas' }
                ],
                summary: 'Ejemplo de creación masiva de estudiantes'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Estudiantes creados exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async crearEstudianteCompleto(@Body() body: any) {
        return await this.materiaService.crearEstudiantesLote(body);
    }

    @Get('/buscar/estudiante/:nroRegistro')
    @ApiOperation({ 
        summary: 'Buscar estudiante por número de registro', 
        description: 'Busca un estudiante por su número de registro y obtiene su pensum completo (materias cursadas, aprobadas, pendientes, etc.)' 
    })
    @ApiParam({ name: 'nroRegistro', description: 'Número de registro del estudiante', type: String, example: '2021001234' })
    @ApiResponse({ status: 200, description: 'Información del estudiante y pensum obtenida exitosamente' })
    @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
    async buscarEstudiante(@Request() req?: any) {
        const nroRegistro = String(req.params.nroRegistro);
        return await this.materiaService.getPensumDeEstudiantePorRegistro(nroRegistro);
    }

    @Post('/inscripcion-materias')
    @ApiOperation({ 
        summary: 'Inscribir estudiante en materias', 
        description: 'Inscribe un estudiante en una o varias materias para una gestión específica. Requiere el ID de la persona, la gestión y los códigos de materias y horarios.' 
    })
    @ApiBody({ 
        description: 'Datos de inscripción',
        examples: {
            ejemplo1: {
                value: {
                    id_persona: '1',
                    gestion: '2024-1',
                    materias: [
                        { codigo: 101, codigo_horario: 1 },
                        { codigo: 102, codigo_horario: 2 }
                    ]
                },
                summary: 'Ejemplo de inscripción en materias'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Estudiante inscrito en materias exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o materias no disponibles' })
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
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener estudiantes con materias paginado', 
        description: 'Obtiene una lista paginada de estudiantes con sus materias inscritas. Permite filtrar por rango de fechas. Requiere autenticación JWT.' 
    })
    @ApiQuery({ name: 'page', required: false, type: String, description: 'Número de página', example: '1' })
    @ApiQuery({ name: 'pageSize', required: false, type: String, description: 'Cantidad de elementos por página', example: '10' })
    @ApiQuery({ name: 'fechaInicio', required: false, type: String, description: 'Fecha de inicio para filtrar (formato: YYYY-MM-DD)', example: '2024-01-01' })
    @ApiQuery({ name: 'fechaFin', required: false, type: String, description: 'Fecha de fin para filtrar (formato: YYYY-MM-DD)', example: '2024-12-31' })
    @ApiResponse({ status: 200, description: 'Lista de estudiantes con materias obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
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

    @UseGuards(JwtAuthGuard)
    @Get("/carreras-con-pensum")
    async getCarrerasConPensum(@Request() req: any) {
        const userId = req.user?.userId;
        return this.materiaService.getCarrerasConPensumPorUsuario(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Get("/pensum-carrera/:nombreCarrera/:numeroPensum")
    async getPensumCarrera(@Request() req: any) {
        const nombreCarrera = req.params.nombreCarrera;
        const numeroPensum = Number(req.params.numeroPensum);
        return this.materiaService.getPensumDeCarreraPensum(nombreCarrera, numeroPensum);
    }

    @Put("/materia/:id/prerrequisitos")
    async updatePrerrequisitos(
        @Param('id') id: number,
        @Body() body: { prerrequisitos: { id_materia_preRequisito?: number, total_materia?: number }[] }
    ) {
        return this.materiaService.actualizarPrerrequisitosMateria(Number(id), body.prerrequisitos);
    }

    @Put("/materia/:id/equivalencias")
    async updateEquivalencias(
        @Param('id') id: number,
        @Body() body: { equivalencias: number[] }
    ) {
        return this.materiaService.actualizarEquivalenciasMateria(Number(id), body.equivalencias);
    }


    @Post('/actualizar-estudiantes/moda')
    async actualizarEstudiantes(@Body() estudiantes: EstudianteData[]) {
        return this.materiaService.updateEstudiantesBatch(estudiantes);
    }

    @Get('/recomendar-horarios')
    async recomendarHorarios(
        @Query('carrera') carrera: string,
        @Query('pensum') pensum: number,
    ) {
        if (!carrera || !pensum) {
            return { error: 'Faltan parámetros carrera o pensum' };
        }

        const materias = await this.materiaService.recomendarHorariosMateriasFaltantes(
            carrera,
            Number(pensum),
        );
        return {
            materias,
        };
    }

    @Post('/registrar-docente/json')
    async registrarDocente(@Body() EntradaDocente: EntradaDocente[]) {
        return this.materiaService.registrarDocentesDesdeJson(EntradaDocente);
    }
    @Get('/historial-docente-materias')
    async obtenerHistorialMateriaDocente() {
        return this.materiaService.obtenerMateriasYDocentesGestionActual();
    }

    @Post('/sugerir-asignacion/materia')
    async sugerirParaMateria(@Body() body: any) {
        return this.iaService.sugerirAsignacionDocentes(body);
    }

    @Post('/asignar-docente-materia')
    @ApiOperation({ 
        summary: 'Asignar o desasignar docente a materia', 
        description: 'Asigna un docente a un horario de materia específico. Si se envía id_docente como null, se desasigna el docente actual.' 
    })
    @ApiBody({ 
        type: AsignarDocenteDto,
        description: 'Datos de asignación',
        examples: {
            asignar: {
                value: { id_horario: 1, id_docente: 5 },
                summary: 'Asignar docente'
            },
            desasignar: {
                value: { id_horario: 1, id_docente: null },
                summary: 'Desasignar docente'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Docente asignado/desasignado exitosamente' })
    @ApiResponse({ status: 404, description: 'Horario o docente no encontrado' })
    async asignarDocenteMateria(@Body() dto: AsignarDocenteDto) {
        const updated = await this.materiaService.asignarDocente(dto.id_horario, dto.id_docente ?? null);

        return {
            ok: true,
            mensaje: dto.id_docente
                ? 'Docente asignado correctamente'
                : 'Docente desasignado correctamente',
            data: updated,
        };
    }
    //chatbot posiblemente se borre 
    @Get('/avance-gemini')
    async avancePensumGemini(
        @Query('registro') registro: string,
        @Query('nombre') nombre: string,
        @Query('numeroPensum') numeroPensum: number,
    ) {
        const data = await this.materiaService.avancePensum({
            registro,
            nombre,
            numeroPensum: Number(numeroPensum),
        });

        // Construir el prompt amigable
        const prompt = this.construirPromptAvance(data);

        // Enviar al modelo Gemini
        const respuestaGemini = await this.geminiService.consultarGemini(prompt);

        return {
            infoEstudiante: data,
            sugerenciaLLM: respuestaGemini,
        };
    }

    construirPromptAvance(data: any) {
        let prompt = `Tengo el siguiente avance académico de un estudiante:\n`;
        prompt += `Nombre: ${data.estudiante.nombre}\n`;
        prompt += `Registro: ${data.estudiante.registro}\n`;
        prompt += `Carrera: ${data.estudiante.carrera}\n`;
        prompt += `Pensum: ${data.estudiante.pensum}\n`;
        prompt += `Estado general: ${data.estudiante.estado}\n`;
        prompt += `Materias:\n`;
        data.avance.forEach((mat: any) => {
            prompt += `- ${mat.materia} (${mat.sigla}): ${mat.estado}\n`;
        });
        prompt += `\n¿Qué recomendaciones le darías a este estudiante para avanzar más rápido en su carrera?`;

        return prompt;
    }


}
