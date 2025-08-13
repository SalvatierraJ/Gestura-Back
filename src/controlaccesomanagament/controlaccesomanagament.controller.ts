import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ModulosService } from 'src/modulos/modulos.service';
import { PermisosService } from 'src/permisos/permisos.service';
import { CreateRolDto } from 'src/rol/dto/CreateRolDto';
import { UpdateRolDto } from 'src/rol/dto/UpdateRolDto';
import { RolService } from 'src/rol/rol.service';

@Controller('controlaccesomanagament')
export class ControlaccesomanagamentController {

    constructor(
        private rolService: RolService,
        private permisosService: PermisosService,
        private moduloService: ModulosService
    ) { }


    @Post('/crear-Rol')
    createRol(@Body() dto: CreateRolDto) {
        return this.rolService.crearRol(dto);
    }


    @Put('/actualizar-Rol')
    updateRol(@Body() dto: UpdateRolDto) {
        return this.rolService.actualizarRol(dto);
    }


    @Delete('/eliminarRol/:id')
    deleteRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.eliminarRol(id);
    }
    @UseGuards(JwtAuthGuard)
    @Get('/roles')
    async getRoles(
        @Query('pagina') pagina: number = 1,
        @Query('limite') limite: number = 10,
        @Request() req
    ) {
        const user = req.user;
        return this.rolService.obtenerRolesPaginados(pagina, limite, user.userId);
    }

    @Get('/permisos')
    async getPermisos() {
        return this.permisosService.getAllPermisos();
    }

    @Get('/modulos')
    async getModulos() {
        return this.moduloService.getAllModulos();
    }


    @Delete('/eliminar/:id')
    async eliminarRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.eliminarRol(Number(id));
    }


    @Patch('/:id/restaurar')
    async restaurarRol(@Param('id', ParseIntPipe) id: number) {
        return this.rolService.restaurarRol(id);
    }


}
