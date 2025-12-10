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
      // Aceptar múltiples formatos
      let estudiantes: any[] = [];
      
      // Verificar si es un objeto único con formato nuevo (no array)
      if (!Array.isArray(body) && body.persona && body.nroRegistro) {
        // Formato nuevo: objeto único con persona, nroRegistro, carreraId, materias
        estudiantes = [body];
      } else if (Array.isArray(body)) {
        // Array directo - puede contener formato nuevo o formato original
        estudiantes = body.filter(est => est != null); // Filtrar elementos null/undefined
      } else if (body.estudiantes && Array.isArray(body.estudiantes)) {
        // Formato original: { estudiantes: [...] }
        estudiantes = body.estudiantes.filter(est => est != null);
      } else {
        throw new HttpException('Formato de datos inválido. Debe ser un array de estudiantes o un objeto con estructura válida', 400);
      }

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

      // Normalizar estudiantes: convertir formato nuevo al formato interno
      estudiantes = estudiantes.map((est) => {
        if (!est || typeof est !== 'object') {
          return est; // Mantener elementos inválidos para que fallen en validación posterior
        }
        
        // Si tiene formato nuevo (persona, nroRegistro, carreraId)
        if (est.persona && est.nroRegistro) {
          return {
            registro: est.nroRegistro,
            numeroregistro: est.nroRegistro,
            nombre: (est.persona && est.persona.nombre) || '',
            apellido: (est.persona && est.persona.apellido1) || '',
            apellido1: (est.persona && est.persona.apellido1) || '',
            apellido2: (est.persona && est.persona.apellido2) || '',
            ci: (est.persona && est.persona.ci) || '',
            correo: (est.persona && est.persona.correo) || '',
            telefono: (est.persona && est.persona.telefono) || '',
            carrera: est.carrera || '',
            carreraId: est.carreraId,
            materias: est.materias || [],
          };
        }
        // Formato original - mantener como está
        return est;
      }).filter(est => est != null); // Filtrar cualquier elemento null que pueda haber quedado

      // Obtener carreras por nombre o por ID
      const carrerasUnicas = [
        ...new Set(estudiantes.map((e) => (e.carrera || '').trim()).filter(Boolean)),
      ];
      const carreraIds = [
        ...new Set(estudiantes.map((e) => e.carreraId).filter((id) => id != null && id !== '')),
      ];

      const carrerasDb = await this.prisma.carrera.findMany({
        where: {
          OR: [
            ...(carrerasUnicas.length > 0 ? [{ nombre_carrera: { in: carrerasUnicas } }] : []),
            ...(carreraIds.length > 0 ? [{ id_carrera: { in: carreraIds.map((id) => BigInt(Number(id))) } }] : []),
          ],
        },
      });

      const carreraMap = {};
      carrerasDb.forEach((c) => {
        carreraMap[c.nombre_carrera.trim()] = Number(c.id_carrera);
        carreraMap[String(c.id_carrera)] = Number(c.id_carrera);
      });

      type Fallido = {
        estudiante: any;
        motivo: string;
      };

      type Exitoso = {
        estudiante: any;
        id: number | string;
        mensaje: string;
        accion: 'creado' | 'actualizado';
      };

      const exitosos: Exitoso[] = [];
      const fallidos: Fallido[] = [];

      for (const estudiante of estudiantes) {
        try {
          // Normalizar datos del estudiante
          const registro = String(estudiante.registro || estudiante.numeroregistro || estudiante.nroRegistro || '').trim();
          
          if (!registro) {
            fallidos.push({
              estudiante,
              motivo: 'Número de registro es requerido',
            });
            continue;
          }

          // Buscar estudiante por número de registro (prioridad)
          let estudianteExistente = await this.prisma.estudiante.findFirst({
            where: { nroRegistro: registro },
            include: { 
              Persona: true,
              estudiante_Carrera: true,
            },
          });

          // Obtener carrera
          let idCarrera: number | null = null;
          if (estudiante.carreraId) {
            idCarrera = Number(estudiante.carreraId);
            if (!carreraMap[String(idCarrera)]) {
              fallidos.push({
                estudiante,
                motivo: `Carrera con ID no encontrada: ${idCarrera}`,
              });
              continue;
            }
          } else if (estudiante.carrera) {
            const carreraId = carreraMap[estudiante.carrera.trim()];
            if (!carreraId) {
              fallidos.push({
                estudiante,
                motivo: `Carrera no encontrada: ${estudiante.carrera}`,
              });
              continue;
            }
            idCarrera = carreraId;
          }

          if (estudianteExistente) {
            // ACTUALIZAR estudiante existente
            const datosPersona: any = {
              updated_at: new Date(),
            };

            // Actualizar solo campos que vienen y no están vacíos
            if (estudiante.nombre) datosPersona.Nombre = estudiante.nombre;
            if (estudiante.apellido || estudiante.apellido1) datosPersona.Apellido1 = estudiante.apellido || estudiante.apellido1;
            if (estudiante.apellido2 !== undefined) datosPersona.Apellido2 = estudiante.apellido2 || '';
            if (estudiante.correo !== undefined) datosPersona.Correo = estudiante.correo || '';
            if (estudiante.ci !== undefined) datosPersona.CI = estudiante.ci || '';
            if (estudiante.telefono !== undefined && estudiante.telefono !== '') {
              datosPersona.telefono = BigInt(Number(estudiante.telefono));
            }

            // Actualizar persona
            if (Object.keys(datosPersona).length > 1 && estudianteExistente.id_Persona) {
              await this.prisma.persona.update({
                where: { Id_Persona: estudianteExistente.id_Persona },
                data: datosPersona,
              });
            }

            // Verificar y crear relación con carrera si no existe
            if (idCarrera) {
              const tieneCarrera = estudianteExistente.estudiante_Carrera?.some(
                (ec) => Number(ec.Id_Carrera) === idCarrera
              );

              if (!tieneCarrera) {
                await this.prisma.estudiante_Carrera.create({
                  data: {
                    Id_Estudiante: estudianteExistente.id_estudiante,
                    Id_Carrera: BigInt(idCarrera),
                  },
                });
              }
            }

            // Verificar y crear usuario si no existe
            const idPersona = estudianteExistente.id_Persona;
            if (!idPersona) {
              fallidos.push({
                estudiante,
                motivo: 'Estudiante sin persona asociada',
              });
              continue;
            }

            const usuarioExistente = await this.prisma.usuario.findFirst({
              where: { Id_Persona: idPersona },
              include: {
                Usuario_Rol: {
                  where: { Id_Rol: rolEstudiante.id_Rol },
                },
              },
            });

            if (!usuarioExistente) {
              if (estudianteExistente.Persona) {
                await this.crearUsuarioParaEstudiante(
                  estudianteExistente.Persona,
                  registro,
                  rolEstudiante.id_Rol,
                );
              }
            } else if (usuarioExistente.Usuario_Rol && usuarioExistente.Usuario_Rol.length === 0) {
              await this.prisma.usuario_Rol.create({
                data: {
                  Id_Usuario: usuarioExistente.Id_Usuario,
                  Id_Rol: rolEstudiante.id_Rol,
                },
              });
            }

            // Procesar materias si vienen
            if (estudiante.materias && Array.isArray(estudiante.materias) && estudiante.materias.length > 0 && idCarrera) {
              await this.procesarMateriasEstudiante(estudianteExistente.id_estudiante, idCarrera, estudiante.materias);
            }

            exitosos.push({
              estudiante: estudiante,
              id: Number(estudianteExistente.id_estudiante),
              mensaje: 'Estudiante actualizado correctamente',
              accion: 'actualizado',
            });
          } else {
            // CREAR nuevo estudiante
            if (!idCarrera) {
              fallidos.push({
                estudiante,
                motivo: `Carrera no especificada o no encontrada`,
              });
              continue;
            }

            if (!estudiante.nombre || !(estudiante.apellido || estudiante.apellido1)) {
              fallidos.push({
                estudiante,
                motivo: 'Nombre y apellido son requeridos para crear un nuevo estudiante',
              });
              continue;
            }

            const creado = await this.prisma.estudiante.create({
              data: {
                nroRegistro: registro,
                Persona: {
                  create: {
                    Nombre: estudiante.nombre,
                    Apellido1: estudiante.apellido || estudiante.apellido1,
                    Apellido2: estudiante.apellido2 || '',
                    Correo: estudiante.correo || '',
                    telefono: estudiante.telefono ? BigInt(Number(estudiante.telefono)) : null,
                    CI: estudiante.ci || '',
                    created_at: new Date(),
                    updated_at: new Date(),
                  },
                },
                estudiante_Carrera: idCarrera ? {
                  create: {
                    Id_Carrera: BigInt(idCarrera),
                  },
                } : undefined,
                created_at: new Date(),
                updated_at: new Date(),
              },
              include: { Persona: true },
            });

            await this.crearUsuarioParaEstudiante(
              creado.Persona!,
              registro,
              rolEstudiante.id_Rol,
            );

            // Procesar materias si vienen
            if (estudiante.materias && Array.isArray(estudiante.materias) && estudiante.materias.length > 0 && idCarrera) {
              await this.procesarMateriasEstudiante(creado.id_estudiante, idCarrera, estudiante.materias);
            }

            exitosos.push({
              estudiante: estudiante,
              id: Number(creado.id_estudiante),
              mensaje: 'Estudiante y usuario creados correctamente',
              accion: 'creado',
            });
          }
        } catch (err) {
          fallidos.push({
            estudiante,
            motivo: `Error al procesar: ${err.message}`,
          });
        }
      }

      return {
        exitosos,
        fallidos,
        resumen: `Procesados: ${exitosos.length} exitosos, ${fallidos.length} fallidos`,
        total: estudiantes.length,
      };
    } catch (error) {
      throw new HttpException(
        `Error creando estudiantes: ${error.message}`,
        400,
      );
    }
  }

  private async procesarMateriasEstudiante(
    idEstudiante: bigint,
    idCarrera: number,
    materiasInput: any[]
  ) {
    // Helpers para normalizar nombres de materias (copiados de materia.service.ts)
    const romanMap: Record<string, string> = {
      ' i ': ' 1 ', ' ii ': ' 2 ', ' iii ': ' 3 ', ' iv ': ' 4 ', ' v ': ' 5 ',
      ' vi ': ' 6 ', ' vii ': ' 7 ', ' viii ': ' 8 ', ' ix ': ' 9 ', ' x ': ' 10 ',
    };
    
    const normalizeBasic = (s?: string | null) =>
      (s ?? '')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normalizeWithRomans = (s?: string | null) => {
      let t = ` ${normalizeBasic(s)} `;
      for (const [r, n] of Object.entries(romanMap)) t = t.replace(new RegExp(r, 'g'), n);
      t = t
        .replace(/\b1\b/g, ' i ')
        .replace(/\b2\b/g, ' ii ')
        .replace(/\b3\b/g, ' iii ')
        .replace(/\b4\b/g, ' iv ')
        .replace(/\b5\b/g, ' v ')
        .replace(/\b6\b/g, ' vi ')
        .replace(/\b7\b/g, ' vii ')
        .replace(/\b8\b/g, ' viii ')
        .replace(/\b9\b/g, ' ix ')
        .replace(/\b10\b/g, ' x ');
      return normalizeBasic(t);
    };

    const levenshtein = (a: string, b: string) => {
      if (a === b) return 0;
      const m = a.length, n = b.length;
      if (!m) return n; if (!n) return m;
      const dp = Array.from({ length: m + 1 }, (_, i) => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        }
      }
      return dp[m][n];
    };

    const similarity = (a: string, b: string) => {
      const d = levenshtein(a, b);
      const maxLen = Math.max(a.length, b.length) || 1;
      return 1 - d / maxLen;
    };

    // Obtener último pensum de la carrera
    const vinculoCarrera = await this.prisma.estudiante_Carrera.findFirst({
      where: { Id_Estudiante: idEstudiante },
      orderBy: { Id_CarreraEstudiante: 'desc' },
      select: { Id_Carrera: true },
    });
    
    if (!vinculoCarrera?.Id_Carrera) {
      throw new Error('El estudiante no tiene carrera asociada');
    }

    const idCarreraBigInt = vinculoCarrera.Id_Carrera;

    const { _max } = await this.prisma.materia_carrera.aggregate({
      where: { id_carrera: idCarreraBigInt },
      _max: { numero_pensum: true },
    });
    
    const ultimoPensum = _max.numero_pensum;
    if (ultimoPensum == null) {
      throw new Error('La carrera no tiene pensum registrado');
    }

    // Materias del último pensum
    const materiasPensum = await this.prisma.materia.findMany({
      where: {
        nombre: { not: null },
        materia_carrera: { some: { id_carrera: idCarreraBigInt, numero_pensum: ultimoPensum } },
      },
      select: { id_materia: true, nombre: true },
    });
    
    const idsPensum = materiasPensum.map(m => m.id_materia);

    // Equivalencias
    const equivalencias = await this.prisma.equivalencias_materia.findMany({
      where: {
        OR: [
          { id_materia_Origen: { in: idsPensum } },
          { id_materia_equivalente: { in: idsPensum } },
        ],
      },
      select: { id_materia_Origen: true, id_materia_equivalente: true },
    });

    const idsEquivalentesExternos = Array.from(new Set(
      equivalencias.flatMap(eq => {
        const inPensumOri = idsPensum.includes(eq.id_materia_Origen);
        const inPensumEq = idsPensum.includes(eq.id_materia_equivalente);
        if (inPensumOri && !inPensumEq) return [eq.id_materia_equivalente];
        if (!inPensumOri && inPensumEq) return [eq.id_materia_Origen];
        return [];
      })
    ));

    const materiasExternas = idsEquivalentesExternos.length
      ? await this.prisma.materia.findMany({
          where: { id_materia: { in: idsEquivalentesExternos } },
          select: { id_materia: true, nombre: true },
        })
      : [];

    const aliasToId = new Map<string, bigint>();
    const getNombreById = (id: bigint) =>
      materiasPensum.find(m => m.id_materia === id)?.nombre
      ?? materiasExternas.find(m => m.id_materia === id)?.nombre
      ?? null;

    for (const m of materiasPensum) {
      if (m.nombre) aliasToId.set(normalizeWithRomans(m.nombre), m.id_materia);
    }
    
    for (const eq of equivalencias) {
      const oriIn = idsPensum.includes(eq.id_materia_Origen);
      const eqvIn = idsPensum.includes(eq.id_materia_equivalente);
      if (oriIn && !eqvIn) {
        const n = getNombreById(eq.id_materia_equivalente);
        if (n) aliasToId.set(normalizeWithRomans(n), eq.id_materia_Origen);
      } else if (!oriIn && eqvIn) {
        const n = getNombreById(eq.id_materia_Origen);
        if (n) aliasToId.set(normalizeWithRomans(n), eq.id_materia_equivalente);
      } else if (oriIn && eqvIn) {
        const nOri = getNombreById(eq.id_materia_Origen);
        const nEqv = getNombreById(eq.id_materia_equivalente);
        if (nOri && nEqv) {
          aliasToId.set(normalizeWithRomans(nEqv), eq.id_materia_Origen);
          aliasToId.set(normalizeWithRomans(nOri), eq.id_materia_equivalente);
        }
      }
    }

    const aliasKeys = Array.from(aliasToId.keys());
    const THRESHOLD = 0.85;

    const pickIdByNombre = (entrada: string): bigint | undefined => {
      const norm = normalizeWithRomans(entrada);
      const exact = aliasToId.get(norm);
      if (exact) return exact;

      let bestKey = '';
      let bestScore = 0;
      for (const k of aliasKeys) {
        const s = similarity(norm, k);
        if (s > bestScore) { bestScore = s; bestKey = k; }
      }
      if (bestScore >= THRESHOLD) return aliasToId.get(bestKey);
      return undefined;
    };

    // Procesar materias: actualizar si existe, crear si no
    await this.prisma.$transaction(async (tx) => {
      for (const mat of materiasInput) {
        const idMateria = pickIdByNombre(mat.nombre);
        if (!idMateria) {
          console.error('Materia NO mapeada al último pensum:', mat.nombre);
          continue; // Saltar materias no encontradas en lugar de fallar
        }

        // Buscar si ya existe la inscripción para esta gestión
        const inscripcionExistente = await tx.estudiantes_materia.findUnique({
          where: {
            id_estudiante_id_materia_Gestion: {
              id_estudiante: idEstudiante,
              id_materia: idMateria,
              Gestion: mat.gestion,
            },
          },
        });

        if (inscripcionExistente) {
          // ACTUALIZAR materia existente
          await tx.estudiantes_materia.update({
            where: {
              id_estudiante_id_materia_Gestion: {
                id_estudiante: idEstudiante,
                id_materia: idMateria,
                Gestion: mat.gestion,
              },
            },
            data: {
              calificacion: mat.nota ?? inscripcionExistente.calificacion,
              estado: mat.estado || inscripcionExistente.estado,
            },
          });
        } else {
          // CREAR nueva inscripción
          await tx.estudiantes_materia.create({
            data: {
              id_estudiante: idEstudiante,
              id_materia: idMateria,
              calificacion: mat.nota ?? null,
              estado: mat.estado,
              Gestion: mat.gestion,
            },
          });
        }
      }
    });
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
