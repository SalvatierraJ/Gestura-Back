import { CasosEstudioService } from './../casos-estudio/casos-estudio.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CarreraService } from 'src/carrera/carrera.service';
import { BadRequestException, Body, Controller, Get, Post, Put, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import {FilesInterceptor } from '@nestjs/platform-express';
import { FacultadService } from 'src/facultad/facultad.service';
import { CreateCarrera } from 'src/carrera/dto/create-carrera.dto';
import { AreaService } from 'src/area/area.service';

@Controller('case-study-management')
export class CaseStudyManagementController {
    constructor(
        private facultadService: FacultadService,
        private carreraService: CarreraService,
        private areaService: AreaService,
        private readonly CloudinaryService: CloudinaryService,
        private CasosEstudioService: CasosEstudioService
    ) { }


    @Get('/facultades')
    async getAllFacultades() {
        return this.facultadService.getAllFacultades();
    }
    // carrera Management
    @Get('/carreras/:page/:pageSize')
    async getAllCarreras(@Request() req) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.carreraService.getAllCarreras({ page, pageSize });
    }
    @Post('/crear-carrera')
    async createCarrera(@Body() body: CreateCarrera) {
        return this.carreraService.createCarrera(body);
    }
    @Put('/actualizar-carrera/:id')
    async updateCarrera(@Request() req, @Body() body: CreateCarrera) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateCarrera(id, body);
    }
    @Put('/actualizar-estado-carrera/:id')
    async updateEstadoCarrera(@Request() req, @Body() body: any) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateStateCarrera(id, body);
    }
    // Area Management
    @Get('/areas/:page/:pageSize')
    async getAllAreas(@Request() req) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.areaService.getAllAreas({ page, pageSize });
    }
    @Post('/crear-area')
    async createArea(@Body() body: any) {
        return this.areaService.createArea(body);
    }
    @Put('/actualizar-area/:id')
    async updateArea(@Request() req, @Body() body: any) {
        const id = BigInt(req.params.id);
        return this.areaService.updateArea(id, body);
    }
    @Put('/actualizar-estado-area/:id')
    async updateEstadoArea(@Request() req, @Body() body: any) {
        const id = BigInt(req.params.id);
        return this.areaService.updateStateArea(id, body);
    }

    //casos de estudio Management

    @Post('/crear-casos-estudio')
    @UseInterceptors(FilesInterceptor('files', 10, {
        fileFilter: (req, file, cb) => {
            const validMimeTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ];
            if (validMimeTypes.includes(file.mimetype)) {
                cb(null, true);
            } else {
                cb(
                    new BadRequestException('Solo se permiten archivos PDF y Word'),
                    false
                );
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async crearCasosEstudio(
        @UploadedFiles() files: Express.Multer.File[],
        @Body() body: any
    ) {

        const { id_area } = body;
        if (!id_area) throw new BadRequestException('id_area requerido');
        if (!files || !files.length) throw new BadRequestException('Debe subir al menos un archivo');
        

        const casosData = files.map((file, idx) => {
            const meta = Array.isArray(body.data) ? body.data[idx] : {};
            return {
                titulo: meta?.titulo,
                fecha_subida: meta?.fecha_subida,
                autor: meta?.autor,
                tema: meta?.tema ?? meta?.titulo,
                id_area: body.id_area,
                file,
            };
        });


        // Validar datos
        for (const caso of casosData) {
            if (!caso.titulo || !caso.fecha_subida || !caso.autor)
                throw new BadRequestException('Datos incompletos para al menos un archivo');
        }


        const resultados: any[] = [];
        for (const caso of casosData) {
            const uploadResult = await this.CloudinaryService.uploadFile(caso.file) as { secure_url: string };
            resultados.push(
                await this.CasosEstudioService.createCasoEstudio(
                    caso.titulo!,
                    caso.autor!,
                    caso.tema!,
                    new Date(caso.fecha_subida)!,
                    Number(caso.id_area)!,
                    uploadResult.secure_url!
                )
            );
        }

        return { message: 'Casos de estudio creados', casos: resultados };
    }

    @Get('/casos-estudio/:page/:pageSize')
    async getAllCasosEstudio(@Request() req) {
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.CasosEstudioService.getAllCasosEstudio({ page, pageSize });
    }


}
