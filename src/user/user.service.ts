import { usuario_Carrera } from './../../node_modules/.prisma/client/index.d';
import { JwtService } from '@nestjs/jwt';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {

    constructor(private prisma: PrismaService, private jwtService: JwtService) { }

    async createUser(body: any) {
        const { Id_Rol, carreras = [], id_persona, Password, ...userData } = body;
        try {
            let idPersonaToAssign = Number(id_persona) ? Number(id_persona) : null;
            if (!idPersonaToAssign) {
                const newPerson = await this.prisma.persona.create({
                    data: {
                        Nombre: "",
                        Apellido1: "",
                        Apellido2: "",
                        Correo: "",
                        CI: "",
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });
                idPersonaToAssign = Number(newPerson.Id_Persona);
            }

            // 2. Crear el usuario con el id_persona asignado
            const salt = await bcrypt.genSalt();
            const hashedPassword = await bcrypt.hash(body.Password, salt);

            const newUser = await this.prisma.usuario.create({
                data: {
                    ...userData,
                    Id_Persona: idPersonaToAssign,
                    Password: hashedPassword,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });

            if (Array.isArray(Id_Rol) && Id_Rol.length > 0) {
                const rolesToCreate = Id_Rol.map((rolId: string | number) => ({
                    Id_Usuario: newUser.Id_Usuario,
                    Id_Rol: Number(rolId),
                }));
                await this.prisma.usuario_Rol.createMany({
                    data: rolesToCreate,
                    skipDuplicates: true,
                });
            }

            if (Array.isArray(carreras) && carreras.length > 0) {
                await this.prisma.usuario_Carrera.createMany({
                    data: carreras.map((idCarrera: string | number) => ({
                        Id_usuario: newUser.Id_Usuario,
                        Id_carrera: Number(idCarrera),
                    })),
                    skipDuplicates: true,
                });
            }

            const { Password, ...result } = newUser;
            return result;
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }



    async findOneUser(username: string) {
        try {
            const user = await this.prisma.usuario.findFirst({
                where: { Nombre_Usuario: username }
            })
            if (user) return user;
            return null;
        } catch (error) {
            if (error instanceof Error) throw new InternalServerErrorException(error.message);
        }
    }

    async getUserById(id: bigint) {
        try {
            const user = await this.prisma.usuario.findFirst({
                where: { Id_Usuario: id },
                include: {
                    Persona: true,
                    Usuario_Rol: {
                        include: {
                            Rol: {
                                include: {
                                    rol_Modulo_Permiso: {
                                        include: {
                                            Modulos: true,
                                            Permisos: true
                                        }
                                    },
                                }
                            }
                        }
                    },
                    usuario_Carrera: {
                        include: {
                            carrera: true
                        }
                    }
                }
            });
            if (!user) throw new NotFoundException(`User with ID ${id} not found`);

            const roles = user.Usuario_Rol
                .filter(({ Rol }) => Rol !== null)
                .map(({ Rol }) => ({
                    id_Rol: Rol!.id_Rol,
                    Nombre: Rol!.Nombre,
                    carreras: (user.usuario_Carrera ?? []).map(rc => ({
                        id_carrera: rc.carrera?.id_carrera,
                        nombre_carrera: rc.carrera?.nombre_carrera
                    })),
                    modulos: Object.values(
                        (Rol!.rol_Modulo_Permiso ?? []).reduce((acc, rmp) => {
                            if (!rmp.Modulos) return acc;
                            const id = rmp.Modulos.Id_Modulo;
                            const idKey = id.toString();
                            if (!acc[idKey]) {
                                acc[idKey] = {
                                    Id_Modulo: rmp.Modulos.Id_Modulo,
                                    Nombre: rmp.Modulos.Nombre,
                                    permisos: []
                                };
                            }
                            if (rmp.Permisos) {
                                acc[idKey].permisos.push({
                                    Id_Permiso: rmp.Permisos.Id_Permiso,
                                    Nombre: rmp.Permisos.Nombre,
                                    Descripcion: rmp.Permisos.Descripcion
                                });
                            }
                            return acc;
                        }, {} as Record<number, any>)
                    )
                }))
                .sort((a, b) =>
                    b.modulos.reduce((acc, m) => acc + m.permisos.length, 0) -
                    a.modulos.reduce((acc, m) => acc + m.permisos.length, 0)
                );


            const {
                Password, Id_Persona, created_at, Usuario_Rol, updated_at, ...restUser
            } = user;

            return {
                ...restUser,
                roles
            };
        } catch (error) {
            if (error instanceof NotFoundException) throw new NotFoundException(error.message);
            if (error instanceof Error) throw new InternalServerErrorException(error.message);
        }
    }


    async findAllUsuariosConRoles(page: any, pageSize: any, userId: any) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const allUsers = await this.prisma.usuario.findMany({
                include: {
                    Persona: {
                        select: {
                            Nombre: true,
                            Apellido1: true,
                            Apellido2: true,
                            Correo: true,
                        },
                    },
                    Usuario_Rol: {
                        include: {
                            Rol: {
                                select: {
                                    id_Rol: true,
                                    Nombre: true,
                                },
                            },
                        },
                    },
                    usuario_Carrera: {
                        include: {
                            carrera: true
                        }
                    }
                },
            });

            const filteredUsers = allUsers
                .filter(user => user.Id_Usuario !== userId);

            const total = filteredUsers.length;

            const items = filteredUsers
                .slice((page - 1) * pageSize, page * pageSize)
                .map(user => ({
                    id: user.Id_Usuario,
                    username: user.Nombre_Usuario,
                    nombres: `${user.Persona?.Nombre ?? ''} ${user.Persona?.Apellido1 ?? ''} ${user.Persona?.Apellido2 ?? ''}`.trim(),
                    correo: user.Persona?.Correo ?? '',
                    roles: (user.Usuario_Rol || [])
                        .map(ur => ({
                            id: ur.Rol?.id_Rol,
                            nombre: ur.Rol?.Nombre,
                        }))
                        .filter(role => role.id !== undefined),
                    carreras: (user.usuario_Carrera || [])
                        .map(ur => ({
                            id: ur.carrera?.id_carrera,
                            nombre: ur.carrera?.nombre_carrera,
                        }))
                        .filter(role => role.id !== undefined),
                }));

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize),
            };

        } catch (error) {
            throw new Error(`Error al obtener usuarios con roles: ${error.message}`);
        }
    }


    async updateUserProfile(idUsuario: number, body: any) {
        const { Persona, Password, ...usuarioData } = body;
        try {
            const usuarioActual = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: idUsuario },
            });

            if (!usuarioActual) {
                throw new NotFoundException(`Usuario con ID ${idUsuario} no encontrado.`);
            }

            if (Persona && Object.keys(Persona).length > 0) {
                await this.prisma.persona.update({
                    where: { Id_Persona: usuarioActual.Id_Persona },
                    data: {
                        ...Persona,
                        updated_at: new Date(),
                    },
                });
            }

            if (Password) {
                const salt = await bcrypt.genSalt();
                usuarioData.Password = await bcrypt.hash(Password, salt);
            }

            if (Object.keys(usuarioData).length > 0) {
                await this.prisma.usuario.update({
                    where: { Id_Usuario: idUsuario },
                    data: {
                        ...usuarioData,
                        updated_at: new Date(),
                    },
                });
            }
            const updatedUser = await this.getUserById(BigInt(idUsuario));
            const payload = { username: updatedUser?.Nombre_Usuario, sub: Number(updatedUser?.Id_Usuario) };
            const access_token = this.jwtService.sign(payload);
            return {
                data: updatedUser,
                access_token,
            };

        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            if (error instanceof Error) {
                throw new InternalServerErrorException(error.message);
            }
            throw new InternalServerErrorException('Error inesperado al actualizar el perfil.');
        }
    }

    async updateUser(idUsuario: number, body: any) {
        const { Id_Rol, carreras, ...userData } = body;

        try {
            if (body.Password) {
                const salt = await bcrypt.genSalt();
                userData.Password = await bcrypt.hash(body.Password, salt);
            }

            await this.prisma.usuario.update({
                where: { Id_Usuario: idUsuario },
                data: {
                    ...userData,
                    updated_at: new Date(),
                },
            });

            await this.prisma.usuario_Rol.deleteMany({
                where: { Id_Usuario: idUsuario },
            });

            const roles = Array.isArray(Id_Rol) ? Id_Rol : [Id_Rol];
            await this.prisma.usuario_Rol.createMany({
                data: roles.map((idRol) => ({
                    Id_Usuario: idUsuario,
                    Id_Rol: Number(idRol),
                })),
            });

            const rolEstudiante = await this.prisma.rol.findFirst({
                where: { Nombre: { contains: "estudiante", mode: "insensitive" } },
                select: { id_Rol: true },
            });

            const esEstudiante = rolEstudiante && roles.some(
                (idRol) => String(idRol) === String(rolEstudiante.id_Rol)
            );

            await this.prisma.usuario_Carrera.deleteMany({
                where: { Id_usuario: idUsuario },
            });

            if (!esEstudiante && Array.isArray(carreras) && carreras.length > 0) {
                await this.prisma.usuario_Carrera.createMany({
                    data: carreras.map((idCarrera) => ({
                        Id_usuario: idUsuario,
                        Id_carrera: Number(idCarrera),
                    })),
                    skipDuplicates: true,
                });
            }

            const updatedUser = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: idUsuario },
                include: {
                    Persona: true,
                    Usuario_Rol: { include: { Rol: true } },
                    usuario_Carrera: { include: { carrera: true } },
                },
            });

            if (!updatedUser) {
                throw new NotFoundException(`User with ID ${idUsuario} not found`);
            }
            const { Password, ...result } = updatedUser;
            return result;
        } catch (error) {
            throw new InternalServerErrorException(error.message);
        }
    }



}
