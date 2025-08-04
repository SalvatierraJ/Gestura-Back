import { GeminiService } from './../gemini/gemini.service';
import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { MateriaService } from 'src/materia/materia.service';
import { RedisService } from 'src/redis/redis.service';
interface EstudianteData {
    registro: string | number;
    estado: string;
    turno_inscripcion: string;
    turno_moda: string;
}

@Controller('registro-materia')
export class RegistroMateriaController {
    constructor(private materiaService: MateriaService, private readonly redisService: RedisService, private geminiService: GeminiService) { }

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

        const prompt = this.construirPromptHorarios(carrera, pensum, materias);

        const respuesta = await this.geminiService.consultarGemini(prompt);

        return {
            materias,
            propuestaHorarios: respuesta,
        };
    }

    construirPromptHorarios(carrera: string, pensum: number, materias: any[]) {
        let prompt = `Simula una propuesta de módulos (M0 a M5) para abrir materias faltantes de la carrera ${carrera}, pensum ${pensum}.\n`;
        prompt += `Cada materia puede asignarse a un único módulo. Intenta equilibrar la carga entre módulos y evita agrupar demasiadas del mismo semestre en un solo módulo.\n`;
        prompt += `\nLista de materias:\n`;

        materias.forEach((item: any) => {
            const materia = item.materia;
            if (materia) {
                prompt += `- ${materia.nombre} (${materia.sigla}), semestre ${materia.semestre}\n`;
            }
        });

        prompt += `\nDevuélveme la lista como:\nMateria - Sigla - Semestre: Módulo sugerido (M0 a M5)`;

        return prompt;
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
