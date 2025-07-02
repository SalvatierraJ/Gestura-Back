import { Usuario, Rol, Usuario_Rol } from './../../node_modules/.prisma/client/index.d';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { CreateUserDto } from './dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { create } from 'domain';

@Injectable()
export class UserService {

    constructor(private prisma: PrismaService) { }

    async createUser(body: any) {
        const { Persona,Id_Rol, ...userData } = body;
        try {
            const salts = await bcrypt.genSalt()
            const hashedPassword = await bcrypt.hash(body.Password, salts)

            const newUser = await this.prisma.usuario.create({
                data: {
                    ...userData,
                    Password: hashedPassword,
                }
            });
            const Rol = await this.prisma.usuario_Rol.create({
                data:{
                    Id_Usuario: newUser.Id_Usuario,
                    Id_Rol: body.Id_Rol
                }
            })
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

}
