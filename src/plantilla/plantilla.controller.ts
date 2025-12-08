import {PlantillaService} from './plantilla.service';
import { Controller, Post, Response, Get, Delete, UploadedFiles,  StreamableFile , UseInterceptors, Body, Param, Query, ParseIntPipe, UseGuards, Request, HttpException} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { multerConfig } from './multer.config';
import { Response as ExpressResponse } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';

@ApiTags('plantillas')
@Controller('plantilla-service')
export class PlantillaController{ 
    constructor(
        private plantillaservice: PlantillaService,
        @InjectQueue('fileQueue') private fileQueue: Queue
    ) {}
    @Post('plantilla')
    @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth('JWT-auth')
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ 
        summary: 'Subir plantilla de documento', 
        description: 'Sube una o varias plantillas de documentos (Word, Excel) al sistema. Las plantillas se procesan en cola y se asocian a un módulo específico. Máximo 10 archivos por petición.' 
    })
    @ApiBody({ 
        description: 'Archivos de plantilla y módulo asociado',
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Archivos de plantilla (Word .docx o Excel .xlsx)'
                },
                id_modulo: {
                    type: 'string',
                    description: 'ID del módulo al que pertenece la plantilla',
                    example: '1'
                }
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Plantilla(s) subida(s) exitosamente' })
    @ApiResponse({ status: 400, description: 'No se recibieron archivos o faltan datos requeridos' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async subirPlantilla(
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
        @Body('id_modulo') id_modulo: string,
    ): Promise<any> { 
        try {
            const id_usuario = Number(req.user.userId);
            if (!files || files.length === 0) {
                return {
                    success: false,
                    message: 'No se recibieron archivos',
                    files: []
                };
            }

            if (!id_usuario || !id_modulo) {
                return {
                    success: false,
                    message: 'Se requieren id_usuario e id_modulo',
                    data: null
                };
            }
            const userIdBigInt = BigInt(id_usuario);
            const moduleIdBigInt = BigInt(id_modulo);

            const result = await this.plantillaservice.PlantillasLoad(
                files, 
                this.fileQueue, 
                userIdBigInt, 
                moduleIdBigInt
            );
            
            return result;
        } catch(error) { 
            return {
                success: false,
                error: error.message || error,
                details: error.stack
            };
        }
    }

    @Get('usuario/:id_usuario')
    @ApiOperation({ 
        summary: 'Obtener plantillas por usuario', 
        description: 'Obtiene todas las plantillas asociadas a un usuario específico' 
    })
    @ApiParam({ name: 'id_usuario', description: 'ID del usuario', type: String, example: '1' })
    @ApiResponse({ status: 200, description: 'Lista de plantillas obtenida exitosamente' })
    @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
    async getPlantillasByUsuario(@Param('id_usuario') id_usuario: string): Promise<any> {
        try {
            const userIdBigInt = BigInt(id_usuario);
            const plantillas = await this.plantillaservice.getPlantillasByUsuario(userIdBigInt);
            
            return {
                success: true,
                message: 'Plantillas obtenidas correctamente',
                data: plantillas
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || error
            };
        }
    }

    @Get('modulo/:id_modulo')
    @ApiOperation({ 
        summary: 'Obtener plantillas por módulo', 
        description: 'Obtiene todas las plantillas asociadas a un módulo específico' 
    })
    @ApiParam({ name: 'id_modulo', description: 'ID del módulo', type: String, example: '1' })
    @ApiResponse({ status: 200, description: 'Lista de plantillas obtenida exitosamente' })
    @ApiResponse({ status: 404, description: 'Módulo no encontrado' })
    async getPlantillasByModulo(@Param('id_modulo') id_modulo: string): Promise<any> {
        try {
            const moduleIdBigInt = BigInt(id_modulo);
            const plantillas = await this.plantillaservice.getPlantillasByModulo(moduleIdBigInt);
            
            return {
                success: true,
                message: 'Plantillas obtenidas correctamente',
                data: plantillas
            };
        } catch (error) {   
            return {
                success: false,
                error: error.message || error
            };
        }
    }

    @Delete(':id_plantilla')
    @ApiOperation({ 
        summary: 'Eliminar plantilla', 
        description: 'Elimina una plantilla del sistema. Requiere el ID de la plantilla y el ID del usuario que la creó.' 
    })
    @ApiParam({ name: 'id_plantilla', description: 'ID de la plantilla a eliminar', type: String, example: '1' })
    @ApiBody({ 
        description: 'ID del usuario propietario',
        schema: {
            type: 'object',
            properties: {
                id_usuario: { type: 'string', example: '1' }
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Plantilla eliminada exitosamente' })
    @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
    async deletePlantilla(
        @Param('id_plantilla') id_plantilla: string,
        @Body('id_usuario') id_usuario: string
    ): Promise<any> {
        try {
            const plantillaIdBigInt = BigInt(id_plantilla);
            const userIdBigInt = BigInt(id_usuario);
            
            const result = await this.plantillaservice.deletePlantilla(plantillaIdBigInt, userIdBigInt);
            
            return {
                success: true,
                message: 'Plantilla eliminada correctamente',
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || error
            };
        }
    }
    @UseInterceptors(FilesInterceptor(''))
    @Post("/plantillas/user/:id_plantilla")
    @ApiOperation({ 
        summary: 'Generar documento desde plantilla', 
        description: 'Genera un documento (Word o Excel) a partir de una plantilla reemplazando los marcadores con datos del estudiante. El documento se descarga directamente.' 
    })
    @ApiParam({ name: 'id_plantilla', description: 'ID de la plantilla a usar', type: String, example: '1' })
    @ApiBody({ 
        description: 'Datos del estudiante para reemplazar en la plantilla',
        examples: {
            ejemplo1: {
                value: {
                    idEstudiante: 1,
                    nombre: 'Juan',
                    apellido: 'Pérez',
                    registro: '2021001234',
                    carrera: 'Ingeniería de Sistemas'
                },
                summary: 'Ejemplo de datos para generar documento'
            }
        }
    })
    @ApiResponse({ status: 200, description: 'Documento generado exitosamente (descarga directa)' })
    @ApiResponse({ status: 400, description: 'Error al generar el documento' })
    @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
    async plantillaUsuario(
        @Param('id_plantilla') id_plantilla: string,
        @Response() res: ExpressResponse,
        @Body() body: any
    ) {
        try {
            console.log(`🔄 Generando documento, plantilla ${id_plantilla}`);
            const [nombre_archivo, buffer] = await this.plantillaservice.paramsPlantillaEstudiante(
                Number(id_plantilla), 
                body
            );
            const ext = nombre_archivo.toLowerCase().endsWith('.docx') ? 'docx' : 'xlsx';
              res.setHeader(
              'Content-Type',
               ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${nombre_archivo}"`, 
      );

      res.setHeader('Content-Length', buffer.length.toString());
            res.end(buffer);

    } catch (error: any) {
            console.error('❌ Error generando documento:', error);
           res.status(400).json({
    success: false,
    error: error.message || 'Error al generar el documento',
    details: error.stack
});
        }
    }

    @Get("/plantillas/marcadores/:nombre_archivo")
    @ApiOperation({ 
        summary: 'Extraer marcadores de una plantilla', 
        description: 'Extrae todos los marcadores (variables) que contiene una plantilla. Útil para debugging y verificar qué datos se necesitan para generar el documento.' 
    })
    @ApiParam({ name: 'nombre_archivo', description: 'Nombre del archivo de la plantilla', type: String, example: 'plantilla.docx' })
    @ApiResponse({ status: 200, description: 'Marcadores extraídos exitosamente', 
        example: { success: true, marcadores: ['{nombre}', '{apellido}', '{registro}'], total: 3 }
    })
    async obtenerMarcadores(@Param('nombre_archivo') nombre_archivo: string) {
        try {
            const marcadores = await this.plantillaservice.extraerMarcadores(nombre_archivo);
            
            return {
                success: true,
                message: 'Marcadores extraídos correctamente',
                data: {
                    archivo: nombre_archivo,
                    marcadores: marcadores,
                    total: marcadores.length
                }
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Error al extraer marcadores'
            };
        }
    }
    @Get("/plantillas")
    @ApiOperation({ 
        summary: 'Obtener todas las plantillas', 
        description: 'Obtiene la lista completa de todas las plantillas disponibles en el sistema' 
    })
    @ApiResponse({ status: 200, description: 'Lista de plantillas obtenida exitosamente' })
    async obtenerPlantillas() { 
       try { 
            return  await this.plantillaservice.getPlantillasAll();
       }
       catch(error) { 
        return {'error': error}
       } 
    }
    @Get("/plantillas/areas/:idEstudiante")
    @ApiOperation({ 
        summary: 'Obtener áreas de estudio de un estudiante', 
        description: 'Obtiene las áreas de estudio asociadas a la carrera de un estudiante específico' 
    })
    @ApiParam({ name: 'idEstudiante', description: 'ID del estudiante', type: String, example: '1' })
    @ApiResponse({ status: 200, description: 'Áreas de estudio obtenidas exitosamente' })
    @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
    async obtenerAreas(@Param('idEstudiante') id_estudiante) {
        return await this.plantillaservice.getAreasEstudio(Number(id_estudiante))
    }
    @Get("/plantillas/estudiante/:idEstudiante") 
    @ApiOperation({ 
        summary: 'Obtener información completa de un estudiante', 
        description: 'Obtiene toda la información disponible de un estudiante. Útil para pre-llenar formularios o generar documentos con datos del estudiante.' 
    })
    @ApiParam({ name: 'idEstudiante', description: 'ID del estudiante', type: String, example: '1' })
    @ApiResponse({ status: 200, description: 'Información del estudiante obtenida exitosamente' })
    @ApiResponse({ status: 400, description: 'El parámetro debe ser un número' })
    @ApiResponse({ status: 404, description: 'Estudiante no encontrado' })
    async obtenerInformacionEstudiante(@Param("idEstudiante") id_estudiante ) { 
        console.log(id_estudiante);
        if (Number.isInteger(id_estudiante)) { 
            throw new HttpException("El parametro debe ser un numero", 400)
        }
        return await this.plantillaservice.getEstudiante(Number(id_estudiante));
    }
} 