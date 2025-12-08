import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TribunalDocenteService } from './../tribunal-docente/tribunal-docente.service';
import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('docentes')
@Controller('docentesmanagement')
export class DocentesmanagementController {

    constructor(
        private TribunalDocenteService: TribunalDocenteService
    ) { }
    @UseGuards(JwtAuthGuard)
    @Get('/docentes/:page/:pageSize')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de docentes paginada', 
        description: 'Obtiene una lista paginada de todos los docentes del tribunal. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Lista de docentes obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getAllDocentes(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.TribunalDocenteService.getTribunalesDocentes({ page, pageSize, user: user.userId });
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/docentes/:page/:pageSize/:word')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Buscar docentes por palabra clave', 
        description: 'Obtiene una lista paginada de docentes filtrados por una palabra clave. Busca en nombres, apellidos y otros campos. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'word', description: 'Palabra clave para buscar', type: String, example: 'Juan' })
    @ApiResponse({ status: 200, description: 'Lista de docentes filtrados obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getFiltredDocentes(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);
        return this.TribunalDocenteService.getTribunalesDocentesFiltred({ page, pageSize, user: user.userId, word });
    }

    @Post('/crear-docente')
    @ApiOperation({ 
        summary: 'Crear nuevo docente', 
        description: 'Crea un nuevo docente en el sistema de tribunales' 
    })
    @ApiBody({ 
        description: 'Datos del docente a crear',
        examples: {
            ejemplo1: {
                value: {
                    nombre: 'Juan',
                    apellido: 'Pérez',
                    ci: '12345678',
                    email: 'juan.perez@example.com',
                    telefono: '70012345'
                },
                summary: 'Ejemplo de creación de docente'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Docente creado exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async createDocente(@Body() body: any) {
        return this.TribunalDocenteService.createTribunalDocente(body);
    }
    
    @Put('/actualizar-docente/:id')
    @ApiOperation({ 
        summary: 'Actualizar docente', 
        description: 'Actualiza la información de un docente existente por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del docente a actualizar', type: Number, example: 1 })
    @ApiBody({ 
        description: 'Datos actualizados del docente',
        examples: {
            ejemplo1: {
                value: {
                    nombre: 'Juan Carlos',
                    apellido: 'Pérez García',
                    email: 'juan.perez.actualizado@example.com'
                },
                summary: 'Ejemplo de actualización de docente'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Docente actualizado exitosamente' })
    @ApiResponse({ status: 404, description: 'Docente no encontrado' })
    async updateDocente(@Request() req, @Body() body: any) {
        const id = Number(req.params.id);
        return this.TribunalDocenteService.updateTribunalDocente(id, body);
    }
    
    @Put('/tribunales/:id/estado-o-borrado')
    @ApiOperation({ 
        summary: 'Actualizar estado o eliminar tribunal docente', 
        description: 'Permite cambiar el estado activo/inactivo de un tribunal docente o eliminarlo. Solo se puede enviar "estado" o "delete", no ambos.' 
    })
    @ApiParam({ name: 'id', description: 'ID del tribunal docente', type: Number, example: 1 })
    @ApiBody({ 
        description: 'Acción a realizar',
        examples: {
            cambiarEstado: {
                value: { estado: false },
                summary: 'Desactivar tribunal'
            },
            eliminar: {
                value: { delete: true },
                summary: 'Eliminar tribunal'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Operación realizada exitosamente' })
    @ApiResponse({ status: 400, description: 'Debe enviar "estado" o "delete", no ambos' })
    @ApiResponse({ status: 404, description: 'Tribunal no encontrado' })
    async setEstadoOrDeleteTribunal(
        @Param('id') id: string,
        @Body() body: { estado?: boolean; delete?: boolean }
    ) {
        return this.TribunalDocenteService.updateStateOrDeleteTribunalDocente(Number(id), body);
    }

}
