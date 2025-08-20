import {Injectable, Res, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Queue } from 'bull';
import { PrismaService } from '../database/prisma.services';
import { CreatePlantillaDto, PlantillasUploadResponseDto } from './dto/plantilla.dto';
import PizZip = require('pizzip');
import Docxtemplater from 'docxtemplater';
import * as ExcelJS from 'exceljs';
import * as XLSX from 'xlsx'; 
import * as path from 'path';
import * as fs from 'fs';import { contains } from 'class-validator';
    @Injectable()
    export class PlantillaService {
        constructor(private prisma: PrismaService) {}

        async PlantillasLoad(
            files: Array<Express.Multer.File>, 
            fileQueue: Queue, 
            id_usuario: bigint, 
            id_modulo: bigint
        ): Promise<PlantillasUploadResponseDto> {
            if (!files || !Array.isArray(files) || files.length === 0) {
                throw new Error('No se proporcionaron archivos válidos');
            }

            if (!id_usuario || !id_modulo) {
                throw new Error('Se requieren id_usuario e id_modulo');
            }

            const uuids: string[] = [];
            const plantillasCreadas: any[] = [];
            
            for (const file of files) {
                const fileUUID = uuidv4();
                uuids.push(fileUUID);

                try {
                    const plantillaCreada = await this.prisma.$executeRaw`
                        INSERT INTO plantillas (nombre_archivo, ruta_archivo, id_usuario, id_modulo, created_at, updated_at)
                        VALUES (${file.originalname}, ${file.path}, ${id_usuario}, ${id_modulo}, NOW(), NOW())
                        RETURNING *
                    `;
                    
                    plantillasCreadas.push({
                        nombre_archivo: file.originalname,
                        ruta_archivo: file.path,
                        id_usuario,
                        id_modulo
                    });
                    
                    console.log(`✅ Plantilla guardada en BD: ${file.originalname}`);
                } catch (error: any) {
                    console.error(`❌ Error al guardar plantilla en BD: ${file.originalname}`, error);
                    throw new Error(`Error al guardar plantilla: ${file.originalname} - ${error.message}`);
                }
            }

            const jobs = files.map((file, index) => {
                return fileQueue.add('process_file', { 
                    path: file.path, 
                    uuid: uuids[index],
                    original_name: file.originalname
                });
            });

            const jobResults = await Promise.all(jobs);
            
            return {
                success: true,
                message: `${plantillasCreadas.length} plantillas guardadas correctamente`,
                plantillas: plantillasCreadas,
                jobs: jobResults,
                uuids: uuids
            };
        }

        async paramsPlantillaEstudiante(
            id_plantilla: number, 
            parametrosPersonalizados: Record<string, any>
        ): Promise<[string, Buffer]> {
            console.log(`🔍 Buscando plantilla con ID: ${id_plantilla}`);
            
            // ✅ Buscar la plantilla en la base de datos
            const plantilla = await this.getPlantillaById(BigInt(id_plantilla));
            
            if (!plantilla) {
                throw new NotFoundException(`Plantilla con ID ${id_plantilla} no encontrada`);
            }

            if (!plantilla.nombre_archivo) {
                throw new BadRequestException('Plantilla sin nombre de archivo válido');
            }

            console.log(`📄 Plantilla encontrada: ${plantilla.nombre_archivo}`);
            console.log(`📋 Parámetros recibidos:`, parametrosPersonalizados);

            // ✅ Obtener la ruta del archivo
            const templatePath = path.resolve( plantilla.ruta_archivo);
            const ext = path.extname(plantilla.nombre_archivo).toLowerCase();

            // ✅ Verificar que el archivo existe
            if (!fs.existsSync(templatePath)) {
                throw new NotFoundException(`Archivo físico no encontrado: ${templatePath}`);
            }

            // ✅ Procesar según el tipo de archivo
            if (ext === '.docx') {
                return await this.procesarDocx(plantilla, templatePath, parametrosPersonalizados);
            } 
            else if (ext === '.xlsx') {
                return await this.procesarExcel(plantilla, templatePath, parametrosPersonalizados);
            }
            else if (ext === '.xls') {
                return await this.procesarXls(plantilla, templatePath, parametrosPersonalizados);
            }

            throw new InternalServerErrorException(`Tipo de archivo no soportado: ${ext}`);
        }

        async getPlantillaById(id_plantilla: bigint) {
            try {
                const plantilla = await this.prisma.plantilla.findUnique({
                    where: {
                        id_plantilla: id_plantilla,
                    },
                    select: {
                        id_plantilla: true,
                        nombre_archivo: true,
                        ruta_archivo: true,
                        id_usuario: true,
                        id_modulo: true,
                    },
                });

                return plantilla;
            } catch (error) {
                console.error('Error al obtener plantilla por ID:', error);
                throw new InternalServerErrorException('Error al obtener plantilla');
            }
        }

        async getPlantillasByUsuario(id_usuario: bigint) {
            try {
                const plantillas = await this.prisma.plantilla.findMany({
                    where: {
                        id_usuario: id_usuario,
                    },
                });
                return plantillas;
            } catch (error) {
                console.error('Error al obtener plantillas por usuario:', error);
                throw new InternalServerErrorException('Error al obtener plantillas');
            }
        }

        async getPlantillasByModulo(id_modulo: bigint) {
            try {
                const plantillas = await this.prisma.plantilla.findMany({
                    where: {
                        id_modulo: id_modulo,
                    },
                });
                return plantillas;
            } catch (error) {
                console.error('Error al obtener plantillas por módulo:', error);
                throw new InternalServerErrorException('Error al obtener plantillas');
            }
        }

        async deletePlantilla(id_plantilla: bigint, id_usuario: bigint) {
            try {
                const plantilla = await this.prisma.plantilla.findFirst({
                    where: {
                        id_plantilla: id_plantilla,
                        id_usuario: id_usuario,
                    },
                });

                if (!plantilla) {
                    throw new NotFoundException('Plantilla no encontrada o no tienes permisos');
                }

                await this.prisma.plantilla.delete({
                    where: {
                        id_plantilla: id_plantilla,
                    },
                });

                if (plantilla.ruta_archivo && fs.existsSync(plantilla.ruta_archivo)) {
                    fs.unlinkSync(plantilla.ruta_archivo);
                }

                return { message: 'Plantilla eliminada exitosamente' };
            } catch (error) {
                console.error('Error al eliminar plantilla:', error);
                throw new InternalServerErrorException('Error al eliminar plantilla');
            }
        }

        async extraerMarcadores(nombre_archivo: string): Promise<string[]> {
            try {
                const rutaArchivo = path.join(__dirname, '../../..', 'uploads/plantillas', nombre_archivo);
                
                if (!fs.existsSync(rutaArchivo)) {
                    throw new NotFoundException('Archivo no encontrado');
                }

                const extension = path.extname(nombre_archivo).toLowerCase();
                let marcadores: string[] = [];

                if (extension === '.docx') {
                    const content = fs.readFileSync(rutaArchivo);
                    const zip = new PizZip(content);
                    const doc = new Docxtemplater(zip);
                    
                    const text = doc.getFullText();
                    const regex = /{([^}]+)}/g;
                    let match;
                    
                    while ((match = regex.exec(text)) !== null) {
                        marcadores.push(match[1]);
                    }
                } else if (extension === '.xlsx' || extension === '.xls') {
                    const workbook = XLSX.readFile(rutaArchivo);
                    const sheetNames = workbook.SheetNames;
                    
                    for (const sheetName of sheetNames) {
                        const worksheet = workbook.Sheets[sheetName];
                        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
                        
                        for (let R = range.s.r; R <= range.e.r; ++R) {
                            for (let C = range.s.c; C <= range.e.c; ++C) {
                                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                                const cell = worksheet[cellAddress];
                                
                                if (cell && cell.v) {
                                    const cellValue = cell.v.toString();
                                    const regex = /{([^}]+)}/g;
                                    let match;
                                    
                                    while ((match = regex.exec(cellValue)) !== null) {
                                        marcadores.push(match[1]);
                                    }
                                }
                            }
                        }
                    }
                }

                return [...new Set(marcadores)];
            } catch (error) {
                console.error('Error al extraer marcadores:', error);
                throw new InternalServerErrorException('Error al extraer marcadores');
            }
        }

        //  Método privado para procesar archivos DOCX
        private async procesarDocx(
            plantilla: any,
            templatePath: string,
            parametrosPersonalizados: Record<string, any>
        ): Promise<[string, Buffer]> {
            console.log('🚀 Procesando archivo DOCX...');
            
            const content = fs.readFileSync(templatePath);
            let zip;

            try {
                zip = new PizZip(content);
            } catch (e) {
                throw new InternalServerErrorException('La plantilla .docx está dañada o no es válida');
            }

            let doc: Docxtemplater;
            try {
                doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    errorLogging: true,
                });
            } catch (e) {
                throw new InternalServerErrorException('No se pudo inicializar Docxtemplater');
            }

            // ✅ Usar parámetros personalizados dinámicos
            doc.setData(parametrosPersonalizados);

            try {
                doc.render();
            } catch (error: any) {
                console.error('Docxtemplater render error:', {
                    message: error.message,
                    properties: error.properties,
                });
                throw new InternalServerErrorException('Error al renderizar la plantilla DOCX');
            }

            const buffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            const nombreArchivo = `documento_generado_${plantilla.id_plantilla}_${Date.now()}.docx`;
            console.log(`✅ DOCX generado: ${nombreArchivo}`);
            
            return [nombreArchivo, buffer];
        }

        // Método privado para procesar archivos XLSX
        private async procesarExcel(
            plantilla: any,
            templatePath: string,
            parametrosPersonalizados: Record<string, any>
        ): Promise<[string, Buffer]> {
            console.log('🚀 Procesando archivo XLSX...');
            
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(templatePath);
            
            console.log('📋 Parámetros a aplicar:', parametrosPersonalizados);

            workbook.eachSheet((worksheet) => {
                console.log(`📄 Procesando hoja: ${worksheet.name}`);
                worksheet.eachRow((row, rowNumber) => {
                    row.eachCell((cell, colNumber) => {
                        if (cell.value && typeof cell.value === 'string') {
                            let cellValue = cell.value;

                            // ✅ Usar parámetros personalizados dinámicos
                            Object.keys(parametrosPersonalizados).forEach(key => {
                                const marker = `{${key}}`;
                                if (cellValue.includes(marker)) {
                                    cellValue = cellValue.replace(
                                        new RegExp(`\\{${key}\\}`, 'g'), 
                                        String(parametrosPersonalizados[key])
                                    );
                                    console.log(`✅ Reemplazado ${marker} en celda ${rowNumber},${colNumber}`);
                                }
                            });

                            cell.value = cellValue;
                        }
                    });
                });
            });

            const excelBuffer = await workbook.xlsx.writeBuffer();
            const buffer = Buffer.isBuffer(excelBuffer) 
                ? excelBuffer as Buffer 
                : Buffer.from(excelBuffer as ArrayBuffer);
            
            const nombreArchivo = `documento_excel_${plantilla.id_plantilla}_${Date.now()}.xlsx`;
            console.log(`✅ EXCEL generado: ${nombreArchivo}, Tamaño: ${buffer.length} bytes`);
            
            return [nombreArchivo, buffer];
        }

        //  Método privado para procesar archivos XLS (legacy)
        private async procesarXls(
            plantilla: any,
            templatePath: string,
            parametrosPersonalizados: Record<string, any>
        ): Promise<[string, Buffer]> {
            console.log('🚀 Procesando archivo XLS (legacy)...');
            
            const wb = XLSX.readFile(templatePath);
            
            wb.SheetNames.forEach((name) => {
                const ws = wb.Sheets[name];
                Object.keys(ws).forEach((addr) => {
                    if (addr.startsWith('!')) return;
                    const cell = ws[addr] as XLSX.CellObject;
                    if (cell && cell.t === 's' && typeof cell.v === 'string') {
                        let v = cell.v as string;
                        
                        // ✅ Usar parámetros personalizados dinámicos
                        Object.keys(parametrosPersonalizados).forEach((key) => {
                            v = v.replace(
                                new RegExp(`\\{${key}\\}`, 'g'), 
                                String(parametrosPersonalizados[key])
                            );
                        });
                        
                        cell.v = v;
                    }
                });
            });

            // Exportar como .xlsx (formato moderno)
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
            const nombreArchivo = `documento_excel_${plantilla.id_plantilla}_${Date.now()}.xlsx`;
            
            console.log(`✅ XLS convertido a XLSX: ${nombreArchivo}`);
            
            return [nombreArchivo, buffer];
        }
        //Metodo para obtener todas las plantillas
         async getPlantillasAll() { 
            const plantillas = await this.prisma.plantilla.findMany();
            return {'data' : plantillas}
        } 
        async getAreasEstudio(Estudiante: number) {
           const areas = await this.prisma.area.findMany({
            where: { 
                carrera_Area: { 
                    some: { 
                        carrera: { 
                            estudiante_Carrera: { 
                                some: { 
                                    Id_CarreraEstudiante: Estudiante
                                }
                            }
                        }
                    }
                }
            }
           }); 
           return {areas: areas}
        }
        async getEstudiante(Estudiante: number) { 
            return await this.prisma.estudiante_Carrera.findMany({ 
                where: {
                 Id_Estudiante: Estudiante
                }, 
                   include: { estudiante: true, carrera: true}
            });
        }
    }