import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class TribunalDocenteService {
    constructor(private prisma: PrismaService) { }

    async getTribunalesDocentes({ page, pageSize, user }) {
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

            // 3. Buscar solo los tribunales/docentes que tengan áreas en esas área
            const total = await this.prisma.tribunal_Docente.count({
                where: {
                    area_Tribunal: {
                        some: { id_area: { in: areaIds } }
                    }
                }
            });

            const tribunales = await this.prisma.tribunal_Docente.findMany({
                where: {
                    area_Tribunal: {
                        some: { id_area: { in: areaIds } }
                    }
                },
                skip,
                take,
                include: {
                    Persona: true,
                    area_Tribunal: {
                        include: { area: true }
                    }
                }
            });

            const items = tribunales.map(tribunal => {
                const { created_at, updated_at, Persona, area_Tribunal, ...result } = tribunal;
                const Nombre = Persona ? Persona.Nombre : null;
                const Apellido = Persona ? Persona.Apellido1 : null;
                const Apellido2 = Persona ? Persona.Apellido2 : null;
                const areas = (area_Tribunal || [])
                    .map(a =>
                        a.area
                            ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area }
                            : null
                    )
                    .filter(Boolean);

                const correo = Persona ? Persona.Correo : null;
                const telefono = Persona ? Persona.telefono : null;
                const ci = Persona ? Persona.CI : null;
                return { ...result, Nombre, Apellido, Apellido2, areas, correo, telefono, ci };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching tribunales docentes: ${error.message}`);
        }
    }


//Obtener informacion por palabras
  async getTribunalesDocentesFiltred({ page, pageSize, user, word }: { page: number, pageSize: number, user: bigint, word?: string }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

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
                return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
            }

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
                return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
            }

            const whereClause: any = {
                AND: [
                    {
                        area_Tribunal: {
                            some: { id_area: { in: areaIds } }
                        }
                    }
                ]
            };

            if (word && word.trim() !== '') {
                whereClause.AND.push({
                    OR: [
                        { Persona: { Nombre: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Apellido1: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Apellido2: { contains: word, mode: 'insensitive' } } },
                        { Persona: { CI: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Correo: { contains: word, mode: 'insensitive' } } },
                        {
                            area_Tribunal: {
                                some: {
                                    area: {
                                        nombre_area: {
                                            contains: word,
                                            mode: 'insensitive'
                                        }
                                    }
                                }
                            }
                        }
                    ]
                });
            }

            const total = await this.prisma.tribunal_Docente.count({
                where: whereClause
            });

            const tribunales = await this.prisma.tribunal_Docente.findMany({
                where: whereClause,
                skip,
                take,
                include: {
                    Persona: true,
                    area_Tribunal: {
                        include: { area: true }
                    }
                }
            });

            const items = tribunales.map(tribunal => {
                const { created_at, updated_at, Persona, area_Tribunal, ...result } = tribunal;
                const Nombre = Persona ? Persona.Nombre : null;
                const Apellido = Persona ? Persona.Apellido1 : null;
                const Apellido2 = Persona ? Persona.Apellido2 : null;
                const areas = (area_Tribunal || [])
                    .map(a =>
                        a.area
                            ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area }
                            : null
                    )
                    .filter(Boolean);

                const correo = Persona ? Persona.Correo : null;
                const telefono = Persona ? Persona.telefono : null;
                const ci = Persona ? Persona.CI : null;
                return { ...result, Nombre, Apellido, Apellido2, areas, correo, telefono, ci };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error("Error en getTribunalesDocentesFiltred:", error);
            throw new Error(`Error al obtener los tribunales docentes: ${error.message}`);
        }
    }


    async createTribunalDocente(body: any) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                console.log('Creating tribunal docente with body:', body.Persona);
                const { Persona, ...rest } = body;
                const tipoTribunal = await tx.tipo_Tribunal.findFirst({
                    where: { Nombre: 'Interno' }
                });
                if (!tipoTribunal) {
                    throw new Error('Tipo de tribunal no encontrado');
                }
                
                const persona = await tx.persona.create({
                    data: {
                        Nombre: Persona.nombre,
                        Apellido1: Persona.apellido1,
                        Apellido2: Persona.apellido2,
                        Correo: Persona.correo,
                        CI: Persona.ci,
                        telefono: Number(Persona.telefono),
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });
                
                const newTribunal = await tx.tribunal_Docente.create({
                    data: {
                        id_Persona: persona.Id_Persona,
                        Id_TipoTribunal: tipoTribunal.id_TipoTribunal,
                        estado: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });

                if (body.area_especializacion && body.area_especializacion.length > 0) {
                    for (const area of body.area_especializacion) {
                        await tx.area_Tribunal.create({
                            data: {
                                id_area: Number(area),
                                id_Tribunal: newTribunal.id_tribunal,
                                created_at: new Date(),
                                updated_at: new Date(),
                            }
                        });
                    }
                }

                return newTribunal;
            });
        } catch (error) {
            throw new Error(`Error creating tribunal docente: ${error.message}`);
        }
    }
    async updateTribunalDocente(id: number, body: any) {
        try {

            const tribunal = await this.prisma.tribunal_Docente.findUnique({
                where: { id_tribunal: id }
            });
            if (!tribunal) {
                throw new Error('Tribunal docente no encontrado');
            }

            const updatedTribunal = await this.prisma.tribunal_Docente.update({
                where: { id_tribunal: id },
                data: {
                    updated_at: new Date(),
                    area_Tribunal: {
                        deleteMany: {},
                        createMany: {
                            data: body.area_especializacion.map(area => ({
                                id_area: Number(area),
                                created_at: new Date(),
                                updated_at: new Date(),
                            }))
                        }
                    },
                    Persona: {
                        update: {
                            Nombre: body.Persona.nombre,
                            Apellido1: body.Persona.apellido1,
                            Apellido2: body.Persona.apellido2,
                            Correo: body.Persona.correo,
                            CI: body.Persona.ci,
                            telefono: body.Persona.telefono,
                            updated_at: new Date(),
                        }
                    }
                }
            });

            return updatedTribunal;
        } catch (error) {
            throw new Error(`Error updating tribunal docente: ${error.message}`);
        }
    }

    async updateEstadoTribunalDocente(id: number, estado: boolean | { estado: boolean }) {
        try {
            const estadoValue = typeof estado === 'object' && estado !== null
                ? estado.estado
                : estado;
            const tribunal = await this.prisma.tribunal_Docente.findUnique({
                where: { id_tribunal: id }
            });
            if (!tribunal) {
                throw new Error('Tribunal docente no encontrado');
            }

            const updatedTribunal = await this.prisma.tribunal_Docente.update({
                where: { id_tribunal: id },
                data: {
                    estado: estadoValue,
                    updated_at: new Date(),
                }
            });

            return updatedTribunal;
        } catch (error) {
            throw new Error(`Error updating estado tribunal docente: ${error.message}`);
        }
    }

}
