import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DefensaService } from 'src/defensa/defensa.service';
import { JuradosService } from 'src/jurados/jurados.service';

@Controller('defensasmanagament')
export class DefensasmanagamentController {
    constructor(private defensaService: DefensaService, private juradoService: JuradosService) { }

    @UseGuards(JwtAuthGuard)
    @Get('/detalles/:page/:pageSize/:tipoDefensa')
    async getDefensasDetallePaginado(
        @Request() req?: any
    ) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const tipoDefensa = String(req.params.tipoDefensa);
        const user = req.user;
        return this.defensaService.getAllDefensasDetalle({
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
            tipoDefensaNombre: tipoDefensa,
            user: user.userId
        });
    }

    @Post('/asignar-jurados-lote')
    async asignarJuradosLote(@Body() body: any) {
        return this.juradoService.asignarJurados(body);
    }

    @Get('/jurados-sugeridos')
    async getJuradosSugeridos() {
        return this.juradoService.getJuradosConSugerencia();
    }

    @Post('/actualizar-jurados')
    async actualizarJurados(@Body() body: { defensaId: number; juradoIds: number[] }) {
        if (!body.defensaId || !body.juradoIds || !Array.isArray(body.juradoIds)) {
            throw new Error("Debe enviar defensaId y un array de juradoIds");
        }
        return this.juradoService.actualizarJurados({
            defensaId: body.defensaId,
            juradoIds: body.juradoIds,
        });
    }

    @Post("/nota/:id_defensa")
    async setNota(@Param("id_defensa") id_defensa: number, @Body() body: { nota: number }) {
        return this.defensaService.agregarNotaDefensa(id_defensa, body.nota);
    }

    @Post("/aula/:id_defensa")
    async setAula(@Param("id_defensa") id_defensa: number, @Body() body: { aula: string }) {
        return this.defensaService.agregarAulaDefensa(id_defensa, body.aula);
    }


}
