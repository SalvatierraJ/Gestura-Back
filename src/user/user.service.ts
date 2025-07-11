import { Usuario, Rol, Usuario_Rol } from './../../node_modules/.prisma/client/index.d';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {

    constructor(private prisma: PrismaService) { }

    async createUser(body: any) {
        const { Persona, Id_Rol, ...userData } = body;
        try {
            const salts = await bcrypt.genSalt()
            const hashedPassword = await bcrypt.hash(body.Password, salts)

            const newUser = await this.prisma.usuario.create({
                data: {
                    ...userData,
                    Password: hashedPassword,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            if (Array.isArray(Id_Rol)) {
                const rolesToCreate = Id_Rol.map((rolId: number) => ({
                    Id_Usuario: newUser.Id_Usuario,
                    Id_Rol: rolId,
                }));

                await this.prisma.usuario_Rol.createMany({
                    data: rolesToCreate,
                    skipDuplicates: true,
                });
            }
            const { Password, ...result } = newUser;
            return result;
        } catch (error) {
            if (error instanceof Error) {
                throw new InternalServerErrorException(error.message);
            }
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
                include: { Usuario_Rol: { include: { Rol: true } } }
            });
            if (!user) throw new NotFoundException(`User with ID ${id} not found`);
            const { Password, Id_Persona, Id_Usuario, created_at, Usuario_Rol, updated_at, ...result } = user;
            const rol = Usuario_Rol && Usuario_Rol.length > 0 ? Usuario_Rol[0]?.Rol?.Nombre || null : null;
            return { ...result, rol };
        } catch (error) {
            if (error instanceof NotFoundException) throw new NotFoundException(error.message);
            if (error instanceof Error) throw new InternalServerErrorException(error.message);
        }
    }

    async findAllUsuariosConRoles({ page, pageSize }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const total = await this.prisma.usuario.count();

            const usuarios = await this.prisma.usuario.findMany({
                skip,
                take,
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
                },
            });

            const items = usuarios.map(user => ({
                id: user.Id_Usuario,
                username: user.Nombre_Usuario,
                nombres: `${user.Persona?.Nombre ?? ''} ${user.Persona?.Apellido1 ?? ''} ${user.Persona?.Apellido2 ?? ''}`.trim() ,
                correo: user.Persona?.Correo ?? '',
                roles: (user.Usuario_Rol || [])
                    .map(ur => ({
                        id: ur.Rol?.id_Rol,
                        nombre: ur.Rol?.Nombre,
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


    async updateUser(idUsuario: number, body: any) {
        const { Id_Rol, ...userData } = body;

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

            const rolData = roles.map((idRol) => ({
                Id_Usuario: idUsuario,
                Id_Rol: idRol,
            }));

            await this.prisma.usuario_Rol.createMany({
                data: rolData,
            });

            const updatedUser = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: idUsuario },
                include: {
                    Persona: true,
                    Usuario_Rol: { include: { Rol: true } },
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
