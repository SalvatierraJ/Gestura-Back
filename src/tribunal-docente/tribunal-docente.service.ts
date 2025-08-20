import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class TribunalDocenteService {
  constructor(private prisma: PrismaService) {}

  private getCurrentGestion(): string {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; 

    if (currentMonth >= 1 && currentMonth <= 6) {
      return `${currentYear}-1`;
    } else {
      return `${currentYear}-2`;
    }
  }

  // ------------------- LISTADO (ADMIN / NO-ADMIN) -------------------
  async getTribunalesDocentes({ page = 1, pageSize = 10, user }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);
      const gestionActual = this.getCurrentGestion();

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: {
          usuario_Carrera: true,
          Usuario_Rol: { include: { Rol: true } },
        },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      const isAdmin = (usuario.Usuario_Rol || []).some(
        (ur) => ur.Rol?.Nombre === 'Admin'
      );

      const notDeleted = { delete_state: { not: true }, delete_at: null };

      if (isAdmin) {
        const total = await this.prisma.tribunal_Docente.count({
          where: notDeleted,
        });

        const tribunales = await this.prisma.tribunal_Docente.findMany({
          where: notDeleted,
          skip,
          take,
          include: {
            Persona: true,
            area_Tribunal: { include: { area: true } },
            horario_materia: {
              where: {
                gestion: gestionActual,
                estado: true,
              },
              include: {
                materia: {
                  select: {
                    nombre: true,
                    siglas_materia: true,
                    cod_materia: true,
                  },
                },
              },
            },
          },
        });

        const items = tribunales.map((t) => {
          const { created_at, updated_at, Persona, area_Tribunal, horario_materia, ...result } = t;
          const Nombre = Persona?.Nombre ?? null;
          const Apellido = Persona?.Apellido1 ?? null;
          const Apellido2 = Persona?.Apellido2 ?? null;
          const correo = Persona?.Correo ?? null;
          const telefono = Persona?.telefono ?? null;
          const ci = Persona?.CI ?? null;

          const areas = (area_Tribunal || [])
            .map((a) =>
              a.area ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area } : null
            )
            .filter(Boolean);

          const materias_horarios = (horario_materia || []).map((hm) => ({
            id_horario: hm.id_horario,
            materia_nombre: hm.materia?.nombre || 'Sin nombre',
            materia_siglas: hm.materia?.siglas_materia || 'Sin siglas',
            materia_codigo: hm.materia?.cod_materia || null,
            grupo: hm.grupo || 'Sin grupo',
            horario: hm.horario || 'Sin horario',
            turno: hm.turno || 'Sin turno',
            modalidad: hm.Modalidad || 'Sin modalidad',
            gestion: hm.gestion,
          }));

          return { 
            ...result, 
            Nombre, 
            Apellido, 
            Apellido2, 
            areas, 
            correo, 
            telefono, 
            ci,
            materias_horarios,
            gestion_actual: gestionActual,
          };
        });

        return {
          items,
          total,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: Math.ceil(total / pageSize),
        };
      }

      // --- NO-ADMIN: filtra por carreras del usuario -> áreas relacionadas ---
      const carrerasIds = (usuario.usuario_Carrera || [])
        .map((rc) => rc.Id_carrera)
        .filter((id): id is bigint => id != null);

      if (carrerasIds.length === 0) {
        return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
      }

      const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
        where: { Id_Carrera: { in: carrerasIds } },
        select: { Id_Area: true },
      });

      const areaIds = [
        ...new Set(
          areaCarreraLinks
            .map((l) => l.Id_Area)
            .filter((id): id is bigint => id != null)
        ),
      ];

      if (areaIds.length === 0) {
        return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
      }

      const whereUser = {
        ...notDeleted,
        area_Tribunal: { some: { id_area: { in: areaIds } } },
      };

      const total = await this.prisma.tribunal_Docente.count({ where: whereUser });

      const tribunales = await this.prisma.tribunal_Docente.findMany({
        where: whereUser,
        skip,
        take,
        include: {
          Persona: true,
          area_Tribunal: { include: { area: true } },
          horario_materia: {
            where: {
              gestion: gestionActual,
              estado: true,
            },
            include: {
              materia: {
                select: {
                  nombre: true,
                  siglas_materia: true,
                  cod_materia: true,
                },
              },
            },
          },
        },
      });

      const items = tribunales.map((t) => {
        const { created_at, updated_at, Persona, area_Tribunal, horario_materia, ...result } = t;
        const Nombre = Persona?.Nombre ?? null;
        const Apellido = Persona?.Apellido1 ?? null;
        const Apellido2 = Persona?.Apellido2 ?? null;
        const correo = Persona?.Correo ?? null;
        const telefono = Persona?.telefono ?? null;
        const ci = Persona?.CI ?? null;

        const areas = (area_Tribunal || [])
          .map((a) =>
            a.area ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area } : null
          )
          .filter(Boolean);

        const materias_horarios = (horario_materia || []).map((hm) => ({
          id_horario: hm.id_horario,
          materia_nombre: hm.materia?.nombre || 'Sin nombre',
          materia_siglas: hm.materia?.siglas_materia || 'Sin siglas',
          materia_codigo: hm.materia?.cod_materia || null,
          grupo: hm.grupo || 'Sin grupo',
          horario: hm.horario || 'Sin horario',
          turno: hm.turno || 'Sin turno',
          modalidad: hm.Modalidad || 'Sin modalidad',
          gestion: hm.gestion,
        }));

        return { 
          ...result, 
          Nombre, 
          Apellido, 
          Apellido2, 
          areas, 
          correo, 
          telefono, 
          ci,
          materias_horarios,
          gestion_actual: gestionActual,
        };
      });

      return {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      throw new Error(`Error fetching tribunales docentes: ${error.message}`);
    }
  }

  // ------------------- LISTADO FILTRADO -------------------
  async getTribunalesDocentesFiltred({
    page,
    pageSize,
    user,
    word,
  }: {
    page: number;
    pageSize: number;
    user: bigint;
    word?: string;
  }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: { usuario_Carrera: true, Usuario_Rol: { include: { Rol: true } } },
      });
      if (!usuario) throw new Error('Usuario no encontrado');

      const isAdmin = (usuario.Usuario_Rol || []).some(
        (ur) => ur.Rol?.Nombre === 'Admin'
      );

      const notDeleted = { delete_state: { not: true }, delete_at: null };

      // Base del where con no eliminados
      const whereClause: any = {
        AND: [
          notDeleted,
        ],
      };

      // Si NO es admin, limitamos a sus áreas
      if (!isAdmin) {
        const carrerasIds = (usuario.usuario_Carrera || [])
          .map((rc) => rc.Id_carrera)
          .filter((id): id is bigint => id != null);

        if (carrerasIds.length === 0) {
          return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
        }

        const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
          where: { Id_Carrera: { in: carrerasIds } },
          select: { Id_Area: true },
        });

        const areaIds = [
          ...new Set(
            areaCarreraLinks
              .map((l) => l.Id_Area)
              .filter((id): id is bigint => id != null)
          ),
        ];

        if (areaIds.length === 0) {
          return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
        }

        whereClause.AND.push({
          area_Tribunal: { some: { id_area: { in: areaIds } } },
        });
      }

      // Búsqueda por palabra (si viene)
      if (word && word.trim() !== '') {
        whereClause.AND.push({
          OR: [
            { Persona: { Nombre: { contains: word, mode: 'insensitive' } } },
            { Persona: { Apellido1: { contains: word, mode: 'insensitive' } } },
            { Persona: { Apellido2: { contains: word, mode: 'insensitive' } } },
            { Persona: { CI: { contains: word, mode: 'insensitive' } } },
            { Persona: { Correo: { contains: word, mode: 'insensitive' } } },
            {
              area_Tribunal: {
                some: {
                  area: { nombre_area: { contains: word, mode: 'insensitive' } },
                },
              },
            },
          ],
        });
      }

      const total = await this.prisma.tribunal_Docente.count({ where: whereClause });

      const tribunales = await this.prisma.tribunal_Docente.findMany({
        where: whereClause,
        skip,
        take,
        include: {
          Persona: true,
          area_Tribunal: { include: { area: true } },
        },
      });

      const items = tribunales.map((t) => {
        const { created_at, updated_at, Persona, area_Tribunal, ...result } = t;
        const Nombre = Persona?.Nombre ?? null;
        const Apellido = Persona?.Apellido1 ?? null;
        const Apellido2 = Persona?.Apellido2 ?? null;
        const correo = Persona?.Correo ?? null;
        const telefono = Persona?.telefono ?? null;
        const ci = Persona?.CI ?? null;

        const areas = (area_Tribunal || [])
          .map((a) =>
            a.area ? { nombre_area: a.area.nombre_area, id_area: a.area.id_area } : null
          )
          .filter(Boolean);

        return { ...result, Nombre, Apellido, Apellido2, areas, correo, telefono, ci };
      });

      return {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      console.error('Error en getTribunalesDocentesFiltred:', error);
      throw new Error(`Error al obtener los tribunales docentes: ${error.message}`);
    }
  }

  // ------------------- CREAR / ACTUALIZAR -------------------
  async createTribunalDocente(body: any) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const { Persona, area_especializacion } = body;

        const tipoTribunal = await tx.tipo_Tribunal.findFirst({
          where: { Nombre: 'Interno' },
        });
        if (!tipoTribunal) throw new Error('Tipo de tribunal no encontrado');

        const persona = await tx.persona.create({
          data: {
            Nombre: Persona.nombre,
            Apellido1: Persona.apellido1,
            Apellido2: Persona.apellido2,
            Correo: Persona.correo,
            CI: Persona.ci,
            telefono: Number(Persona.telefono),
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        const newTribunal = await tx.tribunal_Docente.create({
          data: {
            id_Persona: persona.Id_Persona,
            Id_TipoTribunal: tipoTribunal.id_TipoTribunal,
            estado: true,        
            created_at: new Date(),
            updated_at: new Date(),
          },
        });

        if (Array.isArray(area_especializacion) && area_especializacion.length > 0) {
          await tx.area_Tribunal.createMany({
            data: area_especializacion.map((area: number | string) => ({
              id_area: Number(area),
              id_Tribunal: newTribunal.id_tribunal,
              created_at: new Date(),
              updated_at: new Date(),
            })),
          });
        }

        return newTribunal;
      });
    } catch (error) {
      throw new Error(`Error creating tribunal docente: ${error.message}`);
    }
  }

  async updateTribunalDocente(id: number, body: any) {
    try {
      const tribunal = await this.prisma.tribunal_Docente.findUnique({
        where: { id_tribunal: id },
      });
      if (!tribunal) throw new Error('Tribunal docente no encontrado');

      const updatedTribunal = await this.prisma.tribunal_Docente.update({
        where: { id_tribunal: id },
        data: {
          updated_at: new Date(),
          area_Tribunal: {
            deleteMany: {},
            createMany: {
              data: (body.area_especializacion || []).map((area) => ({
                id_area: Number(area),
                created_at: new Date(),
                updated_at: new Date(),
              })),
            },
          },
          Persona: {
            update: {
              Nombre: body.Persona.nombre,
              Apellido1: body.Persona.apellido1,
              Apellido2: body.Persona.apellido2,
              Correo: body.Persona.correo,
              CI: body.Persona.ci,
              telefono: body.Persona.telefono,
              updated_at: new Date(),
            },
          },
        },
      });

      return updatedTribunal;
    } catch (error) {
      throw new Error(`Error updating tribunal docente: ${error.message}`);
    }
  }

  // ------------------- UNIFICADO: estado o borrado lógico -------------------
  async updateStateOrDeleteTribunalDocente(
    id: number,
    body: { estado?: boolean; delete?: boolean }
  ) {
    try {
      if (typeof body.delete === 'boolean') {
        if (body.delete === true) {
          const updated = await this.prisma.tribunal_Docente.update({
            where: { id_tribunal: id },
            data: {
              delete_state: true,
              delete_at: new Date(),
              updated_at: new Date(),
              estado: false, 
              Persona:{
                update: {
                  updated_at: new Date(),
                  delete_state: true,
                  delete_at: new Date(),
                }
              }
            },
          });
          const { created_at, updated_at, ...result } = updated;
          return result;
        } else {
          // Restauración
          const restored = await this.prisma.tribunal_Docente.update({
            where: { id_tribunal: id },
            data: {
              delete_state: false,
              delete_at: null,
              estado: true,
              updated_at: new Date(),
                Persona: {
                    update: {
                    delete_state: false,
                    delete_at: null,
                    updated_at: new Date(),
                    },
                },
            },
          });
          const { created_at, updated_at, ...result } = restored;
          return result;
        }
      }

      // (B) Cambiar visibilidad (estado)
      if (typeof body.estado === 'boolean') {
        const updated = await this.prisma.tribunal_Docente.update({
          where: { id_tribunal: id },
          data: { estado: body.estado, updated_at: new Date() },
        });
        const { created_at, updated_at, ...result } = updated;
        return result;
      }

      return {
        ok: false,
        message: 'Debes enviar exactamente uno de los campos: "estado" (boolean) o "delete" (boolean).',
      };
    } catch (error) {
      throw new Error(`Error actualizando tribunal docente: ${error.message}`);
    }
  }
}
