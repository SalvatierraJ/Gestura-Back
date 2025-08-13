import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class CasosEstudioService {
  constructor(private prisma: PrismaService) {}

  // ----- Helpers -----
  private mapCaso(caso: any) {
    const { created_at, updated_at, ...result } = caso;
    return result;
  }

  // ----- Crear -----
  async createCasoEstudio(
    Titulo: string,
    Autor: string,
    Tema: string,
    Fecha_Creacion: Date,
    id_area: number,
    url: string
  ) {
    try {
      const newCasoEstudio = await this.prisma.casos_de_estudio.create({
        data: {
          Nombre_Archivo: Titulo,
          estado: true,
          fecha_Subida: Fecha_Creacion,
          id_area: id_area,
          url: url,
          delete_status: false,           // <-- no borrado
          delete_at: null,                // <-- sin fecha de borrado
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.prisma.metadatos.create({
        data: {
          Titulo,
          Autor,
          Tema,
          Fecha_Creacion,
          modelo_Origen: 'casos_de_estudio',
          Id_Origen: newCasoEstudio.id_casoEstudio,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      return this.mapCaso(newCasoEstudio);
    } catch (error: any) {
      throw new Error(`Error creating case study: ${error.message}`);
    }
  }

  // ----- Listado con filtro por palabra (excluye borrados) -----
  async getfiltredCasosEstudio({ page, pageSize, user, word }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: { usuario_Carrera: true },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      const carrerasIds = usuario.usuario_Carrera
        .map((rc) => rc.Id_carrera)
        .filter((id): id is bigint => id !== null && id !== undefined);

      if (carrerasIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0,
        };
      }

      const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
        where: { Id_Carrera: { in: carrerasIds } },
        select: { Id_Area: true },
      });

      const areaIds = [
        ...new Set(
          areaCarreraLinks
            .map((l) => l.Id_Area)
            .filter((id): id is bigint => id !== null && id !== undefined)
        ),
      ];
      if (areaIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0,
        };
      }

      const whereClause: any = {
        id_area: { in: areaIds },
        delete_status: { not: true },
        delete_at: null,             
        ...(word && {
          Nombre_Archivo: { contains: word, mode: 'insensitive' },
        }),
      };

      const total = await this.prisma.casos_de_estudio.count({ where: whereClause });

      const casosEstudio = await this.prisma.casos_de_estudio.findMany({
        where: whereClause,
        skip,
        take,
        include: { area: true },
        orderBy: { id_casoEstudio: 'desc' },
      });

      const metadatos = await this.prisma.metadatos.findMany({
        where: {
          modelo_Origen: 'casos_de_estudio',
          Id_Origen: { in: casosEstudio.map((c) => c.id_casoEstudio) },
        },
        select: {
          Id_Origen: true,
          Titulo: true,
          Autor: true,
          Tema: true,
          Fecha_Creacion: true,
        },
      });

      const items = casosEstudio
        .map((caso) => {
          const meta = metadatos.find((m) => m.Id_Origen === caso.id_casoEstudio);
          const { area, ...base } = this.mapCaso(caso);
          return { ...base, areaName: area?.nombre_area ?? null, ...(meta || {}) };
        })
        .filter(Boolean);

      return {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      throw new Error(`Error fetching case studies: ${error.message}`);
    }
  }

  // ----- Listado general (excluye borrados) -----
  async getAllCasosEstudio({ page, pageSize, user }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: { usuario_Carrera: true },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      const carrerasIds = usuario.usuario_Carrera
        .map((rc) => rc.Id_carrera)
        .filter((id): id is bigint => id !== null && id !== undefined);

      if (carrerasIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0,
        };
      }

      const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
        where: { Id_Carrera: { in: carrerasIds } },
        select: { Id_Area: true },
      });

      const areaIds = [
        ...new Set(
          areaCarreraLinks
            .map((l) => l.Id_Area)
            .filter((id): id is bigint => id !== null && id !== undefined)
        ),
      ];
      if (areaIds.length === 0) {
        return {
          items: [],
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0,
        };
      }

      const whereClause = {
        id_area: { in: areaIds },
        delete_status: { not: true }, // <-- excluye borrados
        delete_at: null,              // <-- excluye borrados
      };

      const total = await this.prisma.casos_de_estudio.count({ where: whereClause });

      const casosEstudio = await this.prisma.casos_de_estudio.findMany({
        where: whereClause,
        skip,
        take,
        include: { area: true },
        orderBy: { id_casoEstudio: 'desc' },
      });

      const metadatos = await this.prisma.metadatos.findMany({
        where: {
          modelo_Origen: 'casos_de_estudio',
          Id_Origen: { in: casosEstudio.map((c) => c.id_casoEstudio) },
        },
        select: {
          Id_Origen: true,
          Titulo: true,
          Autor: true,
          Tema: true,
          Fecha_Creacion: true,
        },
      });

      const items = casosEstudio
        .map((caso) => {
          const meta = metadatos.find((m) => m.Id_Origen === caso.id_casoEstudio);
          const { area, ...base } = this.mapCaso(caso);
          return { ...base, areaName: area?.nombre_area ?? null, ...(meta || {}) };
        })
        .filter(Boolean);

      return {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error: any) {
      throw new Error(`Error fetching case studies: ${error.message}`);
    }
  }

  // ----- Endpoint unificado: visibilidad o borrado/restauración -----
  async updateStateOrDeleteCasoEstudio(id: bigint, body: any) {
    // Borrado lógico
    if (body.delete === true) {
      const updated = await this.prisma.casos_de_estudio.update({
        where: { id_casoEstudio: id },
        data: {
          delete_status: true,
          delete_at: new Date(),
          updated_at: new Date(),
        },
      });
      return this.mapCaso(updated);
    }

    // Restaurar (con validación de duplicado por título en la misma área)
    if (body.delete === false) {
      const c = await this.prisma.casos_de_estudio.findUnique({
        where: { id_casoEstudio: id },
        select: { id_area: true, Nombre_Archivo: true },
      });
      if (!c) throw new Error('Caso de estudio no encontrado');

      const dup = await this.prisma.casos_de_estudio.findFirst({
        where: {
          id_casoEstudio: { not: id },
          delete_status: { not: true },
          delete_at: null,
          id_area: c.id_area,
          Nombre_Archivo: { equals: c.Nombre_Archivo, mode: 'insensitive' },
        },
        select: { id_casoEstudio: true },
      });
      if (dup) {
        throw new Error(
          'No se puede restaurar: ya existe un caso activo con ese título en la misma área'
        );
      }

      const restored = await this.prisma.casos_de_estudio.update({
        where: { id_casoEstudio: id },
        data: {
          delete_status: false,
          delete_at: null,
          updated_at: new Date(),
        },
      });
      return this.mapCaso(restored);
    }

    // Cambiar visibilidad
    if (typeof body.estado === 'boolean') {
      const updated = await this.prisma.casos_de_estudio.update({
        where: { id_casoEstudio: id },
        data: { estado: body.estado, updated_at: new Date() },
      });
      return this.mapCaso(updated);
    }

    throw new Error('Petición inválida para updateStateOrDeleteCasoEstudio');
  }

  // ----- Mantener edición (sin cambios funcionales) -----
  async updateCasoEstudio(
    id_casoEstudio: number,
    datos: {
      Titulo: string;
      Autor: string;
      Tema: string;
      Fecha_Creacion: Date;
      id_area: number;
    }
  ) {
    try {
      const updatedCaso = await this.prisma.casos_de_estudio.update({
        where: { id_casoEstudio },
        data: {
          Nombre_Archivo: datos.Titulo,
          fecha_Subida: datos.Fecha_Creacion,
          id_area: datos.id_area,
          updated_at: new Date(),
        },
      });

      await this.prisma.metadatos.updateMany({
        where: { modelo_Origen: 'casos_de_estudio', Id_Origen: id_casoEstudio },
        data: {
          Titulo: datos.Titulo,
          Autor: datos.Autor,
          Tema: datos.Tema,
          Fecha_Creacion: datos.Fecha_Creacion,
          updated_at: new Date(),
        },
      });

      return { success: true, data: updatedCaso };
    } catch (error: any) {
      throw new Error(`Error updating case study: ${error.message}`);
    }
  }


}
