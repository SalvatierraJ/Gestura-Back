import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class CasosEstudioService {

    constructor(private prisma: PrismaService) {}
    async createCasoEstudio(Titulo: string, Autor: string, Tema: string, Fecha_Creacion: Date, id_area: number, url: string) {
        try {
            const newCasoEstudio = await this.prisma.casos_de_estudio.create({
                data: {
                    Nombre_Archivo: Titulo,
                    estado: true,
                    fecha_Subida: Fecha_Creacion,
                    id_area: id_area,
                    url: url,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            await this.prisma.metadatos.create({
                data: {
                    Titulo: Titulo,
                    Autor: Autor,
                    Tema: Tema,
                    Fecha_Creacion: Fecha_Creacion,
                    modelo_Origen: "casos_de_estudio",
                    Id_Origen: newCasoEstudio.id_casoEstudio,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, estado, ...result } = newCasoEstudio;
            return result;
        } catch (error) {
            throw new Error(`Error creating case study: ${error.message}`);
        }
    }

    async getAllCasosEstudio({ page, pageSize }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);
            const total = await this.prisma.casos_de_estudio.count();
            const casosEstudio = await this.prisma.casos_de_estudio.findMany({
                skip,
                take,
                include: { area: true }
            });
            const metadatos = await this.prisma.metadatos.findMany({
                where: { modelo_Origen: "casos_de_estudio", Id_Origen: { in: casosEstudio.map(caso => caso.id_casoEstudio) } },
                select: {
                    Id_Origen: true,
                    Titulo: true,
                    Autor: true,
                    Tema: true,
                    Fecha_Creacion: true
                }   
            });
            const items = casosEstudio.map(caso => {
                const metadata = metadatos.find(meta => meta.Id_Origen === caso.id_casoEstudio);
                if (!metadata) {
                    throw new Error(`Metadata not found for case study ID ${caso.id_casoEstudio}`);
                }
                const { created_at, updated_at, id_area, area, ...result } = caso;
                const areaName = area ? area.nombre_area : null;
                return { ...result, areaName, ...metadata };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching case studies: ${error.message}`);
        }
    }

}
