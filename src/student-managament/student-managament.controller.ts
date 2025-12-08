import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DefensaService } from 'src/defensa/defensa.service';
import { UpdateEstudianteStateOrDeleteDto } from 'src/estudiante/dto/update-estado-o-borrado.dto';
import { EstudianteService } from 'src/estudiante/estudiante.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('estudiantes')
@Controller('student-managament')
export class StudentManagamentController {

    constructor(private estudianteService: EstudianteService, private defensaService: DefensaService) { }
    @UseGuards(JwtAuthGuard)
    @Get('/estudiantes')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de estudiantes paginada', 
        description: 'Obtiene una lista paginada de todos los estudiantes. Permite filtrar por palabra clave. Requiere autenticación JWT.' 
    })
    @ApiQuery({ name: 'page', required: false, type: String, description: 'Número de página', example: '1' })
    @ApiQuery({ name: 'pageSize', required: false, type: String, description: 'Cantidad de elementos por página', example: '10' })
    @ApiQuery({ name: 'word', required: false, type: String, description: 'Palabra clave para filtrar estudiantes', example: 'Juan' })
    @ApiResponse({ status: 200, description: 'Lista de estudiantes obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
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
    @ApiOperation({ 
        summary: 'Actualizar estado o eliminar estudiante', 
        description: 'Permite cambiar el estado activo/inactivo de un estudiante o eliminarlo. Solo se puede enviar "estado" o "delete", no ambos.' 
    })
    @ApiParam({ name: 'id', description: 'ID del estudiante', type: String, example: '1' })
    @ApiBody({ 
        type: UpdateEstudianteStateOrDeleteDto,
        description: 'Acción a realizar',
        examples: {
            cambiarEstado: {
                value: { estado: false },
                summary: 'Desactivar estudiante'
            },
            eliminar: {
                value: { delete: true },
                summary: 'Eliminar estudiante'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Operación realizada exitosamente' })
    @ApiResponse({ status: 400, description: 'Debe enviar "estado" o "delete", no ambos' })
    @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
    updateEstadoOBorrado(
        @Param('id') id: string,
        @Body() body:  UpdateEstudianteStateOrDeleteDto,
    ) {
        return this.estudianteService.updateStateOrDeleteEstudiante(Number(id), body);
    }

    @Post('/nuevo-estudiante')
    @ApiOperation({ 
        summary: 'Crear nuevo estudiante', 
        description: 'Crea un nuevo estudiante en el sistema con toda su información académica y personal' 
    })
    @ApiBody({ 
        description: 'Datos del estudiante a crear',
        examples: {
            ejemplo1: {
                value: {
                    registro: '2021001234',
                    nombre: 'Juan',
                    apellido: 'Pérez',
                    ci: '12345678',
                    carrera: 'Ingeniería de Sistemas',
                    semestre_ingreso: '2021-1'
                },
                summary: 'Ejemplo de creación de estudiante'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Estudiante creado exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async createCarrera(@Body() body: any) {
        return this.estudianteService.createEstudiantes(body);
    }
    

    @Put('/editar-estudiante/:id')
    @ApiOperation({ 
        summary: 'Editar estudiante existente', 
        description: 'Actualiza la información de un estudiante existente por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del estudiante a editar', type: Number, example: 1 })
    @ApiBody({ 
        description: 'Datos actualizados del estudiante',
        examples: {
            ejemplo1: {
                value: {
                    nombre: 'Juan Carlos',
                    apellido: 'Pérez García',
                    carrera: 'Ingeniería de Sistemas'
                },
                summary: 'Ejemplo de edición de estudiante'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Estudiante actualizado exitosamente' })
    @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
    async editEstudiante(@Request() req, @Body() body: any) {
        const id = Number(req.params.id);
        return this.estudianteService.updateEstudiante(id, body)
    }

    @Post('/generar-Defensa')
    @ApiOperation({ 
        summary: 'Generar defensa para estudiantes', 
        description: 'Genera una nueva defensa para uno o varios estudiantes. Permite crear defensas individuales o grupales.' 
    })
    @ApiBody({ 
        description: 'Datos para generar la defensa',
        examples: {
            ejemplo1: {
                value: {
                    estudianteIds: [1, 2, 3],
                    tipoDefensa: 'Tesis',
                    fecha: '2024-12-15',
                    hora: '10:00'
                },
                summary: 'Ejemplo de generación de defensa para múltiples estudiantes'
            },
            ejemplo2: {
                value: {
                    estudianteIds: 1,
                    tipoDefensa: 'Proyecto de Grado',
                    fecha: '2024-12-20'
                },
                summary: 'Ejemplo de generación de defensa para un estudiante'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Defensa generada exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos o estudiantes no encontrados' })
    async crearDefensa(@Body() body: any) {
        const estudianteIds = Array.isArray(body.estudianteIds)
            ? body.estudianteIds.map(Number)
            : [Number(body.estudianteIds)];
        return this.defensaService.generarDefensa(estudianteIds, body);
    }
    
    @Post('/estudiantes-masivo')
    @ApiOperation({ 
        summary: 'Crear estudiantes masivamente', 
        description: 'Crea múltiples estudiantes a la vez mediante carga masiva de datos. Útil para importar estudiantes desde archivos Excel o CSV.' 
    })
    @ApiBody({ 
        description: 'Array de estudiantes a crear',
        examples: {
            ejemplo1: {
                value: [
                    {
                        registro: '2021001234',
                        nombre: 'Juan',
                        apellido: 'Pérez',
                        ci: '12345678',
                        carrera: 'Ingeniería de Sistemas'
                    },
                    {
                        registro: '2021001235',
                        nombre: 'María',
                        apellido: 'García',
                        ci: '87654321',
                        carrera: 'Ingeniería de Sistemas'
                    }
                ],
                summary: 'Ejemplo de carga masiva de estudiantes'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Estudiantes creados exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async createMasiveSudents(@Body() body: any) {
        return this.estudianteService.createEstudiantesMasivos(body);
    }




}
