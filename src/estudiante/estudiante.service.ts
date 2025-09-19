import { Persona } from './../../node_modules/.prisma/client/index.d';
import { Injectable, HttpException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EstudianteService {
  constructor(private prisma: PrismaService) { }

  async createEstudiantes(body: any) {
    try {
      const estudiantes = body.estudiantes || [];
      if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
        throw new Error('Debes enviar al menos un estudiante');
      }

      // Buscar el rol "Estudiante"
      const rolEstudiante = await this.prisma.rol.findFirst({
        where: {
          Nombre: {
            mode: 'insensitive',
            equals: 'estudiante',
          },
        },
      });

      if (!rolEstudiante) {
        throw new Error('Rol "Estudiante" no encontrado en la base de datos');
      }

      const resultados = await Promise.all(
        estudiantes.map(async (estudiante) => {
          try {
               // Solo verificar CI duplicado si el CI no es null, undefined o vacio
            let estudiantePorCI: any = null;
            if (estudiante.ci !== null && estudiante.ci !== undefined && String(estudiante.ci).trim() !== "") {
              estudiantePorCI = await this.prisma.estudiante.findFirst({
                where: {
                  Persona: {
                    CI: String(estudiante.ci),
                  },
                },
                include: { Persona: true },
              });
            }

            if (estudiantePorCI) {
              return {
                error: true,
                tipo: 'CI_DUPLICADO',
                mensaje: `Ya existe un estudiante registrado con el CI: ${estudiante.ci}`,
                datos: estudiante,
              };
            }

            const estudiantePorCorreo = await this.prisma.persona.findFirst({
              where: {
                Correo: estudiante.correo,
              },
            });

            if (estudiantePorCorreo) {
              return {
                error: true,
                tipo: 'CORREO_DUPLICADO',
                mensaje: `Ya hay un estudiante registrado con ese correo: ${estudiante.correo}`,
                datos: estudiante,
              };
            }

            const estudiantePorRegistro =
              await this.prisma.estudiante.findFirst({
                where: {
                  nroRegistro: String(estudiante.numeroregistro),
                },
              });

            if (estudiantePorRegistro) {
              return {
                error: true,
                tipo: 'REGISTRO_DUPLICADO',
                mensaje: `Ya existe un estudiante con el número de registro: ${estudiante.numeroregistro}`,
                datos: estudiante,
              };
            }

            if (!estudiante.correo || estudiante.correo.trim() === '') {
              return {
                error: true,
                tipo: 'CORREO_FALTANTE',
                mensaje: 'El correo es obligatorio y no puede estar vacío',
                datos: estudiante,
              };
            }

            const nuevoEstudiante = await this.prisma.estudiante.create({
              data: {
                nroRegistro: String(estudiante.numeroregistro),
                estado: 'EGRESADO',
                Persona: {
                  create: {
                    Nombre: estudiante.nombre,
                    Apellido1: estudiante.apellido1,
                    Apellido2: estudiante.apellido2,
                    Correo: estudiante.correo,
                    telefono: Number(estudiante.telefono),
                    CI: String(estudiante.ci),
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                },
                estudiante_Carrera: {
                  create: {
                    Id_Carrera: Number(estudiante.carrera),
                  },
                },
                created_at: new Date(),
                updated_at: new Date(),
              },
              include: { Persona: true },
            });

            await this.crearUsuarioParaEstudiante(
              nuevoEstudiante.Persona!,
              estudiante.numeroregistro,
              rolEstudiante.id_Rol,
            );

            return {
              error: false,
              tipo: 'EXITO',
              mensaje: 'Estudiante y usuario creados exitosamente',
              datos: nuevoEstudiante,
            };
          } catch (error) {
            return {
              error: true,
              tipo: 'ERROR_SERVIDOR',
              mensaje: `Error al procesar estudiante: ${error.message}`,
              datos: estudiante,
            };
          }
        }),
      );

      const exitosos = resultados.filter((r) => !r.error);
      const conErrores = resultados.filter((r) => r.error);

      return {
        total: resultados.length,
        exitosos: exitosos.length,
        errores: conErrores.length,
        resultados: {
          creados: exitosos,
          errores: conErrores,
        },
      };
    } catch (error) {
      throw new Error(`Error creating estudiantes: ${error.message}`);
    }
  }

  async createEstudiantesMasivos(body: any) {
    try {
      const estudiantes = body.estudiantes || [];
      if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
        throw new HttpException('Debes enviar al menos un estudiante', 400);
      }

      const rolEstudiante = await this.prisma.rol.findFirst({
        where: {
          Nombre: {
            mode: 'insensitive',
            equals: 'estudiante',
          },
        },
      });

      if (!rolEstudiante) {
        throw new HttpException(
          'Rol "Estudiante" no encontrado en la base de datos',
          400,
        );
      }

      const carrerasUnicas = [
        ...new Set(estudiantes.map((e) => e.carrera.trim())),
      ];
      const carrerasDb = await this.prisma.carrera.findMany({
        where: { nombre_carrera: { in: carrerasUnicas } },
      });

      const carreraMap = {};
      carrerasDb.forEach((c) => {
        carreraMap[c.nombre_carrera.trim()] = c.id_carrera;
      });

      type Fallido = {
        estudiante: any;
        motivo: string;
      };

      type Exitoso = {
        estudiante: any;
        id: number | string;
        mensaje: string;
      };

      const exitosos: Exitoso[] = [];
      const fallidos: Fallido[] = [];

      for (const estudiante of estudiantes) {
        try {
          const estudiantePorCI = await this.prisma.estudiante.findFirst({
            where: {
              Persona: { CI: String(estudiante.ci) },
            },
          });

          if (estudiantePorCI) {
            fallidos.push({
              estudiante,
              motivo: `Ya existe un estudiante con CI: ${estudiante.ci}`,
            });
            continue;
          }

          const estudiantePorCorreo = await this.prisma.persona.findFirst({
            where: { Correo: estudiante.correo },
          });

          if (estudiantePorCorreo) {
            fallidos.push({
              estudiante,
              motivo: `Ya existe una persona con correo: ${estudiante.correo}`,
            });
            continue;
          }

          const estudiantePorRegistro = await this.prisma.estudiante.findFirst({
            where: { nroRegistro: String(estudiante.numeroregistro) },
          });

          if (estudiantePorRegistro) {
            fallidos.push({
              estudiante,
              motivo: `Ya existe un estudiante con número de registro: ${estudiante.numeroregistro}`,
            });
            continue;
          }

          // Verificar carrera
          const idCarrera = carreraMap[estudiante.carrera.trim()];
          if (!idCarrera) {
            fallidos.push({
              estudiante,
              motivo: `Carrera no encontrada: ${estudiante.carrera}`,
            });
            continue;
          }

          // Crear estudiante
          const creado = await this.prisma.estudiante.create({
            data: {
              nroRegistro: String(estudiante.numeroregistro),
              Persona: {
                create: {
                  Nombre: estudiante.nombre,
                  Apellido1: estudiante.apellido1,
                  Apellido2: estudiante.apellido2,
                  Correo: estudiante.correo,
                  telefono: Number(estudiante.telefono),
                  CI: String(estudiante.ci),
                  created_at: new Date(),
                  updated_at: new Date(),
                },
              },
              estudiante_Carrera: {
                create: {
                  Id_Carrera: idCarrera,
                },
              },
              created_at: new Date(),
              updated_at: new Date(),
            },
            include: { Persona: true },
          });

          await this.crearUsuarioParaEstudiante(
            creado.Persona!,
            estudiante.numeroregistro,
            rolEstudiante.id_Rol,
          );

          exitosos.push({
            estudiante: estudiante,
            id: Number(creado.id_estudiante),
            mensaje: 'Estudiante y usuario creados correctamente',
          });
        } catch (err) {
          fallidos.push({
            estudiante,
            motivo: `Error al guardar: ${err.message}`,
          });
        }
      }

      return {
        exitosos,
        fallidos,
        resumen: `Guardados: ${exitosos.length}, Fallidos: ${fallidos.length}`,
      };
    } catch (error) {
      throw new HttpException(
        `Error creando estudiantes: ${error.message}`,
        400,
      );
    }
  }

  private async crearUsuarioParaEstudiante(
    persona: any,
    numeroRegistro: string,
    rolId: bigint,
  ) {
    try {
      const nombreUsuario = this.generarNombreUsuario(persona.Correo);

      const usuarioExistente = await this.prisma.usuario.findFirst({
        where: { Nombre_Usuario: nombreUsuario },
      });

      if (usuarioExistente) {
        console.log(`Usuario ${nombreUsuario} ya existe, omitiendo creación`);
        return usuarioExistente;
      }

      const salt = await bcrypt.genSalt();
      const passwordHasheada = await bcrypt.hash(numeroRegistro, salt);

      const nuevoUsuario = await this.prisma.usuario.create({
        data: {
          Nombre_Usuario: nombreUsuario,
          Password: passwordHasheada,
          Id_Persona: persona.Id_Persona,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await this.prisma.usuario_Rol.create({
        data: {
          Id_Usuario: nuevoUsuario.Id_Usuario,
          Id_Rol: rolId,
        },
      });

      console.log(
        `Usuario creado: ${nombreUsuario} con contraseña: ${numeroRegistro}`,
      );

      return nuevoUsuario;
    } catch (error) {
      console.error(`Error creando usuario para estudiante:`, error);
      throw new Error(`Error al crear usuario: ${error.message}`);
    }
  }

  private generarNombreUsuario(correo: string): string {
    const parteLocal = correo.split('@')[0];
    return parteLocal.toLowerCase();
  }

  async updateEstudiante(id: number, body: any) {
    try {
      const estudiante = await this.prisma.estudiante.findUnique({
        where: { id_estudiante: id },
      });
      if (!estudiante) {
        throw new Error('Estudiante not found');
      }

      const updatedEstudiante = await this.prisma.estudiante.update({
        where: { id_estudiante: id },
        data: {
          nroRegistro: body.numeroregistro,
          updated_at: new Date(),
          Persona: {
            update: {
              Nombre: body.nombre,
              Apellido1: body.apellido1,
              Apellido2: body.apellido2,
              Correo: body.correo,
              telefono: body.telefono,
              CI: body.ci,
              updated_at: new Date(),
            },
          },
        },
      });

      return updatedEstudiante;
    } catch (error) {
      throw new Error(`Error updating estudiante: ${error.message}`);
    }
  }
  async getAllEstudiantes({
    page = 1,
    pageSize = 10,
    user,
    word,
  }: {
    page?: number;
    pageSize?: number;
    user: bigint | number;
    word?: string;
  }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user as any },
        include: {
          usuario_Carrera: true,
          Usuario_Rol: { include: { Rol: true } },
        },
      });
      if (!usuario) throw new Error("Usuario no encontrado");

      const isAdmin = (usuario.Usuario_Rol || []).some(
        (ur) => ur.Rol?.Nombre === "Admin"
      );

      const ESTADOS_OBJETIVO = [
        "EGRESADO",
        "HABILITADOS PARA DEFENSA",
        "HABILITADO PARA DEFENSA",
      ];

      const whereBase: any = {
        AND: [
          { estado: { in: ESTADOS_OBJETIVO } },
          { delete_state: { not: true } },
          { delete_at: null },
        ],
      };

      if (word && word.trim() !== "") {
        const w = word.trim();
        whereBase.AND.push({
          OR: [
            { Persona: { Nombre: { contains: w, mode: "insensitive" } } },
            { Persona: { Apellido1: { contains: w, mode: "insensitive" } } },
            { Persona: { Apellido2: { contains: w, mode: "insensitive" } } },
            { Persona: { CI: { contains: w, mode: "insensitive" } } },
            { Persona: { Correo: { contains: w, mode: "insensitive" } } },
            {
              estudiante_Carrera: {
                some: {
                  carrera: {
                    nombre_carrera: { contains: w, mode: "insensitive" },
                  },
                },
              },
            },
          ],
        });
      }

      if (!isAdmin) {
        const carrerasIds = (usuario.usuario_Carrera || [])
          .map((rc) => rc.Id_carrera)
          .filter((id): id is bigint => id != null);

        if (carrerasIds.length === 0) {
          return {
            items: [],
            total: 0,
            page: Number(page),
            pageSize: Number(pageSize),
            totalPages: 0,
          };
        }

        whereBase.AND.push({
          estudiante_Carrera: {
            some: {
              Id_Carrera: { in: carrerasIds as any },
              delete_state: { not: true },
              delete_at: null,
            },
          },
        });
      }

      const total = await this.prisma.estudiante.count({ where: whereBase });

      const estudiantes = await this.prisma.estudiante.findMany({
        where: whereBase,
        skip,
        take,
        orderBy: { id_estudiante: "asc" },
        include: {
          Persona: true,
          defensa: {
            include: { Tipo_Defensa: { select: { Nombre: true } } },
          },
          estudiante_Carrera: {
            include: { carrera: { select: { nombre_carrera: true } } },
          },
        },
      });

      const items = estudiantes.map((e) => {
        const { Persona, defensa, estudiante_Carrera, ...rest } = e;
        const carreraNombre =
          estudiante_Carrera?.[0]?.carrera?.nombre_carrera || "";

        return {
          ...rest,
          nombre: Persona?.Nombre || "",
          apellido1: Persona?.Apellido1 || "",
          apellido2: Persona?.Apellido2 || "",
          correo: Persona?.Correo || "",
          telefono: Persona?.telefono || "",
          ci: Persona?.CI || "",
          carrera: carreraNombre,
          defensas: (defensa || []).map((d) => ({
            id_defensa: d.id_defensa,
            estado: d.estado,
            nombre_tipo_defensa: d.Tipo_Defensa?.Nombre || "",
            fecha_defensa: d.fecha_defensa,
          })),
        };
      });

      return {
        items,
        total,
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(total / Number(pageSize)),
      };
    } catch (error: any) {
      throw new Error(`Error fetching estudiantes: ${error.message}`);
    }
  }



  async updateStateOrDeleteEstudiante(
    id: number | bigint,
    body: { estado?: boolean; delete?: boolean },
  ) {
    const hasEstado = typeof body?.estado === 'boolean';
    const hasDelete = typeof body?.delete === 'boolean';

    if (hasEstado === hasDelete) {
      return 'Debes enviar exactamente uno de los campos: "estado" (boolean) o "delete" (boolean).';
    }

    const existente = await this.prisma.estudiante.findUnique({
      where: { id_estudiante: Number(id) },
      select: { id_estudiante: true },
    });
    if (!existente) throw new Error('Estudiante no encontrado');

    if (hasEstado) {
      const updated = await this.prisma.estudiante.update({
        where: { id_estudiante: Number(id) },
        data: {
          updated_at: new Date(),
        },
      });
      return updated;
    }

    if (body.delete === true) {
      const updated = await this.prisma.estudiante.update({
        where: { id_estudiante: Number(id) },
        data: {
          delete_state: true,
          delete_at: new Date(),
          updated_at: new Date(),
          Persona: {
            update: {
              delete_state: true,
              delete_at: new Date(),
              updated_at: new Date(),
            }
          },
        }
      });
      return updated;
    } else {
      const updated = await this.prisma.estudiante.update({
        where: { id_estudiante: Number(id) },
        data: {
          delete_state: false,
          delete_at: null,
          updated_at: new Date(),
          Persona: {
            update: {
              delete_state: false,
              delete_at: null,
              updated_at: new Date(),
            }
          },
        },
      });
      return updated;
    }
  }

  async softDeleteEstudiante(id: number | bigint) {
    return this.updateStateOrDeleteEstudiante(id, { delete: true });
  }
  async restoreEstudiante(id: number | bigint) {
    return this.updateStateOrDeleteEstudiante(id, { delete: false });
  }
}
