import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EstudianteService {
  constructor(private prisma: PrismaService) {}

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
            // ✅ VERIFICAR SI YA EXISTE POR CI
            const estudiantePorCI = await this.prisma.estudiante.findFirst({
              where: {
                Persona: {
                  CI: String(estudiante.ci),
                },
              },
              include: { Persona: true },
            });

            if (estudiantePorCI) {
              return {
                error: true,
                tipo: 'CI_DUPLICADO',
                mensaje: `Ya existe un estudiante registrado con el CI: ${estudiante.ci}`,
                datos: estudiante,
              };
            }

            // ✅ VERIFICAR SI YA EXISTE POR CORREO
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

            // ✅ VERIFICAR SI YA EXISTE POR NÚMERO DE REGISTRO
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

            // ✅ VALIDAR CAMPOS OBLIGATORIOS
            if (!estudiante.correo || estudiante.correo.trim() === '') {
              return {
                error: true,
                tipo: 'CORREO_FALTANTE',
                mensaje: 'El correo es obligatorio y no puede estar vacío',
                datos: estudiante,
              };
            }

            // ✅ CREAR ESTUDIANTE (solo si pasa todas las validaciones)
            const nuevoEstudiante = await this.prisma.estudiante.create({
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
                    Id_Carrera: Number(estudiante.carrera),
                  },
                },
                created_at: new Date(),
                updated_at: new Date(),
              },
              include: { Persona: true },
            });

            // ✅ CREAR USUARIO AUTOMÁTICAMENTE
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

      // ✅ SEPARAR RESULTADOS EXITOSOS Y CON ERRORES
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

  async getAllEstudiantes({ page, pageSize, user }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      // 1. Obtener carreras que administra el usuario
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: {
          Usuario_Rol: {
            include: {
              Rol: {
                include: {
                  rol_Carrera: true,
                },
              },
            },
          },
        },
      });

      if (!usuario) throw new Error('Usuario no encontrado');

      const carrerasIds = usuario.Usuario_Rol.flatMap(
        (ur) => ur.Rol?.rol_Carrera || [],
      )
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

      // 2. Buscar solo estudiantes de esas carreras (usando la tabla intermedia estudiante_Carrera)
      const total = await this.prisma.estudiante.count({
        where: {
          estudiante_Carrera: {
            some: {
              Id_Carrera: { in: carrerasIds },
            },
          },
        },
      });

      const estudiantes = await this.prisma.estudiante.findMany({
        where: {
          estudiante_Carrera: {
            some: {
              Id_Carrera: { in: carrerasIds },
            },
          },
        },
        skip,
        take,
        include: {
          Persona: true,
          defensa: {
            include: {
              Tipo_Defensa: {
                select: {
                  Nombre: true,
                },
              },
            },
          },
          estudiante_Carrera: {
            include: {
              carrera: {
                select: {
                  nombre_carrera: true,
                },
              },
            },
          },
        },
      });

      const items = estudiantes.map((estudiante) => {
        const { Persona, defensa, estudiante_Carrera, ...rest } = estudiante;
        const carreraNombre =
          estudiante_Carrera && estudiante_Carrera.length > 0
            ? estudiante_Carrera[0]?.carrera?.nombre_carrera || ''
            : '';

        return {
          ...rest,
          nombre: Persona?.Nombre || '',
          apellido1: Persona?.Apellido1 || '',
          apellido2: Persona?.Apellido2 || '',
          correo: Persona?.Correo || '',
          telefono: Persona?.telefono || '',
          ci: Persona?.CI || '',
          carrera: carreraNombre,
          defensas: (defensa || []).map((d) => ({
            id_defensa: d.id_defensa,
            estado: d.estado,
            nombre_tipo_defensa: d.Tipo_Defensa?.Nombre || '',
            fecha_defensa: d.fecha_defensa,
          })),
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
      throw new Error(`Error fetching estudiantes: ${error.message}`);
    }
  }
}
