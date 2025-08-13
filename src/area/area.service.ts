import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class AreaService {
  constructor(private prisma: PrismaService) {}

  // ========= CREATE =========
  async createArea(body: any) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const newArea = await tx.area.create({
          data: {
            nombre_area: body.nombre_area,
            estado: true,
            delete_status: false, // <- default explícito
            delete_at: null,      // <- default explícito
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        if (Array.isArray(body.carreraIds) && body.carreraIds.length > 0) {
          const carreraAreaData = body.carreraIds.map((carreraId: number | string | bigint) => ({
            Id_Area: newArea.id_area,
            Id_Carrera: typeof carreraId === 'bigint' ? carreraId : BigInt(String(carreraId)),
          }));

          await tx.carrera_Area.createMany({ data: carreraAreaData });
        }

        const { created_at, updated_at, ...result } = newArea;
        return result;
      });
    } catch (error: any) {
      throw new Error(`Error creating area: ${error.message}`);
    }
  }

  // ========= LISTAR TODAS (con includeDeleted opcional) =========
  async getAllAreas({ page = 1, pageSize = 10, user, includeDeleted = false }) {
    try {
      const pageN = Number(page);
      const sizeN = Number(pageSize);
      const skip = (pageN - 1) * sizeN;
      const take = sizeN;

      const userId = typeof user === 'bigint' ? user : BigInt(String(user));

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: userId },
        include: { usuario_Carrera: true },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      // Ids de carrera del usuario (robusto con casings distintos)
      const carrerasIds = Array.from(
        new Set(
          (usuario.usuario_Carrera || [])
            .map((rc: any) => rc?.Id_Carrera ?? rc?.Id_carrera ?? rc?.id_carrera)
            .filter((id: any): id is bigint => id != null)
        )
      );
      if (carrerasIds.length === 0) {
        return { items: [], total: 0, page: pageN, pageSize: sizeN, totalPages: 0 };
      }

      // Áreas vinculadas a esas carreras
      const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
        where: { Id_Carrera: { in: carrerasIds } },
        select: { Id_Area: true },
      });

      const areaIds = Array.from(
        new Set(
          areaCarreraLinks
            .map((l) => l.Id_Area)
            .filter((id): id is bigint => id != null)
        )
      );
      if (areaIds.length === 0) {
        return { items: [], total: 0, page: pageN, pageSize: sizeN, totalPages: 0 };
      }

      const base = { id_area: { in: areaIds } };
      const whereBase = includeDeleted
        ? base
        : { ...base, delete_at: null, NOT: { delete_status: true } };

      const [total, areas] = await this.prisma.$transaction([
        this.prisma.area.count({ where: whereBase }),
        this.prisma.area.findMany({
          where: whereBase,
          skip,
          take,
          orderBy: { id_area: 'asc' },
          include: { carrera_Area: { include: { carrera: true } } },
        }),
      ]);

      const items = areas.map((area) => {
        const { created_at, updated_at, carrera_Area, ...result } = area;
        const carreras = (carrera_Area || [])
          .filter((ca) => ca.carrera != null)
          .map((ca) => ca.carrera!.nombre_carrera);
        return { ...result, carreras };
      });

      return {
        items,
        total,
        page: pageN,
        pageSize: sizeN,
        totalPages: Math.ceil(total / sizeN),
      };
    } catch (error: any) {
      throw new Error(`Error fetching areas: ${error.message}`);
    }
  }

  // ========= LISTAR FILTRADAS (respeta includeDeleted implícito = false) =========
  async getFiltredAreas({ page = 1, pageSize = 10, user, word = '' }) {
    try {
      const pageN = Number(page);
      const sizeN = Number(pageSize);
      const skip = (pageN - 1) * sizeN;
      const take = sizeN;

      const userId = typeof user === 'bigint' ? user : BigInt(String(user));
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: userId },
        include: { usuario_Carrera: true },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      const carrerasIds = Array.from(
        new Set(
          (usuario.usuario_Carrera || [])
            .map((rc: any) => rc?.Id_Carrera ?? rc?.Id_carrera ?? rc?.id_carrera)
            .filter((id: any): id is bigint => id != null)
        )
      );
      if (carrerasIds.length === 0) {
        return { items: [], total: 0, page: pageN, pageSize: sizeN, totalPages: 0 };
      }

      const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
        where: { Id_Carrera: { in: carrerasIds } },
        select: { Id_Area: true },
      });

      const areaIds = Array.from(
        new Set(areaCarreraLinks.map((l) => l.Id_Area).filter((id): id is bigint => id != null))
      );
      if (areaIds.length === 0) {
        return { items: [], total: 0, page: pageN, pageSize: sizeN, totalPages: 0 };
      }

      const whereClause: any = {
        id_area: { in: areaIds },
        delete_at: null,
        NOT: { delete_status: true },
      };
      if (word && String(word).trim() !== '') {
        whereClause.nombre_area = { contains: word, mode: 'insensitive' };
      }

      const [total, areas] = await this.prisma.$transaction([
        this.prisma.area.count({ where: whereClause }),
        this.prisma.area.findMany({
          where: whereClause,
          skip,
          take,
          orderBy: { id_area: 'asc' },
          include: { carrera_Area: { include: { carrera: true } } },
        }),
      ]);

      const items = areas.map((area) => {
        const { created_at, updated_at, carrera_Area, ...result } = area;
        const carreras = (carrera_Area || [])
          .filter((ca) => ca.carrera != null)
          .map((ca) => ca.carrera!.nombre_carrera);
        return { ...result, carreras };
      });

      return {
        items,
        total,
        page: pageN,
        pageSize: sizeN,
        totalPages: Math.ceil(total / sizeN),
      };
    } catch (error: any) {
      throw new Error(`Error fetching areas: ${error.message}`);
    }
  }

  // ========= UPDATE =========
  async updateArea(id: bigint, body: any) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updatedArea = await tx.area.update({
          where: { id_area: id },
          data: {
            nombre_area: body.nombre_area,
            updated_at: new Date(),
          },
        });

        if (Array.isArray(body.carreraIds)) {
          // si mandas [], desconecta todas; si no mandas, no toca relaciones
          await tx.carrera_Area.deleteMany({ where: { Id_Area: id } });

          if (body.carreraIds.length > 0) {
            const carreraAreaData = body.carreraIds.map((carreraId: number | string | bigint) => ({
              Id_Area: updatedArea.id_area,
              Id_Carrera: typeof carreraId === 'bigint' ? carreraId : BigInt(String(carreraId)),
            }));
            await tx.carrera_Area.createMany({ data: carreraAreaData });
          }
        }

        const { created_at, updated_at, ...result } = updatedArea;
        return result;
      });
    } catch (error: any) {
      throw new Error(`Error updating area: ${error.message}`);
    }
  }

  // ========= TOGGLE VISIBILIDAD (estado) =========
  async updateStateArea(id: bigint, body: any) {
    try {
      const updatedArea = await this.prisma.area.update({
        where: { id_area: id },
        data: {
          estado: body.estado,
          updated_at: new Date(),
        },
      });
      const { created_at, updated_at, ...result } = updatedArea;
      return result;
    } catch (error: any) {
      throw new Error(`Error updating area state: ${error.message}`);
    }
  }

  // ========= SOFT DELETE / RESTORE / TOGGLE (endpoint único) =========
  async deleteAndRestoreArea(id: bigint, body: any) {
    // Soft delete
    if (body.delete === true) {
      const updated = await this.prisma.area.update({
        where: { id_area: id },
        data: {
          delete_status: true,
          delete_at: new Date(),
          updated_at: new Date(),
        },
      });
      const { created_at, updated_at, ...result } = updated;
      return result;
    }

    // Restore (con validación de duplicados activos por nombre)
    if (body.delete === false) {
      const area = await this.prisma.area.findUnique({ where: { id_area: id } });
      if (!area) throw new Error('Área no encontrada');

      const dup = await this.prisma.area.findFirst({
        where: {
          id_area: { not: id },
          delete_at: null,
          NOT: { delete_status: true },
          nombre_area: { equals: area.nombre_area, mode: 'insensitive' },
        },
        select: { id_area: true },
      });
      if (dup) {
        throw new Error('No se puede restaurar: ya existe un área activa con ese nombre');
      }

      const restored = await this.prisma.area.update({
        where: { id_area: id },
        data: {
          delete_status: false,
          delete_at: null,
          updated_at: new Date(),
        },
      });
      const { created_at, updated_at, ...result } = restored;
      return result;
    }

    // Toggle estado (visible / no visible)
    if (typeof body.estado === 'boolean') {
      const updated = await this.prisma.area.update({
        where: { id_area: id },
        data: { estado: body.estado, updated_at: new Date() },
      });
      const { created_at, updated_at, ...result } = updated;
      return result;
    }

    throw new Error('Petición inválida para deleteAndRestoreArea');
  }
}
