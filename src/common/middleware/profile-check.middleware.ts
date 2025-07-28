import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.services';

@Injectable()
export class ProfileCheckMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Rutas que no requieren verificación de perfil
    const rutasExentas = [
      '/auth/login',
      '/auth/register',
      '/auth/verificar-perfil',
      '/auth/completar-perfil',
      '/auth/search-people',
    ];

    // Verificar si la ruta actual está exenta
    const rutaActual = req.path;
    const estaExenta = rutasExentas.some((ruta) => rutaActual.includes(ruta));

    if (estaExenta) {
      return next();
    }

    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next();
    }

    try {
      const decoded = this.jwtService.verify(token);
      const userId = decoded.sub;

      // Verificar si el perfil está completo
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: BigInt(userId) },
        include: {
          Persona: true,
          Usuario_Rol: {
            include: { Rol: true },
          },
        },
      });

      if (usuario) {
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

        if (camposFaltantes.length > 0) {
          return res.status(403).json({
            message: 'Debe completar su perfil antes de continuar',
            requiereCompletarPerfil: true,
            camposFaltantes,
            esEstudiante,
            datosActuales: {
              nombre: persona?.Nombre || '',
              apellido1: persona?.Apellido1 || '',
              apellido2: persona?.Apellido2 || '',
              correo: persona?.Correo || '',
              ci: persona?.CI || '',
              telefono: persona?.telefono?.toString() || '',
            },
          });
        }
      }
    } catch (error) {
      // Token inválido, continuar con el flujo normal
    }

    next();
  }
}
