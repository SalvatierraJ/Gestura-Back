import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { DefensaService } from 'src/defensa/defensa.service';
import { JuradosService } from 'src/jurados/jurados.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('defensas')
@Controller('defensasmanagament')
export class DefensasmanagamentController {
    constructor(private defensaService: DefensaService, private juradoService: JuradosService) { }

    @UseGuards(JwtAuthGuard)
    @Get('/detalles/:page/:pageSize/:tipoDefensa')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener detalles de defensas paginadas por tipo', 
        description: 'Obtiene una lista paginada de defensas con todos sus detalles filtradas por tipo de defensa. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'tipoDefensa', description: 'Tipo de defensa (ej: Tesis, Proyecto de Grado)', type: String, example: 'Tesis' })
    @ApiResponse({ status: 200, description: 'Lista de defensas obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
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


    @UseGuards(JwtAuthGuard)
    @Get('/detalles/:page/:pageSize/:tipoDefensa/:word')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Buscar defensas por palabra clave', 
        description: 'Obtiene una lista paginada de defensas filtradas por tipo y palabra clave. Busca en nombres de estudiantes, títulos, etc. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'tipoDefensa', description: 'Tipo de defensa', type: String, example: 'Tesis' })
    @ApiParam({ name: 'word', description: 'Palabra clave para buscar', type: String, example: 'Juan' })
    @ApiResponse({ status: 200, description: 'Lista de defensas filtradas obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getDefensasDetallePaginadoFiltred(
        @Request() req?: any
    ) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const tipoDefensa = String(req.params.tipoDefensa);
        const user = req.user;
        const word = String(req.params?.word)
        return this.defensaService.getDefensasFiltradas({
            page: Number(page) || 1,
            pageSize: Number(pageSize) || 10,
            tipoDefensaNombre: tipoDefensa,
            user: user.userId,
            word
        });
    }
    
    @Post('/asignar-jurados-lote')
    @ApiOperation({ 
        summary: 'Asignar jurados en lote', 
        description: 'Asigna jurados a múltiples defensas de manera masiva. Útil para asignar jurados a varias defensas a la vez.' 
    })
    @ApiBody({ 
        description: 'Datos de asignación de jurados',
        examples: {
            ejemplo1: {
                value: {
                    defensas: [
                        { defensaId: 1, juradoIds: [1, 2, 3] },
                        { defensaId: 2, juradoIds: [2, 3, 4] }
                    ]
                },
                summary: 'Ejemplo de asignación masiva de jurados'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Jurados asignados exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async asignarJuradosLote(@Body() body: any) {
        return this.juradoService.asignarJurados(body);
    }

    @Get('/jurados-sugeridos')
    @ApiOperation({ 
        summary: 'Obtener jurados sugeridos', 
        description: 'Obtiene una lista de jurados sugeridos basada en criterios como especialidad, disponibilidad, etc.' 
    })
    @ApiResponse({ status: 200, description: 'Lista de jurados sugeridos obtenida exitosamente' })
    async getJuradosSugeridos() {
        return this.juradoService.getJuradosConSugerencia();
    }

    @Post('/actualizar-jurados')
    @ApiOperation({ 
        summary: 'Actualizar jurados de una defensa', 
        description: 'Actualiza los jurados asignados a una defensa específica. Reemplaza los jurados actuales con los nuevos proporcionados.' 
    })
    @ApiBody({ 
        description: 'Datos de actualización de jurados',
        examples: {
            ejemplo1: {
                value: {
                    defensaId: 1,
                    juradoIds: [1, 2, 3]
                },
                summary: 'Ejemplo de actualización de jurados'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Jurados actualizados exitosamente' })
    @ApiResponse({ status: 400, description: 'Debe enviar defensaId y un array de juradoIds' })
    @ApiResponse({ status: 404, description: 'Defensa no encontrada' })
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
    @ApiOperation({ 
        summary: 'Asignar nota a una defensa', 
        description: 'Asigna o actualiza la nota obtenida por el estudiante en su defensa' 
    })
    @ApiParam({ name: 'id_defensa', description: 'ID de la defensa', type: Number, example: 1 })
    @ApiBody({ 
        description: 'Nota a asignar',
        examples: {
            ejemplo1: {
                value: { nota: 85 },
                summary: 'Asignar nota 85'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Nota asignada exitosamente' })
    @ApiResponse({ status: 404, description: 'Defensa no encontrada' })
    async setNota(@Param("id_defensa") id_defensa: number, @Body() body: { nota: number }) {
        return this.defensaService.agregarNotaDefensa(id_defensa, body.nota);
    }

    @Post("/aula/:id_defensa")
    @ApiOperation({ 
        summary: 'Asignar aula a una defensa', 
        description: 'Asigna o actualiza el aula donde se realizará la defensa' 
    })
    @ApiParam({ name: 'id_defensa', description: 'ID de la defensa', type: Number, example: 1 })
    @ApiBody({ 
        description: 'Aula a asignar',
        examples: {
            ejemplo1: {
                value: { aula: 'Aula 101' },
                summary: 'Asignar aula 101'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Aula asignada exitosamente' })
    @ApiResponse({ status: 404, description: 'Defensa no encontrada' })
    async setAula(@Param("id_defensa") id_defensa: number, @Body() body: { aula: string }) {
        return this.defensaService.agregarAulaDefensa(id_defensa, body.aula);
    }

    @Delete(':id')
    @ApiOperation({ 
        summary: 'Eliminar defensa', 
        description: 'Elimina una defensa del sistema. Por defecto hace soft delete, pero puede forzar eliminación permanente con el parámetro force=false.' 
    })
    @ApiParam({ name: 'id', description: 'ID de la defensa a eliminar', type: String, example: '1' })
    @ApiQuery({ name: 'force', required: false, type: String, description: 'Si es "false", fuerza eliminación permanente', example: 'false' })
    @ApiResponse({ status: 200, description: 'Defensa eliminada exitosamente' })
    @ApiResponse({ status: 404, description: 'Defensa no encontrada' })
    async remove(
        @Param('id') id: string,
        @Query('force') force?: string,
    ) {
        return this.defensaService.eliminarDefensa(id, { force: force === 'false' });
    }


    @Post('/enviar-notificacion-email-ultima-defensa')
    @ApiOperation({ 
        summary: 'Enviar notificación por email de última defensa', 
        description: 'Envía por correo electrónico la notificación de la última defensa programada para uno o varios estudiantes. El email incluye detalles como fecha, hora, aula, tipo de defensa, etc.' 
    })
    @ApiBody({ 
        description: 'IDs de estudiantes para enviar notificación',
        examples: {
            ejemplo1: {
                value: { estudiantes: 1449 },
                summary: 'Enviar a un estudiante'
            },
            ejemplo2: {
                value: { estudiantes: [1449, 1450, 1451] },
                summary: 'Enviar a múltiples estudiantes'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Notificaciones enviadas. Devuelve array con resultados por estudiante.', 
        example: [
            { idEstudiante: 1449, enviado: true, datos: { fecha: '2024-12-15', aula: 'Aula 101' } },
            { idEstudiante: 1450, enviado: false, error: 'No se encontró defensa' }
        ]
    })
    @ApiResponse({ status: 400, description: 'Debe enviar en el body la propiedad "estudiantes" como number o number[]' })
    async enviarNotificacionEmailUltimaDefensa(@Body() body: { estudiantes?: number[] | number }) {
        // Validar que el body y la propiedad estudiantes existan
        if (!body || body.estudiantes === undefined || body.estudiantes === null) {
            // Usamos BadRequestException para respuestas HTTP 400
            const { BadRequestException } = await import('@nestjs/common');
            throw new BadRequestException('Debe enviar en el body la propiedad "estudiantes" como number o number[]');
        }

        const estudiantesIds = Array.isArray(body.estudiantes) ? body.estudiantes : [body.estudiantes];
        const resultados: { idEstudiante: number | any; enviado: boolean; datos?: any; error?: string }[] = [];

        for (const rawId of estudiantesIds) {
            // validar que cada id sea un número válido
            const idEstudiante = Number(rawId);
            if (!Number.isFinite(idEstudiante) || Number.isNaN(idEstudiante)) {
                resultados.push({ idEstudiante: rawId, enviado: false, error: 'id de estudiante inválido' });
                continue;
            }

            try {
                // Reutiliza el método de preview para obtener la defensa
                const preview = await this.defensaService.previewNotificacionEmailUltimaDefensa(idEstudiante);
                const info = Array.isArray(preview) ? preview[0] : preview;
                if (info && !info.error) {
                    const datos = {
                        area: info.area,
                        caso: info.caso,
                        fecha: info.fecha,
                        tipo_defensa: info.tipo_defensa,
                        estado: info.estado
                    };
                    await this.defensaService.enviarNotificacionEmailDefensa(idEstudiante, datos);
                    resultados.push({ idEstudiante, enviado: true, datos });
                } else {
                    resultados.push({ idEstudiante, enviado: false, error: info?.error || 'No se encontró defensa' });
                }
            } catch (err: any) {
                // Capturamos errores por estudiante para no fallar todo el batch
                resultados.push({ idEstudiante, enviado: false, error: err?.message || 'Error al procesar estudiante' });
            }
        }

        return resultados;
    }

    @Post('/enviar-mensaje-whatsapp-masivo')
    @ApiOperation({ 
        summary: 'Enviar mensaje de WhatsApp masivo', 
        description: 'Envía un mensaje personalizado de WhatsApp a múltiples estudiantes usando sus números de registro. El mensaje puede incluir variables dinámicas como nombre, fecha de defensa, etc.' 
    })
    @ApiBody({ 
        description: 'Datos para envío masivo de WhatsApp',
        examples: {
            ejemplo1: {
                value: {
                    registros: ['2021001234', '2021001235', '2021001236'],
                    mensaje: 'Estimado/a {nombre}, su defensa está programada para el {fecha} a las {hora} en el {aula}.'
                },
                summary: 'Ejemplo de envío masivo de WhatsApp'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Mensajes enviados exitosamente' })
    @ApiResponse({ status: 400, description: 'Debe proporcionar un array de números de registro y un mensaje' })
    async enviarMensajeWhatsAppMasivo(@Body() body: { registros: string[], mensaje: string }) {
        if (!body.registros || !Array.isArray(body.registros) || body.registros.length === 0) {
            throw new Error('Debe proporcionar un array de números de registro de estudiantes');
        }
        if (!body.mensaje || body.mensaje.trim() === '') {
            throw new Error('Debe proporcionar un mensaje personalizado');
        }

        return this.defensaService.enviarMensajeWhatsAppMasivoPorRegistro(body.registros, body.mensaje);
    }

    @Get('/estado-whatsapp')
    @ApiOperation({ 
        summary: 'Verificar estado de WhatsApp', 
        description: 'Verifica el estado actual de la conexión de WhatsApp para envío de mensajes. Útil para saber si el servicio está disponible.' 
    })
    @ApiResponse({ status: 200, description: 'Estado de WhatsApp obtenido exitosamente', 
        example: { conectado: true, estado: 'ready', mensaje: 'WhatsApp listo para enviar mensajes' }
    })
    async getEstadoWhatsApp() {
        return this.defensaService.getEstadoWhatsApp();
    }

}
