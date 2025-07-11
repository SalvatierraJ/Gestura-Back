import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { CreateRolDto } from './dto/CreateRolDto';
import { UpdateRolDto } from './dto/UpdateRolDto';

@Injectable()
export class RolService {
    constructor(private prisma: PrismaService) { }
    async crearRol(data: CreateRolDto) {
        const { nombre, carreras, modulosPermisos, esTotal } = data;

        // 1. Crear el rol
        const nuevoRol = await this.prisma.rol.create({
            data: {
                Nombre: nombre,
            },
        });

        const rolId = nuevoRol.id_Rol;

        // 2. Asignar carreras
        await Promise.all(
            carreras.map(idCarrera =>
                this.prisma.rol_Carrera.create({
                    data: {
                        Id_rol: rolId,
                        Id_carrera: idCarrera,
                    },
                })
            )
        );

        // 3. Asignar permisos por módulos
        if (esTotal) {
            const [modulos, permisos] = await Promise.all([
                this.prisma.modulos.findMany(),
                this.prisma.permisos.findMany(),
            ]);

            await Promise.all(
                modulos.map(modulo =>
                    permisos.map(permiso =>
                        this.prisma.rol_Modulo_Permiso.create({
                            data: {
                                Id_Rol: rolId,
                                Id_Modulo: modulo.Id_Modulo,
                                Id_Permiso: permiso.Id_Permiso,
                            },
                        })
                    )
                )
            );
        } else if (modulosPermisos && modulosPermisos.length > 0) {
            for (const modulo of modulosPermisos) {
                for (const permisoId of modulo.permisos) {
                    await this.prisma.rol_Modulo_Permiso.create({
                        data: {
                            Id_Rol: rolId,
                            Id_Modulo: modulo.idModulo,
                            Id_Permiso: permisoId,
                        },
                    });
                }
            }
        }

        return {
            message: 'Rol creado correctamente',
            rolId,
        };
    }


    async actualizarRol(data: UpdateRolDto) {
        const { id, nombre, carreras, modulosPermisos, esTotal } = data;

        // 1. Verificar si el rol existe
        const existe = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
        if (!existe) throw new NotFoundException('Rol no encontrado');

        // 2. Actualizar el nombre
        await this.prisma.rol.update({
            where: { id_Rol: id },
            data: { Nombre: nombre },
        });

        // 3. Eliminar relaciones anteriores
        await Promise.all([
            this.prisma.rol_Carrera.deleteMany({ where: { Id_rol: id } }),
            this.prisma.rol_Modulo_Permiso.deleteMany({ where: { Id_Rol: id } }),
        ]);

        // 4. Insertar nuevas carreras
        await Promise.all(
            carreras.map(idCarrera =>
                this.prisma.rol_Carrera.create({
                    data: {
                        Id_rol: id,
                        Id_carrera: idCarrera,
                    },
                })
            )
        );

        // 5. Asignar nuevos permisos
        if (esTotal) {
            const [modulos, permisos] = await Promise.all([
                this.prisma.modulos.findMany(),
                this.prisma.permisos.findMany(),
            ]);

            await Promise.all(
                modulos.flatMap(modulo =>
                    permisos.map(permiso =>
                        this.prisma.rol_Modulo_Permiso.create({
                            data: {
                                Id_Rol: id,
                                Id_Modulo: modulo.Id_Modulo,
                                Id_Permiso: permiso.Id_Permiso,
                            },
                        })
                    )
                )
            );
        } else if (modulosPermisos && modulosPermisos.length > 0) {
            for (const modulo of modulosPermisos) {
                for (const permisoId of modulo.permisos) {
                    await this.prisma.rol_Modulo_Permiso.create({
                        data: {
                            Id_Rol: id,
                            Id_Modulo: modulo.idModulo,
                            Id_Permiso: permisoId,
                        },
                    });
                }
            }
        }

        return {
            message: 'Rol actualizado correctamente',
            rolId: id,
        };
    }


    async eliminarRol(id: number) {
        // 1. Verificar si el rol existe
        const rolExistente = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
        if (!rolExistente) {
            throw new NotFoundException('Rol no encontrado');
        }

        // 2. Eliminar relaciones
        await this.prisma.$transaction([
            this.prisma.rol_Carrera.deleteMany({ where: { Id_rol: id } }),
            this.prisma.rol_Modulo_Permiso.deleteMany({ where: { Id_Rol: id } }),
            this.prisma.rol.delete({ where: { id_Rol: id } }),
        ]);

        return {
            message: 'Rol eliminado correctamente',
            rolId: id,
        };
    }

    async obtenerRolesPaginados(pagina: number = 1, limite: number = 10) {
        const skip = (pagina - 1) * limite;

        const [roles, total] = await this.prisma.$transaction([
            this.prisma.rol.findMany({
                skip,
                take: Number(limite),
                include: {
                    rol_Carrera: {
                        include: {
                            carrera: true,
                        },
                    },
                    rol_Modulo_Permiso: {
                        include: {
                            Modulos: true,
                            Permisos: true,
                        },
                    },
                },
            }),
            this.prisma.rol.count(),
        ]);

        return {
            total,
            pagina,
            totalPaginas: Math.ceil(total / limite),
            datos: roles.map((rol) => ({
                id: rol.id_Rol,
                nombre: rol.Nombre,
                carreras: rol.rol_Carrera.map((rc) => ({
                    id: rc.carrera?.id_carrera,
                    nombre: rc.carrera?.nombre_carrera,
                })),
                modulos: rol.rol_Modulo_Permiso.map((rmp) => ({
                    id: rmp.Modulos?.Id_Modulo,
                    nombre: rmp.Modulos?.Nombre,
                    permiso: {
                        id: rmp.Permisos?.Id_Permiso,
                        nombre: rmp.Permisos?.Nombre,
                        descripcion: rmp.Permisos?.Descripcion,
                    },
                })),
            })),
        };
    }



}
