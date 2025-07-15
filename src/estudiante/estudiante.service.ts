import { carrera } from './../../node_modules/.prisma/client/index.d';
import { create } from 'domain';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class EstudianteService {

    constructor(private prisma: PrismaService) { }

    async createEstudiantes(body: any) {
        try {
            const estudiantes = body.estudiantes || [];
            if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
                throw new Error('Debes enviar al menos un estudiante');
            }
            const resultados = await Promise.all(
                estudiantes.map(async (estudiante) => {
                    return this.prisma.estudiante.create({
                        data: {
                            nroRegistro: String(estudiante.numeroregistro),
                            Persona: {
                                create: {
                                    Nombre: estudiante.nombre,
                                    Apellido1: estudiante.apellido1,
                                    Apellido2: estudiante.apellido2,
                                    Correo: estudiante.correo,
                                    telefono: Number(estudiante.telefono),
                                    CI: String(estudiante.ci),
                                },
                            },
                            estudiante_Carrera: {
                                create: {
                                    Id_Carrera: Number(estudiante.carrera)
                                }
                            },
                            created_at: new Date(),
                            updated_at: new Date(),
                        },
                    })
                }
                )
            );
            return resultados;
        } catch (error) {
            throw new Error(`Error creating estudiantes: ${error.message}`);
        }
    }


    async updateEstudiante(id: number, body: any) {
        try {
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: id }
            });
            if (!estudiante) {
                throw new Error('Estudiante not found');
            }

            const updatedEstudiante = await this.prisma.estudiante.update({
                where: { id_estudiante: id },
                data: {
                    nroRegistro: body.numeroregistro,
                    updated_at: new Date(),
                    Persona: {
                        update: {
                            Nombre: body.nombre,
                            Apellido1: body.apellido1,
                            Apellido2: body.apellido2,
                            Correo: body.correo,
                            telefono: body.telefono,
                            CI: body.ci,
                            updated_at: new Date(),
                        }
                    }
                }
            });

            return updatedEstudiante;
        } catch (error) {
            throw new Error(`Error updating estudiante: ${error.message}`);
        }
    }

    async getAllEstudiantes({ page, pageSize, user }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            // 1. Obtener carreras que administra el usuario
            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: {
                    Usuario_Rol: {
                        include: {
                            Rol: {
                                include: {
                                    rol_Carrera: true,
                                }
                            }
                        }
                    }
                }
            });

            if (!usuario) throw new Error("Usuario no encontrado");

            const carrerasIds = usuario.Usuario_Rol
                .flatMap(ur => ur.Rol?.rol_Carrera || [])
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

            // 2. Buscar solo estudiantes de esas carreras (usando la tabla intermedia estudiante_Carrera)
            const total = await this.prisma.estudiante.count({
                where: {
                    estudiante_Carrera: {
                        some: {
                            Id_Carrera: { in: carrerasIds }
                        }
                    }
                }
            });

            const estudiantes = await this.prisma.estudiante.findMany({
                where: {
                    estudiante_Carrera: {
                        some: {
                            Id_Carrera: { in: carrerasIds }
                        }
                    }
                },
                skip,
                take,
                include: {
                    Persona: true,
                    defensa: {
                        include: {
                            Tipo_Defensa: {
                                select: {
                                    Nombre: true,
                                }
                            }
                        }
                    },
                    estudiante_Carrera: {
                        include: {
                            carrera: {
                                select: {
                                    nombre_carrera: true
                                }
                            }
                        }
                    }
                }
            });

            const items = estudiantes.map(estudiante => {
                const { Persona, defensa, estudiante_Carrera, ...rest } = estudiante;
                const carreraNombre = estudiante_Carrera && estudiante_Carrera.length > 0
                    ? estudiante_Carrera[0]?.carrera?.nombre_carrera || ''
                    : '';

                return {
                    ...rest,
                    nombre: Persona?.Nombre || '',
                    apellido1: Persona?.Apellido1 || '',
                    apellido2: Persona?.Apellido2 || '',
                    correo: Persona?.Correo || '',
                    telefono: Persona?.telefono || '',
                    ci: Persona?.CI || '',
                    carrera: carreraNombre,
                    defensas: (defensa || []).map(d => ({
                        id_defensa: d.id_defensa,
                        estado: d.estado,
                        nombre_tipo_defensa: d.Tipo_Defensa?.Nombre || '',
                        fecha_defensa: d.fecha_defensa
                    }))
                };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching estudiantes: ${error.message}`);
        }
    }


}
