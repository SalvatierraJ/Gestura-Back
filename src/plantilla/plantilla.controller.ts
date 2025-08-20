import {PlantillaService} from './plantilla.service';
import { Controller, Post, Response, Get, Delete, UploadedFiles,  StreamableFile , UseInterceptors, Body, Param, Query, ParseIntPipe, UseGuards, Request, HttpException} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { multerConfig } from './multer.config';
import { Response as ExpressResponse } from 'express';
@Controller('plantilla-service')
export class PlantillaController{ 
    constructor(
        private plantillaservice: PlantillaService,
        @InjectQueue('fileQueue') private fileQueue: Queue
    ) {}
    //Subida de plantilla
    @Post('plantilla')
    @UseInterceptors(FilesInterceptor('files', 10, multerConfig))
     @UseGuards(JwtAuthGuard)
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

    // Endpoint para extraer marcadores de una plantilla (útil para debugging)
    @Get("/plantillas/marcadores/:nombre_archivo")
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
    //Endpoint para obtener todas las plantillas
    @Get("/plantillas")
    async obtenerPlantillas() { 
       try { 
            return  await this.plantillaservice.getPlantillasAll();
       }
       catch(error) { 
        return {'error': error}
       } 
    }
    //Obtener areas de una carrera
    @Get("/plantillas/areas/:idEstudiante")
    async obtenerAreas(@Param('idEstudiante') id_estudiante) {
        return await this.plantillaservice.getAreasEstudio(Number(id_estudiante))
    }
    //Obtener informacion del estudiante
    @Get("/plantillas/estudiante/:idEstudiante") 
    async obtenerInformacionEstudiante(@Param("idEstudiante") id_estudiante ) { 
        console.log(id_estudiante);
        if (Number.isInteger(id_estudiante)) { 
            throw new HttpException("El parametro debe ser un numero", 400)
        }
        return await this.plantillaservice.getEstudiante(Number(id_estudiante));
    }
} 