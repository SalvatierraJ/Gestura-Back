import { CasosEstudioService } from './../casos-estudio/casos-estudio.service';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { CarreraService } from 'src/carrera/carrera.service';
import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Put, Request, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { FacultadService } from 'src/facultad/facultad.service';
import { CreateCarrera } from 'src/carrera/dto/create-carrera.dto';
import { AreaService } from 'src/area/area.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateCasoEstudioDto } from 'src/casos-estudio/dto/update-caso-estudio.dto';
import { UpdateCarreraStateDto } from 'src/carrera/dto/update-carrera-state.dto';
import { UpdateCasoStateOrDeleteDto } from 'src/casos-estudio/dto/update-caso-state-or-delete.dto';

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
    @UseGuards(JwtAuthGuard)
    @Get('/carreras/:page/:pageSize')
    async getAllCarreras(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.carreraService.getAllCarreras({ page, pageSize, user: user.userId });
    }
    @UseGuards(JwtAuthGuard)
    @Get('/carreras/:page/:pageSize/:word')
    async getCarrerasFilter(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);
        return this.carreraService.getCarrerasFiltred({ page, pageSize, user: user.userId, word: word });
    }
    @UseGuards(JwtAuthGuard)
    @Post('/crear-carrera')
    async createCarrera(@Body() body: CreateCarrera, @Request() req) {
        const user = req.user;
        return this.carreraService.createCarrera(body, user.userId);
    }
    @Put('/actualizar-carrera/:id')
    async updateCarrera(@Request() req, @Body() body: CreateCarrera) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateCarrera(id, body);
    }

    @Patch('/:id/state')
    async updateState(
        @Param('id') idParam: string,
        @Body() body: UpdateCarreraStateDto,
    ) {
        const id = BigInt(idParam);

        const hasDelete = typeof body.delete === 'boolean';
        const hasEstado = typeof body.estado === 'boolean';

        if (!hasDelete && !hasEstado) {
            throw new BadRequestException('Debes enviar "delete" o "estado".');
        }
        if (hasDelete && hasEstado) {
            throw new BadRequestException('No puedes enviar "delete" y "estado" a la vez.');
        }

        return this.carreraService.updateStateCarrera(id, body);
    }
    // Area Management
    @UseGuards(JwtAuthGuard)
    @Get('/areas/:page/:pageSize')
    async getAllAreas(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page) || 1;
        const pageSize = Number(req.params.pageSize) || 10;
        return this.areaService.getAllAreas({ page, pageSize, user: user.userId });
    }
    @UseGuards(JwtAuthGuard)
    @Get('/areas/:page/:pageSize/:word')
    async getFiltredAreas(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);
        return this.areaService.getFiltredAreas({ page, pageSize, user: user.userId, word });

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
    @Patch('/area/:id/state')
    async updateEstadoArea(
        @Param('id') idParam: string,
        @Body() body: { delete?: boolean; estado?: boolean }
    ) {
        const id = BigInt(idParam);
        const hasDelete = typeof body.delete === 'boolean';
        const hasEstado = typeof body.estado === 'boolean';

        if (!hasDelete && !hasEstado) {
            throw new BadRequestException('Debes enviar "delete" o "estado".');
        }
        if (hasDelete && hasEstado) {
            throw new BadRequestException('No puedes enviar "delete" y "estado" a la vez.');
        }

        return this.areaService.deleteAndRestoreArea(id, body);
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
    @UseGuards(JwtAuthGuard)
    @Get('/casos-estudio/:page/:pageSize')
    async getAllCasosEstudio(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.CasosEstudioService.getAllCasosEstudio({ page, pageSize, user: user.userId });
    }
    @UseGuards(JwtAuthGuard)
    @Get('/casos-estudio/:page/:pageSize/:word')
    async filtredCasosEstudio(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);

        return this.CasosEstudioService.getfiltredCasosEstudio({ page, pageSize, user: user.userId, word });
    }


    @Put('/actualizar-estado-caso/:id')
    async updateEstadoOBorradoCaso(
        @Param('id') idParam: string,
        @Body() body: UpdateCasoStateOrDeleteDto,
    ) {
        const id = BigInt(idParam);
        return this.CasosEstudioService.updateStateOrDeleteCasoEstudio(id, body);
    }

     @Put("/casos/:id")
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FilesInterceptor('file', 1, {
      fileFilter: (req, file, cb) => {
        if (file) {
          const validMimeTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ];
          if (!validMimeTypes.includes(file.mimetype)) {
              cb(
                  new BadRequestException('Solo se permiten archivos PDF y Word'),
                  false
              );
          }
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 },
    }))
    async updateCasoEstudio(
        @Request() req,
        @Param('id') idParam: Number,
        @Body() dto: UpdateCasoEstudioDto,
        @UploadedFiles() files: Express.Multer.File[]
    ) {
        const id = Number(idParam);
        const userId = BigInt(req.user.userId);
        const file = files && files.length > 0 ? files[0] : undefined;
        
        // Llama al servicio unificado con los metadatos y el archivo opcional
        return this.CasosEstudioService.updateCasoEstudio(id, userId, dto, file);
    }
}
