import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class CasosEstudioService {

    constructor(private prisma: PrismaService) { }
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
async getfiltredCasosEstudio({ page, pageSize, user, word }) {
    try {
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Number(pageSize);

        // 1. Obtener carreras que administra el usuario
        const usuario = await this.prisma.usuario.findUnique({
            where: { Id_Usuario: user },
            include: {
                usuario_Carrera: true
            }
        });

        if (!usuario) throw new Error("Usuario no encontrado");

        const carrerasIds = usuario.usuario_Carrera
            .map(rc => rc.Id_carrera)
            .filter((id): id is bigint => id !== null && id !== undefined);

        if (carrerasIds.length === 0) {
            return {
                items: [], total: 0, page: Number(page),
                pageSize: Number(pageSize), totalPages: 0
            };
        }

        // 2. Obtener las áreas relacionadas a esas carreras
        const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
            where: { Id_Carrera: { in: carrerasIds } },
            select: { Id_Area: true }
        });

        const areaIds = [
            ...new Set(
                areaCarreraLinks
                    .map(link => link.Id_Area)
                    .filter((id): id is bigint => id !== null && id !== undefined)
            )
        ];

        if (areaIds.length === 0) {
            return {
                items: [], total: 0, page: Number(page),
                pageSize: Number(pageSize), totalPages: 0
            };
        }

        // --- INICIO DE LA MODIFICACIÓN ---

        // 3. Construir la cláusula de filtro dinámicamente
        const whereClause = {
            id_area: { in: areaIds },
            // Añadimos esta condición si 'word' tiene un valor
            ...(word && {
                Nombre_Archivo: {
                    contains: word,
                    mode: 'insensitive', // Para que la búsqueda no distinga mayúsculas/minúsculas
                },
            }),
        };

        // 4. Filtrar casos de estudio usando la nueva cláusula
        const total = await this.prisma.casos_de_estudio.count({
            where: whereClause // Usamos la cláusula aquí
        });

        const casosEstudio = await this.prisma.casos_de_estudio.findMany({
            where: whereClause, // Y aquí también
            skip,
            take,
            include: { area: true }
        });
        
        // --- FIN DE LA MODIFICACIÓN ---

        const metadatos = await this.prisma.metadatos.findMany({
            where: {
                modelo_Origen: "casos_de_estudio",
                Id_Origen: { in: casosEstudio.map(caso => caso.id_casoEstudio) }
            },
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
                // Considera manejar este caso de forma más robusta si es posible que no exista metadata
                return null; 
            }
            const { created_at, updated_at, area, ...result } = caso;
            const areaName = area ? area.nombre_area : null;
            return { ...result, areaName, ...metadata };
        }).filter(Boolean); // Filtra los posibles nulos

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

    async getAllCasosEstudio({ page, pageSize, user }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            // 1. Obtener carreras que administra el usuario
            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: {
                    usuario_Carrera:true
                }
            });

            if (!usuario) throw new Error("Usuario no encontrado");

            const carrerasIds = usuario.usuario_Carrera
                .map(rc => rc.Id_carrera)
                .filter((id): id is bigint => id !== null && id !== undefined);

            if (carrerasIds.length === 0) {
                return {
                    items: [],
                    total: 0,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: 0
                };
            }

            // 2. Obtener las áreas relacionadas a esas carreras
            const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
                where: { Id_Carrera: { in: carrerasIds } },
                select: { Id_Area: true }
            });

            const areaIds = [
                ...new Set(
                    areaCarreraLinks
                        .map(link => link.Id_Area)
                        .filter((id): id is bigint => id !== null && id !== undefined)
                )
            ];

            if (areaIds.length === 0) {
                return {
                    items: [],
                    total: 0,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: 0
                };
            }

            // 3. Filtrar casos de estudio por esas áreas
            const total = await this.prisma.casos_de_estudio.count({
                where: { id_area: { in: areaIds } }
            });

            const casosEstudio = await this.prisma.casos_de_estudio.findMany({
                where: { id_area: { in: areaIds } },
                skip,
                take,
                include: { area: true }
            });

            const metadatos = await this.prisma.metadatos.findMany({
                where: {
                    modelo_Origen: "casos_de_estudio",
                    Id_Origen: { in: casosEstudio.map(caso => caso.id_casoEstudio) }
                },
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
                const { created_at, updated_at, area, ...result } = caso;
                const areaName = area ? area.nombre_area : null;
                return { ...result, areaName, ...metadata };
            }).filter(Boolean);

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

    async updateStateCasoEstudio(id: bigint, body: any) {
        try {
            const updatedcaso = await this.prisma.casos_de_estudio.update({
                where: { id_casoEstudio: id },
                data: {
                    estado: body.estado,
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, ...result } = updatedcaso;
            return result;
        } catch (error) {
            throw new Error(`Error updating caso state: ${error.message}`);
        }
    }


    async updateCasoEstudio(
        id_casoEstudio: number,
        datos: {
            Titulo: string,
            Autor: string,
            Tema: string,
            Fecha_Creacion: Date,
            id_area: number,
        }
    ) {
        try {
            const updatedCaso = await this.prisma.casos_de_estudio.update({
                where: { id_casoEstudio },
                data: {
                    Nombre_Archivo: datos.Titulo,
                    fecha_Subida: datos.Fecha_Creacion,
                    id_area: datos.id_area,
                    updated_at: new Date(),
                },
            });

            await this.prisma.metadatos.updateMany({
                where: {
                    modelo_Origen: "casos_de_estudio",
                    Id_Origen: id_casoEstudio,
                },
                data: {
                    Titulo: datos.Titulo,
                    Autor: datos.Autor,
                    Tema: datos.Tema,
                    Fecha_Creacion: datos.Fecha_Creacion,
                    updated_at: new Date(),
                },
            });

            return { success: true, data: updatedCaso };
        } catch (error) {
            throw new Error(`Error updating case study: ${error.message}`);
        }
    }


}
