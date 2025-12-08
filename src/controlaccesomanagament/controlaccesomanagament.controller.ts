import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ModulosService } from 'src/modulos/modulos.service';
import { PermisosService } from 'src/permisos/permisos.service';
import { CreateRolDto } from 'src/rol/dto/CreateRolDto';
import { UpdateRolDto } from 'src/rol/dto/UpdateRolDto';
import { RolService } from 'src/rol/rol.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('control-acceso')
@Controller('controlaccesomanagament')
export class ControlaccesomanagamentController {

    constructor(
        private rolService: RolService,
        private permisosService: PermisosService,
        private moduloService: ModulosService
    ) { }


    @Post('/crear-Rol')
    @ApiOperation({ 
        summary: 'Crear nuevo rol', 
        description: 'Crea un nuevo rol en el sistema con permisos y módulos asociados. Los roles definen qué acciones puede realizar un usuario en el sistema.' 
    })
    @ApiBody({ 
        type: CreateRolDto,
        description: 'Datos del rol a crear',
        examples: {
            ejemplo1: {
                value: {
                    nombre: 'Administrador',
                    carreras: [1, 2],
                    modulosPermisos: [
                        { idModulo: 1, permisos: [1, 2, 3] },
                        { idModulo: 2, permisos: [1, 2] }
                    ],
                    esTotal: false
                },
                summary: 'Ejemplo de creación de rol'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Rol creado exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    createRol(@Body() dto: CreateRolDto) {
        return this.rolService.crearRol(dto);
    }


    @Put('/actualizar-Rol')
    @ApiOperation({ 
        summary: 'Actualizar rol existente', 
        description: 'Actualiza la información de un rol existente, incluyendo sus permisos y módulos asociados' 
    })
    @ApiBody({ 
        type: UpdateRolDto,
        description: 'Datos actualizados del rol',
        examples: {
            ejemplo1: {
                value: {
                    id: 1,
                    nombre: 'Administrador Actualizado',
                    carreras: [1, 2, 3],
                    modulosPermisos: [
                        { idModulo: 1, permisos: [1, 2, 3, 4] }
                    ]
                },
                summary: 'Ejemplo de actualización de rol'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Rol actualizado exitosamente' })
    @ApiResponse({ status: 404, description: 'Rol no encontrado' })
    updateRol(@Body() dto: UpdateRolDto) {
        return this.rolService.actualizarRol(dto);
    }


    @Delete('/eliminarRol/:id')
    @ApiOperation({ 
        summary: 'Eliminar rol', 
        description: 'Elimina un rol del sistema por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del rol a eliminar', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Rol eliminado exitosamente' })
    @ApiResponse({ status: 404, description: 'Rol no encontrado' })
    deleteRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.eliminarRol(id);
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/roles')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de roles paginada', 
        description: 'Obtiene una lista paginada de todos los roles del sistema. Requiere autenticación JWT.' 
    })
    @ApiQuery({ name: 'pagina', required: false, type: Number, description: 'Número de página', example: 1 })
    @ApiQuery({ name: 'limite', required: false, type: Number, description: 'Cantidad de elementos por página', example: 10 })
    @ApiResponse({ status: 200, description: 'Lista de roles obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getRoles(
        @Query('pagina') pagina: number = 1,
        @Query('limite') limite: number = 10,
        @Request() req
    ) {
        const user = req.user;
        return this.rolService.obtenerRolesPaginados(pagina, limite, user.userId);
    }

    @Get('/permisos')
    @ApiOperation({ 
        summary: 'Obtener todos los permisos', 
        description: 'Obtiene la lista completa de todos los permisos disponibles en el sistema' 
    })
    @ApiResponse({ status: 200, description: 'Lista de permisos obtenida exitosamente' })
    async getPermisos() {
        return this.permisosService.getAllPermisos();
    }

    @Get('/modulos')
    @ApiOperation({ 
        summary: 'Obtener todos los módulos', 
        description: 'Obtiene la lista completa de todos los módulos disponibles en el sistema' 
    })
    @ApiResponse({ status: 200, description: 'Lista de módulos obtenida exitosamente' })
    async getModulos() {
        return this.moduloService.getAllModulos();
    }


    @Delete('/eliminar/:id')
    @ApiOperation({ 
        summary: 'Eliminar rol (alternativo)', 
        description: 'Endpoint alternativo para eliminar un rol por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del rol a eliminar', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Rol eliminado exitosamente' })
    @ApiResponse({ status: 404, description: 'Rol no encontrado' })
    async eliminarRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.eliminarRol(Number(id));
    }


    @Patch('/:id/restaurar')
    @ApiOperation({ 
        summary: 'Restaurar rol eliminado', 
        description: 'Restaura un rol que fue eliminado previamente' 
    })
    @ApiParam({ name: 'id', description: 'ID del rol a restaurar', type: Number, example: 1 })
    @ApiResponse({ status: 200, description: 'Rol restaurado exitosamente' })
    @ApiResponse({ status: 404, description: 'Rol no encontrado' })
    async restaurarRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.restaurarRol(id);
    }


}
