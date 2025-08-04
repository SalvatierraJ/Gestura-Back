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

  async createEstudiantesMasivos(body: any) {
    try {
      const estudiantes = body.estudiantes || [];
      if (!Array.isArray(estudiantes) || estudiantes.length === 0) {
        throw new HttpException('Debes enviar al menos un estudiante', 400);
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
          // ✅ VERIFICAR DUPLICADOS (igual que en createEstudiantes)
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

          // ✅ CREAR USUARIO AUTOMÁTICAMENTE
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

  async getAllEstudiantes({ page, pageSize, user }) {
    try {
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      // 1. Obtener carreras que administra el usuario
      const usuario = await this.prisma.usuario.findUnique({
        where: { Id_Usuario: user },
        include: { usuario_Carrera: true }
      });

      if (!usuario) throw new Error("Usuario no encontrado");

      const carrerasIds = usuario.usuario_Carrera
        .map((rc) => rc.Id_carrera)
        .filter((id): id is bigint => !!id);

      if (carrerasIds.length === 0) return { items: [], total: 0, page, pageSize, totalPages: 0 };

      const requiredMaterias = await this.prisma.materia_carrera.findMany({
        where: { id_carrera: { in: carrerasIds } },
        select: { id_carrera: true, id_materia: true },
      });

      const materiasPorCarrera = new Map<bigint, Set<bigint>>();
      for (const { id_carrera, id_materia } of requiredMaterias) {
        if (!id_carrera || !id_materia) continue;
        if (!materiasPorCarrera.has(id_carrera)) {
          materiasPorCarrera.set(id_carrera, new Set());
        }
        materiasPorCarrera.get(id_carrera)!.add(id_materia);
      }

      if (materiasPorCarrera.size === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }

      const estudiantesAvanzados = await this.prisma.estudiante.findMany({
        where: {
          estudiante_Carrera: {
            some: { Id_Carrera: { in: carrerasIds } }
          }
        },
        select: {
          id_estudiante: true,
          _count: {
            select: {
              estudiantes_materia: {
                where: { estado: 'Aprobado' }
              }
            }
          }
        }
      });

      const idsAvanzados = estudiantesAvanzados
        .filter(estudiante => estudiante._count.estudiantes_materia >= 35)
        .map(estudiante => estudiante.id_estudiante);

      if (idsAvanzados.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      
      // 3. Obtener todos los estudiantes relevantes con sus materias aprobadas
      const potentialStudents = await this.prisma.estudiante.findMany({
        where: {
          id_estudiante: { in: idsAvanzados },
          estudiante_Carrera: { some: { Id_Carrera: { in: carrerasIds } } },
        },
        select: {
          id_estudiante: true,
          estudiante_Carrera: { select: { Id_Carrera: true } },
          estudiantes_materia: {
            where: { estado: 'Aprobado' },
            select: { id_materia: true },
          },
        },
      });

      // 4. Procesar en memoria para encontrar los IDs de los estudiantes que completaron una carrera
      const studentsWhoCompletedAllMaterias = potentialStudents
        .filter(student => {
          const studentApprovedMateriasIds = new Set(
            student.estudiantes_materia.map(m => m.id_materia).filter((id): id is bigint => !!id)
          );

          return student.estudiante_Carrera.some(ec => {
            const required = materiasPorCarrera.get(ec.Id_Carrera!);
            if (!required || required.size === 0) return false;

            return [...required].every(materiaId => studentApprovedMateriasIds.has(materiaId));
          });
        })
        .map(student => student.id_estudiante);

      const ids = [...new Set(studentsWhoCompletedAllMaterias)];

      if (ids.length === 0) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }

      // 5. Total y paginación
      const total = ids.length;
      const pageIds = ids.slice(skip, skip + take);

      // 6. Obtener datos detallados finales paginados
      const estudiantes = await this.prisma.estudiante.findMany({
        where: { id_estudiante: { in: pageIds } },
        include: {
          Persona: true,
          defensa: { include: { Tipo_Defensa: { select: { Nombre: true } } } },
          estudiante_Carrera: { include: { carrera: { select: { nombre_carrera: true } } } },
        },
      });

      // 7. Formatear la respuesta
      const items = estudiantes.map((estudiante) => {
        const { Persona, defensa, estudiante_Carrera, ...rest } = estudiante;
        const carreraNombre = estudiante_Carrera?.[0]?.carrera?.nombre_carrera || "";

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



   async getAllEstudiantesFiltred({ page, pageSize, user, word }: { page: number, pageSize: number, user: bigint, word?: string }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: {
                    usuario_Carrera: true
                },
            });

            if (!usuario) throw new Error('Usuario no encontrado');

            const carrerasIds = usuario.usuario_Carrera
                .map((rc) => rc.Id_carrera)
                .filter((id): id is bigint => id !== null && id !== undefined);

            if (carrerasIds.length === 0) {
                return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
            }

            const whereClause: any = {
                AND: [
                    {
                        estudiante_Carrera: {
                            some: {
                                Id_Carrera: { in: carrerasIds },
                            },
                        },
                    }
                ]
            };

            if (word && word.trim() !== '') {
                whereClause.AND.push({
                    OR: [
                        { Persona: { Nombre: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Apellido1: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Apellido2: { contains: word, mode: 'insensitive' } } },
                        { Persona: { CI: { contains: word, mode: 'insensitive' } } },
                        { Persona: { Correo: { contains: word, mode: 'insensitive' } } },
                        { nroRegistro: { contains: word, mode: 'insensitive' } },
                        {
                            estudiante_Carrera: {
                                some: {
                                    carrera: {
                                        nombre_carrera: {
                                            contains: word,
                                            mode: 'insensitive'
                                        }
                                    }
                                }
                            }
                        }
                    ]
                });
            }

            const total = await this.prisma.estudiante.count({
                where: whereClause,
            });

            const estudiantes = await this.prisma.estudiante.findMany({
                where: whereClause,
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
            console.error("Error en getAllEstudiantesFiltred:", error);
            throw new Error(`Error al obtener los estudiantes: ${error.message}`);
        }
    }
}
