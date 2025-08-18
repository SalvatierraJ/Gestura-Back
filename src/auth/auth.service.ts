import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { UserService } from 'src/user/user.service';
import * as bcrypt from 'bcrypt';
import { userEntity } from './user';
import { JwtService } from '@nestjs/jwt';
import { PayloadEntity } from './peyload';
import { LoginUserDto } from 'src/user/dto/login-user.dto';
import { PrismaService } from 'src/database/prisma.services';
import { UpdateProfileDto } from './dto/update-profile.dto';
import * as jwt from "jsonwebtoken";
@Injectable()
export class AuthService {
  constructor(
    private userServices: UserService,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) { }

  async validateUser(body: LoginUserDto) {
    try {
      const user = await this.userServices.findOneUser(body.Nombre_Usuario);

      const matchResult = await bcrypt.compare(
        body.Password,
        user?.Password ?? '',
      );
      if (user && matchResult) {
        const { Password, ...result } = user;
        return result;
      }
      return null;
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(error.message);
      }
    }
  }

  async login(user: userEntity) {
    const payload: PayloadEntity = {
      username: user.Nombre_Usuario,
      sub: Number(user.Id_Usuario),
    };

    // Verificar si necesita completar perfil
    const requiereCompletarPerfil = await this.verificarPerfilCompleto(
      user.Id_Usuario,
    );

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.Id_Usuario,
        username: user.Nombre_Usuario,
        requiereCompletarPerfil: requiereCompletarPerfil.requiere,
        detallesPerfil: requiereCompletarPerfil.detalles,
      },
    };
  }

  async verificarPerfilCompleto(userId: bigint) {
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: userId },
        include: {
          Persona: true,
          Usuario_Rol: {
            include: { Rol: true },
          },
        },
      });

      if (!usuario) {
        throw new Error('Usuario no encontrado');
      }

      const persona = usuario.Persona;
      const roles = usuario.Usuario_Rol.map((ur) =>
        ur.Rol?.Nombre?.toLowerCase(),
      );

      const esEstudiante = roles.includes('estudiante');

      // Verificar campos obligatorios
      const camposFaltantes: string[] = [];

      if (!persona?.Nombre?.trim()) camposFaltantes.push('nombre');
      if (!persona?.Apellido1?.trim()) camposFaltantes.push('apellido1');
      if (!persona?.Correo?.trim()) camposFaltantes.push('correo');
      if (!persona?.CI?.trim()) camposFaltantes.push('ci');

      // Para estudiantes, teléfono es obligatorio
      if (esEstudiante && !persona?.telefono) {
        camposFaltantes.push('telefono');
      }

      const requiereCompletar = camposFaltantes.length > 0;

      return {
        requiere: requiereCompletar,
        detalles: requiereCompletar
          ? {
            camposFaltantes,
            esEstudiante,
            mensaje:
              'Por favor, revisa y completa tu información personal antes de continuar.',
            datosActuales: {
              nombre: persona?.Nombre || '',
              apellido1: persona?.Apellido1 || '',
              apellido2: persona?.Apellido2 || '',
              correo: persona?.Correo || '',
              ci: persona?.CI || '',
              telefono: persona?.telefono?.toString() || '',
            },
          }
          : null,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al verificar perfil: ${error.message}`,
      );
    }
  }

  async completarPerfil(userId: bigint, updateProfileDto: UpdateProfileDto) {
    try {
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: userId },
        include: { Persona: true },
      });

      if (!usuario) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Actualizar datos de la persona
      await this.prisma.persona.update({
        where: { Id_Persona: usuario.Id_Persona },
        data: {
          Nombre: updateProfileDto.nombre,
          Apellido1: updateProfileDto.apellido1,
          Apellido2: updateProfileDto.apellido2 || '',
          Correo: updateProfileDto.correo,
          CI: updateProfileDto.ci,
          telefono: updateProfileDto.telefono
            ? BigInt(updateProfileDto.telefono)
            : null,
          updated_at: new Date(),
        },
      });

      // Si quiere cambiar la contraseña
      if (updateProfileDto.cambiarPassword && updateProfileDto.nuevaPassword) {
        const salt = await bcrypt.genSalt();
        const hashedPassword = await bcrypt.hash(
          updateProfileDto.nuevaPassword,
          salt,
        );

        await this.prisma.usuario.update({
          where: { Id_Usuario: userId },
          data: {
            Password: hashedPassword,
            updated_at: new Date(),
          },
        });
      }

      return {
        message: 'Perfil completado exitosamente',
        success: true,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Error al completar perfil: ${error.message}`,
      );
    }
  }


  async loginOrRegisterOauthUser(id_token: string) {
    const decoded: any = jwt.decode(id_token);
    const { email, name } = decoded;
    if (!email) throw new Error("No se recibió correo desde Auth0");

    const user = await this.userServices.createOrGetOauthUser({ email, name });

    const payloadToken = { username: user.Nombre_Usuario, sub: Number(user.Id_Usuario) };
    return {
      access_token: this.jwtService.sign(payloadToken),
      user,
    };
  }
}
