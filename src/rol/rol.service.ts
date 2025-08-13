import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { CreateRolDto } from './dto/CreateRolDto';
import { UpdateRolDto } from './dto/UpdateRolDto';

@Injectable()
export class RolService {
  constructor(private prisma: PrismaService) {}

  async crearRol(data: CreateRolDto) {
    const { nombre, modulosPermisos, esTotal } = data;

    // 1) crear rol con delete_state false (por si no tienes default en DB)
    const nuevoRol = await this.prisma.rol.create({
      data: {
        Nombre: nombre,
        delete_state: false,
        delete_at: null,
      },
    });

    const rolId = nuevoRol.id_Rol;

    // 2) permisos (igual que antes)
    if (esTotal) {
      const [modulos, permisos] = await Promise.all([
        this.prisma.modulos.findMany(),
        this.prisma.permisos.findMany(),
      ]);

      const modulosFiltrados = modulos.filter(
        (m) => m.Nombre?.trim().toLowerCase() !== 'mis defensas'
      );

      await Promise.all(
        modulosFiltrados.flatMap((modulo) =>
          permisos.map((permiso) =>
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
    } else if (modulosPermisos?.length) {
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

    return { message: 'Rol creado correctamente', rolId };
  }

  async actualizarRol(data: UpdateRolDto) {
    const { id, nombre, modulosPermisos, esTotal } = data;

    const existe = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
    if (!existe) throw new NotFoundException('Rol no encontrado');

    // si está eliminado lógicamente, no permitimos actualizar
    if (existe.delete_state) {
      throw new BadRequestException('No se puede actualizar un rol eliminado.');
    }

    await this.prisma.rol.update({
      where: { id_Rol: id },
      data: { Nombre: nombre },
    });

    await this.prisma.rol_Modulo_Permiso.deleteMany({ where: { Id_Rol: id } });

    if (esTotal) {
      const [modulos, permisos] = await Promise.all([
        this.prisma.modulos.findMany(),
        this.prisma.permisos.findMany(),
      ]);

      await Promise.all(
        modulos.flatMap((modulo) =>
          permisos.map((permiso) =>
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
    } else if (modulosPermisos?.length) {
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

    return { message: 'Rol actualizado correctamente', rolId: id };
  }

  async eliminarRol(id: number) {
    const rol = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
    if (!rol) throw new NotFoundException('Rol no encontrado');

    if (rol.delete_state) {
      return { message: 'Rol ya estaba eliminado', rolId: id };
    }

    await this.prisma.rol.update({
      where: { id_Rol: id },
      data: {
        delete_state: true,
        delete_at: new Date(),
      },
    });

    return { message: 'Rol eliminado (lógico) correctamente', rolId: id };
  }

  async restaurarRol(id: number) {
    const rol = await this.prisma.rol.findUnique({ where: { id_Rol: id } });
    if (!rol) throw new NotFoundException('Rol no encontrado');

    if (!rol.delete_state) {
      return { message: 'El rol no está eliminado', rolId: id };
    }

    await this.prisma.rol.update({
      where: { id_Rol: id },
      data: {
        delete_state: false,
        delete_at: null,
      },
    });

    return { message: 'Rol restaurado correctamente', rolId: id };
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
        Usuario_Rol: { include: { Rol: true } },
      },
    });
    if (!usuario) throw new Error('Usuario no encontrado');

    const idsRolesUsuario = usuario.Usuario_Rol
      .map((ur) => ur.Id_Rol)
      .filter((id): id is bigint => id !== null);

    const esAdmin = usuario.Usuario_Rol.some(
      (ur) => ur.Rol?.Nombre?.toLowerCase() === 'admin'
    );

    // filtro base: excluir roles borrados lógicamente
    const baseWhere: any = {
      delete_state: { not: true }, // trae delete_state false o null
      id_Rol: { notIn: idsRolesUsuario },
    };

    let rolesDB: any[] = [];
    if (esAdmin) {
      rolesDB = await this.prisma.rol.findMany({
        where: baseWhere,
        include: {
          rol_Modulo_Permiso: { include: { Modulos: true, Permisos: true } },
        },
        orderBy: { id_Rol: 'asc' },
      });
    } else {
      rolesDB = await this.prisma.rol.findMany({
        where: {
          ...baseWhere,
          Nombre: { not: 'Admin' },
        },
        include: {
          rol_Modulo_Permiso: { include: { Modulos: true, Permisos: true } },
        },
        orderBy: { id_Rol: 'asc' },
      });
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
