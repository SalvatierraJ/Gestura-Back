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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('casos-estudio')
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
    @ApiOperation({ 
        summary: 'Obtener todas las facultades', 
        description: 'Obtiene la lista completa de todas las facultades disponibles en el sistema' 
    })
    @ApiResponse({ status: 200, description: 'Lista de facultades obtenida exitosamente' })
    async getAllFacultades() {
        return this.facultadService.getAllFacultades();
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/carreras/:page/:pageSize')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de carreras paginada', 
        description: 'Obtiene una lista paginada de todas las carreras. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Lista de carreras obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getAllCarreras(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.carreraService.getAllCarreras({ page, pageSize, user: user.userId });
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/carreras/:page/:pageSize/:word')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Buscar carreras por palabra clave', 
        description: 'Obtiene una lista paginada de carreras filtradas por una palabra clave. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'word', description: 'Palabra clave para buscar', type: String, example: 'Sistemas' })
    @ApiResponse({ status: 200, description: 'Lista de carreras filtradas obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getCarrerasFilter(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);
        return this.carreraService.getCarrerasFiltred({ page, pageSize, user: user.userId, word: word });
    }
    
    @UseGuards(JwtAuthGuard)
    @Post('/crear-carrera')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Crear nueva carrera', 
        description: 'Crea una nueva carrera en el sistema asociada a una facultad. Requiere autenticación JWT.' 
    })
    @ApiBody({ 
        type: CreateCarrera,
        description: 'Datos de la carrera a crear',
        examples: {
            ejemplo1: {
                value: {
                    nombre_carrera: 'Ingeniería de Sistemas',
                    id_facultad: '1'
                },
                summary: 'Ejemplo de creación de carrera'
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Carrera creada exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async createCarrera(@Body() body: CreateCarrera, @Request() req) {
        const user = req.user;
        return this.carreraService.createCarrera(body, user.userId);
    }
    @Put('/actualizar-carrera/:id')
    @ApiOperation({ 
        summary: 'Actualizar carrera', 
        description: 'Actualiza la información de una carrera existente por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID de la carrera a actualizar', type: String, example: '1' })
    @ApiBody({ type: CreateCarrera, description: 'Datos actualizados de la carrera' })
    @ApiResponse({ status: 200, description: 'Carrera actualizada exitosamente' })
    @ApiResponse({ status: 404, description: 'Carrera no encontrada' })
    async updateCarrera(@Request() req, @Body() body: CreateCarrera) {
        const id = BigInt(req.params.id);
        return this.carreraService.updateCarrera(id, body);
    }

    @Patch('/:id/state')
    @ApiOperation({ 
        summary: 'Actualizar estado o eliminar carrera', 
        description: 'Permite cambiar el estado activo/inactivo de una carrera o eliminarla. Solo se puede enviar "estado" o "delete", no ambos.' 
    })
    @ApiParam({ name: 'id', description: 'ID de la carrera', type: String, example: '1' })
    @ApiBody({ type: UpdateCarreraStateDto, description: 'Acción a realizar' })
    @ApiResponse({ status: 200, description: 'Operación realizada exitosamente' })
    @ApiResponse({ status: 400, description: 'Debes enviar "delete" o "estado", no ambos' })
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
    @UseGuards(JwtAuthGuard)
    @Get('/areas/:page/:pageSize')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de áreas paginada', 
        description: 'Obtiene una lista paginada de todas las áreas de estudio. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Lista de áreas obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getAllAreas(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page) || 1;
        const pageSize = Number(req.params.pageSize) || 10;
        return this.areaService.getAllAreas({ page, pageSize, user: user.userId });
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/areas/:page/:pageSize/:word')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Buscar áreas por palabra clave', 
        description: 'Obtiene una lista paginada de áreas filtradas por una palabra clave. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'word', description: 'Palabra clave para buscar', type: String, example: 'Sistemas' })
    @ApiResponse({ status: 200, description: 'Lista de áreas filtradas obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getFiltredAreas(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);
        return this.areaService.getFiltredAreas({ page, pageSize, user: user.userId, word });

    }

    @Post('/crear-area')
    @ApiOperation({ 
        summary: 'Crear nueva área de estudio', 
        description: 'Crea una nueva área de estudio en el sistema' 
    })
    @ApiBody({ description: 'Datos del área a crear', examples: { ejemplo1: { value: { nombre: 'Sistemas Distribuidos', id_carrera: 1 }, summary: 'Ejemplo de creación de área' } } })
    @ApiResponse({ status: 201, description: 'Área creada exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos inválidos' })
    async createArea(@Body() body: any) {
        return this.areaService.createArea(body);
    }
    
    @Put('/actualizar-area/:id')
    @ApiOperation({ 
        summary: 'Actualizar área de estudio', 
        description: 'Actualiza la información de un área existente por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del área a actualizar', type: String, example: '1' })
    @ApiBody({ description: 'Datos actualizados del área' })
    @ApiResponse({ status: 200, description: 'Área actualizada exitosamente' })
    @ApiResponse({ status: 404, description: 'Área no encontrada' })
    async updateArea(@Request() req, @Body() body: any) {
        const id = BigInt(req.params.id);
        return this.areaService.updateArea(id, body);
    }
    
    @Patch('/area/:id/state')
    @ApiOperation({ 
        summary: 'Actualizar estado o eliminar área', 
        description: 'Permite cambiar el estado activo/inactivo de un área o eliminarla. Solo se puede enviar "estado" o "delete", no ambos.' 
    })
    @ApiParam({ name: 'id', description: 'ID del área', type: String, example: '1' })
    @ApiBody({ description: 'Acción a realizar', examples: { cambiarEstado: { value: { estado: false }, summary: 'Desactivar área' }, eliminar: { value: { delete: true }, summary: 'Eliminar área' } } })
    @ApiResponse({ status: 200, description: 'Operación realizada exitosamente' })
    @ApiResponse({ status: 400, description: 'Debes enviar "delete" o "estado", no ambos' })
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
    @ApiConsumes('multipart/form-data')
    @ApiOperation({ 
        summary: 'Crear casos de estudio', 
        description: 'Crea uno o varios casos de estudio subiendo archivos PDF o Word. Cada archivo debe tener metadatos (título, autor, fecha_subida). Máximo 10 archivos por petición, 10MB por archivo.' 
    })
    @ApiBody({ 
        description: 'Archivos y metadatos de casos de estudio',
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                    description: 'Archivos PDF o Word de casos de estudio'
                },
                id_area: { type: 'string', description: 'ID del área de estudio', example: '1' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            titulo: { type: 'string', example: 'Sistema de Gestión' },
                            autor: { type: 'string', example: 'Juan Pérez' },
                            fecha_subida: { type: 'string', example: '2024-01-15' },
                            tema: { type: 'string', example: 'Sistemas de Información' }
                        }
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 201, description: 'Casos de estudio creados exitosamente' })
    @ApiResponse({ status: 400, description: 'Datos incompletos o archivos inválidos' })
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
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Obtener lista de casos de estudio paginada', 
        description: 'Obtiene una lista paginada de todos los casos de estudio. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiResponse({ status: 200, description: 'Lista de casos de estudio obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async getAllCasosEstudio(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.CasosEstudioService.getAllCasosEstudio({ page, pageSize, user: user.userId });
    }
    
    @UseGuards(JwtAuthGuard)
    @Get('/casos-estudio/:page/:pageSize/:word')
    @ApiBearerAuth('JWT-auth')
    @ApiOperation({ 
        summary: 'Buscar casos de estudio por palabra clave', 
        description: 'Obtiene una lista paginada de casos de estudio filtrados por una palabra clave. Requiere autenticación JWT.' 
    })
    @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
    @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
    @ApiParam({ name: 'word', description: 'Palabra clave para buscar', type: String, example: 'Sistemas' })
    @ApiResponse({ status: 200, description: 'Lista de casos de estudio filtrados obtenida exitosamente' })
    @ApiResponse({ status: 401, description: 'No autorizado' })
    async filtredCasosEstudio(@Request() req) {
        const user = req.user;
        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        const word = String(req.params.word);

        return this.CasosEstudioService.getfiltredCasosEstudio({ page, pageSize, user: user.userId, word });
    }


    @Put('/actualizar-estado-caso/:id')
    @ApiOperation({ 
        summary: 'Actualizar estado o eliminar caso de estudio', 
        description: 'Permite cambiar el estado activo/inactivo de un caso de estudio o eliminarlo.' 
    })
    @ApiParam({ name: 'id', description: 'ID del caso de estudio', type: String, example: '1' })
    @ApiBody({ type: UpdateCasoStateOrDeleteDto, description: 'Acción a realizar' })
    @ApiResponse({ status: 200, description: 'Operación realizada exitosamente' })
    @ApiResponse({ status: 404, description: 'Caso de estudio no encontrado' })
    async updateEstadoOBorradoCaso(
        @Param('id') idParam: string,
        @Body() body: UpdateCasoStateOrDeleteDto,
    ) {
        const id = BigInt(idParam);
        return this.CasosEstudioService.updateStateOrDeleteCasoEstudio(id, body);
    }

    @Put("/casos/:id")
    @ApiOperation({ 
        summary: 'Actualizar caso de estudio', 
        description: 'Actualiza la información de un caso de estudio existente por su ID' 
    })
    @ApiParam({ name: 'id', description: 'ID del caso de estudio a actualizar', type: Number, example: 1 })
    @ApiBody({ type: UpdateCasoEstudioDto, description: 'Datos actualizados del caso de estudio' })
    @ApiResponse({ status: 200, description: 'Caso de estudio actualizado exitosamente' })
    @ApiResponse({ status: 404, description: 'Caso de estudio no encontrado' })
    async updateCasoEstudio(
        @Request() req,
        @Body() dto: UpdateCasoEstudioDto
    ) {
        const id = Number(req.params.id);
        return this.CasosEstudioService.updateCasoEstudio(id, dto);
    }


}
