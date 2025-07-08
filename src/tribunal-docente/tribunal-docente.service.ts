import { create } from 'domain';
import { area } from './../../node_modules/.prisma/client/index.d';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class TribunalDocenteService {
    constructor(private prisma: PrismaService) { }

    async getTribunalesDocentes({ page, pageSize }) {

        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);
            const total = await this.prisma.tribunal_Docente.count();
            const tribunales = await this.prisma.tribunal_Docente.findMany({
                skip,
                take,
                include: {
                    Persona: true,
                    area_Tribunal: {
                        include: {
                            area: true
                        }
                    },
                }
            });
            const items = tribunales.map(tribunal => {
                const { created_at, updated_at, Persona, area_Tribunal, ...result } = tribunal
                const Nombre = tribunal.Persona ? tribunal.Persona.Nombre : null;
                const Apellido = tribunal.Persona ? tribunal.Persona.Apellido1 : null;
                const Apellido2 = tribunal.Persona ? tribunal.Persona.Apellido2 : null;
                const areas = (tribunal.area_Tribunal || [])
                    .map(a =>
                        a.area
                            ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area }
                            : null
                    )
                    .filter(Boolean); // Quita los nulos


                const correo = tribunal.Persona ? tribunal.Persona.Correo : null;
                const telefono = tribunal.Persona ? tribunal.Persona.telefono : null;
                const ci = tribunal.Persona ? tribunal.Persona.CI : null;
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

    async createTribunalDocente(body: any) {
        try {
            console.log('Creating tribunal docente with body:', body.Persona);
            const { Persona, ...rest } = body;
            const tipoTribunal = await this.prisma.tipo_Tribunal.findFirst({
                where: { Nombre: 'Interno' }
            });
            if (!tipoTribunal) {
                throw new Error('Tipo de tribunal no encontrado');
            }
            const persona = await this.prisma.persona.create({
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
            const newTribunal = await this.prisma.tribunal_Docente.create({
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
                    await this.prisma.area_Tribunal.create({
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
