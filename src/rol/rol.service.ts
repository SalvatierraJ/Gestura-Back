import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { CreateRolDto } from './dto/CreateRolDto';
import { UpdateRolDto } from './dto/UpdateRolDto';

@Injectable()
export class RolService {
    constructor(private prisma: PrismaService) { }
    async crearRol(data: CreateRolDto) {
        const { nombre, modulosPermisos, esTotal } = data;

        // 1. Crear el rol
        const nuevoRol = await this.prisma.rol.create({
            data: {
                Nombre: nombre,
            },
        });

        const rolId = nuevoRol.id_Rol;


        // 3. Asignar permisos por módulos
        if (esTotal) {
            const [modulos, permisos] = await Promise.all([
                this.prisma.modulos.findMany(),
                this.prisma.permisos.findMany(),
            ]);
            const modulosFiltrados = modulos.filter(
                m => m.Nombre?.trim().toLowerCase() !== "mis defensas"
            );

            await Promise.all(
                modulosFiltrados.map(modulo =>
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
            this.prisma.rol_Modulo_Permiso.deleteMany({ where: { Id_Rol: id } }),
        ]);


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
        const rolExistente = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
        if (!rolExistente) {
            throw new NotFoundException('Rol no encontrado');
        }

        await this.prisma.$transaction([
            this.prisma.rol_Modulo_Permiso.deleteMany({ where: { Id_Rol: id } }),
            this.prisma.rol.delete({ where: { id_Rol: id } }),
        ]);

        return {
            message: 'Rol eliminado correctamente',
            rolId: id,
        };
    }

    async obtenerRolesPaginados(
        pagina: number = 1,
        limite: number = 10,
        userId: number | string
    ) {
        const skip = (pagina - 1) * limite;

        const usuario = await this.prisma.usuario.findUnique({
            where: { Id_Usuario: BigInt(userId) },
            include: {
                Usuario_Rol: {
                    include: {
                        Rol: true
                    },
                },
            },
        });
        if (!usuario) {
            throw new Error("Usuario no encontrado");
        }

        const idsRolesUsuario = usuario.Usuario_Rol
            .map(ur => ur.Id_Rol)
            .filter((id): id is bigint => id !== null);

        const esAdmin = usuario.Usuario_Rol.some(
            ur => ur.Rol?.Nombre?.toLowerCase() === "admin"
        );

        let rolesDB: any[] = [];

        if (esAdmin) {
            rolesDB = await this.prisma.rol.findMany({
                where: {
                    id_Rol: { notIn: idsRolesUsuario },
                },
                include: {
                    rol_Modulo_Permiso: {
                        include: {
                            Modulos: true,
                            Permisos: true,
                        },
                    },
                },
            });
        } else {

            rolesDB = await this.prisma.rol.findMany({
                where: {
                    Nombre: { not: "Admin" },
                    id_Rol: { notIn: idsRolesUsuario },
                },
                include: {
                    rol_Modulo_Permiso: {
                        include: {
                            Modulos: true,
                            Permisos: true,
                        },
                    },
                },
            });

            const filtrarIguales = (arr1: any[], arr2: any[]) => {
                const set1 = new Set(arr1.map(String));
                const set2 = new Set(arr2.map(String));
                return (
                    set1.size === set2.size && [...set1].every((x) => set2.has(x))
                );
            };
        }

        const total = rolesDB.length;
        const paginados = rolesDB.slice(skip, skip + limite);

        return {
            total,
            pagina,
            totalPaginas: Math.ceil(total / limite),
            datos: paginados.map((rol) => ({
                id: rol.id_Rol,
                nombre: rol.Nombre,
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
