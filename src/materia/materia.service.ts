import { estudiante_Carrera, materia_preRequisito } from './../../node_modules/.prisma/client/index.d';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';

@Injectable()
export class MateriaService {
    constructor(private prisma: PrismaService) { }

    async registrarMaterias(materias: any[]) {
        const materiaIds: { [cod_materia: string]: number } = {};

        await this.prisma.$transaction(async (tx) => {
            for (const mat of materias) {
                let tipo = await tx.tipo_materia.findFirst({ where: { nombre: mat.tipo } });
                if (!tipo) {
                    tipo = await tx.tipo_materia.create({ data: { nombre: mat.tipo } });
                    console.log(`Tipo creado: ${mat.tipo}`);
                }

                let carrera = await tx.carrera.findFirst({ where: { nombre_carrera: mat.carrera } });
                if (!carrera) {
                    carrera = await tx.carrera.create({ data: { nombre_carrera: mat.carrera } });
                    console.log(`Carrera creada: ${mat.carrera}`);
                }

                let materia = await tx.materia.upsert({
                    where: { cod_materia: Number(mat.codigo) },
                    update: {
                        nombre: mat.nombre,
                        siglas_materia: mat.sigla,
                        creditos: mat.creditos,
                        horas_totales: mat.horas_totales,
                        id_tipo: tipo.id_tipo,
                    },
                    create: {
                        cod_materia: Number(mat.codigo),
                        nombre: mat.nombre,
                        siglas_materia: mat.sigla,
                        creditos: mat.creditos,
                        horas_totales: mat.horas_totales,
                        id_tipo: tipo.id_tipo,
                    }
                });
                materiaIds[mat.sigla] = Number(materia.id_materia);
                materiaIds[String(mat.codigo)] = Number(materia.id_materia);
                console.log(materiaIds);
                console.log(`Materia registrada: ${mat.nombre} (${mat.sigla})`);

                await tx.materia_carrera.create({
                    data: {
                        id_materia: materia.id_materia,
                        id_carrera: carrera.id_carrera,
                        semestre: String(mat.semestre ?? 1),
                        numero_pensum: mat.pensum
                    }
                });
                console.log(`Materia-Carrera registrada para ${mat.nombre} - ${mat.carrera}`);
            }
        });

        await this.prisma.$transaction(async (tx) => {
            for (const mat of materias) {
                const id_materia = materiaIds[mat.sigla] || materiaIds[String(mat.codigo)];

                if (mat.prerequisitos && mat.prerequisitos.length > 0) {
                    for (const codPre of mat.prerequisitos) {
                        const idPre = materiaIds[codPre] || materiaIds[String(codPre)];
                        if (idPre) {
                            await tx.materia_preRequisito.create({
                                data: {
                                    id_materia: id_materia,
                                    id_materia_preRequisito: idPre
                                }
                            });
                            console.log(`Prerequisito registrado para ${mat.nombre}: ${codPre}`);
                        } else if (!isNaN(Number(codPre))) {
                            await tx.materia_preRequisito.create({
                                data: {
                                    id_materia: id_materia,
                                    total_materia: Number(codPre)
                                }
                            });
                            console.log(`Prerequisito registrado (total materias): ${mat.nombre}: ${codPre}`);
                        } else {
                            console.warn(`NO SE ENCONTRÓ prerequisito ${codPre} para la materia ${mat.nombre}`);
                        }
                    }
                }

                if (mat.equivalencias && mat.equivalencias.length > 0) {
                    for (const codEquiv of mat.equivalencias) {
                        let id_equiv = materiaIds[codEquiv] || materiaIds[String(codEquiv)];
                        if (id_equiv && id_materia) {
                            const existeEquiv = await tx.equivalencias_materia.findFirst({
                                where: {
                                    id_materia_Origen: id_materia,
                                    id_materia_equivalente: id_equiv
                                }
                            });
                            if (!existeEquiv) {
                                await tx.equivalencias_materia.create({
                                    data: {
                                        id_materia_Origen: id_materia,
                                        id_materia_equivalente: id_equiv
                                    }
                                });
                                console.log(`Equivalencia registrada: ${mat.sigla} ≡ ${codEquiv}`);
                            }
                        } else {
                            console.warn(`NO SE ENCONTRÓ equivalencia ${codEquiv} para la materia ${mat.nombre}`);
                        }
                    }
                }
            }
        });

        console.log("Registro exitoso (todo atómico en dos fases)");
        return { ok: true, message: 'Materias, prerequisitos y equivalencias registradas correctamente' };
    }

    async cargarHorariosDesdeJson(jsonData: any[]): Promise<{ ok: number, errores: any[] }> {
        const errores: any[] = [];
        let ok = 0;
        for (const [i, row] of jsonData.entries()) {
            if (row.tipo && String(row.tipo).trim().toLowerCase() === 'fin') continue;

            const materia = await this.prisma.materia.findFirst({
                where: { cod_materia: Number(row.Mat) }
            });

            if (!materia) {
                errores.push({ fila: i + 1, sigla: row.sigla, error: 'Materia no encontrada' });
                continue;
            }

            let modulo_inicio = Number(row.mod);
            let modulo_fin: number | null = null;
            let BiModular = false;

            if (row.tipo && String(row.tipo).trim().toLowerCase() === 'inicio') {
                BiModular = true;
                modulo_fin = modulo_inicio + 1;
            }

            try {
                await this.prisma.horario_materia.create({
                    data: {
                        horario: row.horario,
                        Modalidad: row.modalidad,
                        id_materia: materia.id_materia,
                        turno: row.turno,
                        gestion: row.sem,
                        modulo_inicio,
                        modulo_fin,
                        grupo: String(row.grp),
                        BiModular,
                        inscritos: Number(row.inscritos) || 0,
                        confirmados: Number(row.confirmados) || 0,
                        estado: true,
                    }
                });
                ok++;
            } catch (e) {
                errores.push({ fila: i + 1, sigla: row.Sigla, error: e.message });
            }
        }
        return { ok, errores };
    }


    async crearEstudianteCompleto(data: {
        persona: {
            nombre?: string;
            apellido1?: string;
            apellido2?: string;
            correo?: string;
            ci?: string;
            telefono?: string;
        },
        nroRegistro: string,
        carreraId: number,
        materias?: {
            nombre: string,
            nota?: number,
            estado: 'aprobado' | 'reprobado' | 'cursando',
            gestion: string,
        }[]
    }) {

        const personaPayload = {
            Nombre: data.persona?.nombre ?? "",
            Apellido1: data.persona?.apellido1 ?? "",
            Apellido2: data.persona?.apellido2 ?? "",
            Correo: data.persona?.correo ?? "",
            CI: data.persona?.ci ?? "",
            telefono: data.persona?.telefono ? Number(data.persona.telefono) : undefined,
        };

        const persona = await this.prisma.persona.create({
            data: personaPayload,
        });

        const estudiante = await this.prisma.estudiante.create({
            data: {
                nroRegistro: data.nroRegistro,
                id_Persona: persona.Id_Persona,
            },
        });


        const hashedPassword = await bcrypt.hash("12345678", 10);
        const usuario = await this.prisma.usuario.create({
            data: {
                Nombre_Usuario: data.nroRegistro,
                Password: hashedPassword,
                Id_Persona: persona.Id_Persona,
            },
        });
        const usuario_rol = await this.prisma.usuario_Rol.create({
            data: {
                Id_Usuario: usuario.Id_Usuario,
                Id_Rol: 2
            }
        })

        const estudianteCarrera = await this.prisma.estudiante_Carrera.create({
            data: {
                Id_Estudiante: estudiante.id_estudiante,
                Id_Carrera: data.carreraId,
            },
        });

        if (data.materias && Array.isArray(data.materias)) {
            for (const mat of data.materias) {
                const materia = await this.prisma.materia.findFirst({
                    where: {
                        nombre: { equals: mat.nombre, mode: 'insensitive' },
                    },
                });
                if (!materia) {
                    console.error("Materia NO encontrada:", mat.nombre);
                    throw new Error(`Materia no encontrada: ${mat.nombre}`);
                }
                const regMat = await this.prisma.estudiantes_materia.create({
                    data: {
                        id_estudiante: estudiante.id_estudiante,
                        id_materia: materia.id_materia,
                        calificacion: mat.nota ?? null,
                        estado: mat.estado,
                        Gestion: mat.gestion,
                    },
                });

            }
        }

        return {
            message: "Estudiante creado con éxito",
            persona,
            estudiante,
            usuario
        };
    }


    async crearEstudiantesLote(estudiantes: any[]) {
        const resultados: Array<{ success: boolean; data?: any; error?: any; input?: any }> = [];
        for (const data of estudiantes) {
            try {
                const res = await this.crearEstudianteCompleto(data);
                resultados.push({ success: true, data: res });
            } catch (error) {
                resultados.push({ success: false, error: error.message, input: data });
            }
        }
        return resultados;
    }


    async getPensumDeEstudiantePorRegistro(nroRegistro: string) {

        type MateriaResumen = {
            nombre: string | null,
            siglas: string | null,
            codigo: Number | null,
            semestre: string | null,
            equivalencias: (string | null)[],
            prerrequisitos: { nombre: string | null | undefined, sigla: string | null | undefined, total_materia: number | null | undefined }[],
            puedeCursar: boolean,
            estado: string | null,
            vecesCursada: number | null,
            horariosAbiertos: {
                grupo: string | null,
                turno: string | null,
                horario: string | null,
                modalidad: string | null,
                gestion: string | null,
                bimodular: boolean | null,
                modulo_inicio: number | null,
                modulo_fin: number | null
            }[]
        }

        try {
            const estudiante = await this.prisma.estudiante.findFirst({
                where: { nroRegistro },
                include: {
                    estudiante_Carrera: {
                        include: { carrera: true }
                    },
                    estudiantes_materia: true
                }
            });

            if (!estudiante) {
                throw new Error("Estudiante no encontrado");
            }
            const persona = await this.prisma.persona.findFirst({
                where: { Id_Persona: Number(estudiante.id_Persona) }
            });
            type ResultadoCarreraPensum = {
                estudiante: any | null;
                carrera: string | undefined;
                pensum: number;
                materias: MateriaResumen[];
            };

            const resultados: ResultadoCarreraPensum[] = [];
            for (const estCarr of estudiante.estudiante_Carrera) {
                const pensums = await this.prisma.materia_carrera.findMany({
                    where: { id_carrera: estCarr.Id_Carrera },
                    select: { numero_pensum: true }
                });

                const pensumNumeros = [...new Set(pensums.map(p => p.numero_pensum))];

                for (const pensumNumero of pensumNumeros) {

                    const materiasCarrera = await this.prisma.materia_carrera.findMany({
                        where: {
                            id_carrera: estCarr.Id_Carrera,
                            numero_pensum: pensumNumero
                        },
                        include: {
                            materia: {
                                include: {
                                    materia_preRequisito: {
                                        include: {
                                            materia_materia_preRequisito_id_materia_preRequisitoTomateria: true,
                                        }
                                    }
                                }
                            }
                        }
                    });
                    const res = await this.prisma.materia_preRequisito.findMany({ take: 1 });


                    const materiasInfo: MateriaResumen[] = [];

                    for (const mc of materiasCarrera) {
                        const mat = mc.materia;
                        if (mat) {
                            // -- Equivalencias (cruzada en la tabla equivalencias_materia)
                            const equivalencias = await this.prisma.equivalencias_materia.findMany({
                                where: {
                                    OR: [
                                        { id_materia_Origen: mat.id_materia },
                                        { id_materia_equivalente: mat.id_materia }
                                    ]
                                }
                            });

                            const equivalentes: string[] = [];
                            for (const eq of equivalencias) {
                                let idEquivalente: bigint | null = null;
                                if (eq.id_materia_Origen === mat.id_materia) {
                                    idEquivalente = eq.id_materia_equivalente;
                                } else if (eq.id_materia_equivalente === mat.id_materia) {
                                    idEquivalente = eq.id_materia_Origen;
                                }
                                if (idEquivalente) {
                                    const materiaEq = await this.prisma.materia.findUnique({
                                        where: { id_materia: idEquivalente }
                                    });
                                    if (materiaEq && materiaEq.nombre !== mat.nombre) {
                                        equivalentes.push(String(materiaEq.nombre));
                                    }
                                }
                            }

                            // Prerrequisitos
                            const prereq = mat.materia_preRequisito
                                .map(pr => ({
                                    nombre: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.nombre,
                                    sigla: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.siglas_materia,
                                    total_materia: pr.total_materia
                                }))
                                .filter(pr => pr.nombre || (pr.total_materia && pr.total_materia > 0))





                            // Revisar si la materia ya fue cursada (aprobada o no)
                            const cursadas = estudiante.estudiantes_materia.filter(
                                em => em.id_materia === mat.id_materia
                            );
                            const vecesCursada = cursadas.length;
                            const registroAprobado = cursadas.find(em => em.estado === 'aprobado');
                            let estado: string | null = null;
                            if (registroAprobado) {
                                estado = 'aprobada';
                            }

                            // Puede cursar: si tiene todos los prerequisitos aprobados y NO la ha aprobado antes
                            let puedeCursar = false;
                            if (estado === 'aprobada') {
                                puedeCursar = false;
                            } else if (prereq.length === 0) {
                                puedeCursar = true;
                            } else {
                                puedeCursar = true;
                                for (const pr of prereq) {
                                    if (pr.total_materia && pr.total_materia > 0) {
                                        // Materias aprobadas del estudiante
                                        const materiasAprobadas = estudiante.estudiantes_materia.filter(
                                            em => em.estado === 'aprobado'
                                        );
                                        if (materiasAprobadas.length < pr.total_materia) {
                                            puedeCursar = false;
                                            break;
                                        }
                                    } else {
                                        // Prerrequisito normal (por nombre)
                                        const matReq = await this.prisma.materia.findFirst({
                                            where: { nombre: { equals: pr.nombre, mode: 'insensitive' } }
                                        });
                                        if (!matReq || !estudiante.estudiantes_materia.some(
                                            em => em.id_materia === matReq.id_materia && em.estado === 'aprobado'
                                        )) {
                                            puedeCursar = false;
                                            break;
                                        }
                                    }
                                }
                            }

                            // Hay horario abierto?
                            const horariosAbiertos = await this.prisma.horario_materia.findMany({
                                where: {
                                    id_materia: mat.id_materia,
                                    estado: true
                                }
                            });

                            materiasInfo.push({
                                nombre: mat.nombre,
                                siglas: mat.siglas_materia,
                                codigo: Number(mat.id_materia),
                                semestre: mc.semestre,
                                equivalencias: equivalentes,
                                prerrequisitos: prereq,
                                puedeCursar,
                                estado,
                                vecesCursada,
                                horariosAbiertos: horariosAbiertos.map(h => ({
                                    grupo: h.grupo,
                                    turno: h.turno,
                                    modalidad: h.Modalidad,
                                    horario: h.horario,
                                    gestion: h.gestion ?? null,
                                    bimodular: h.BiModular ?? null,
                                    modulo_inicio: h.modulo_inicio,
                                    modulo_fin: h.modulo_fin,
                                    codigo_horario: h.id_horario
                                }))
                            });
                        }
                    }

                    resultados.push({
                        estudiante: persona ?? [],
                        carrera: estCarr.carrera?.nombre_carrera,
                        pensum: Number(pensumNumero),
                        materias: materiasInfo
                    });
                }
            }

            return resultados;
        } catch (error) {
            console.error("[ERROR]", error);
            throw error;
        }
    }

    async registerIncripcionMateria(body: any) {
        const estudiante = await this.prisma.estudiante.findFirst({
            where: { id_Persona: body.id_persona }
        });

        if (!estudiante) {
            throw new Error('No se encontró el estudiante para el id_persona proporcionado.');
        }

        const totalInscritas = await this.prisma.estudiantes_materia.count({
            where: {
                id_estudiante: estudiante.id_estudiante,
                Gestion: body.gestion,
            }
        });

        if (totalInscritas >= 8) {
            return {
                ok: false,
                message: 'El estudiante ya tiene 8 materias inscritas en esta gestión.',
                rechazadas: body.materias.map(mat => ({
                    nombre: this.obtenerNombreMateria(mat.codigo),
                    horario: this.obtenerHorarioGrupo(mat.codigo_horario),
                    motivo: 'Ya alcanzó el límite de 8 materias en esta gestión.'
                })),
                inscritas: [],
            };
        }

        let rechazadas: { nombre: string; horario: string; motivo: string }[] = [];
        let inscritas: {
            nombre: string | null | undefined;
            horario: string | undefined;
            motivo: string;
        }[] = [];

        for (const mat of body.materias) {
            const existe = await this.prisma.estudiantes_materia.findFirst({
                where: {
                    id_estudiante: estudiante.id_estudiante,
                    id_materia: Number(mat.codigo),
                    id_horario_materia: Number(mat.codigo_horario),
                    Gestion: body.gestion,
                },
                include: {
                    horario_materia: true,
                    materia: true,
                }
            });

            if (existe) {
                rechazadas.push({
                    nombre: existe.materia?.nombre || await this.obtenerNombreMateria(mat.codigo),
                    horario: existe.horario_materia
                        ? `Grupo ${existe.horario_materia.grupo} - ${existe.horario_materia.horario}`
                        : await this.obtenerHorarioGrupo(mat.codigo_horario),
                    motivo: 'El estudiante ya está inscrito en esta materia, horario y gestión.'
                });
            }
        }

        if (rechazadas.length > 0) {
            return {
                ok: false,
                message: 'Algunas materias ya están inscritas, revisa los detalles.',
                rechazadas,
                inscritas: [],
            };
        }


        const countFinal = await this.prisma.estudiantes_materia.count({
            where: {
                id_estudiante: estudiante.id_estudiante,
                Gestion: body.gestion,
            }
        });

        if (countFinal + body.materias.length > 8) {
            return {
                ok: false,
                message: 'El total a inscribir supera el límite de 8 materias en esta gestión.',
                rechazadas: body.materias.map(mat => ({
                    nombre: this.obtenerNombreMateria(mat.codigo),
                    horario: this.obtenerHorarioGrupo(mat.codigo_horario),
                    motivo: 'El total supera el máximo permitido de 8 materias.'
                })),
                inscritas: [],
            };
        }

        for (const mat of body.materias) {
            const materiaInfo = await this.prisma.materia.findUnique({ where: { id_materia: Number(mat.codigo) } });
            const horarioInfo = await this.prisma.horario_materia.findUnique({ where: { id_horario: Number(mat.codigo_horario) } });
            const insc = await this.prisma.estudiantes_materia.create({
                data: {
                    id_estudiante: estudiante.id_estudiante,
                    id_materia: Number(mat.codigo),
                    id_horario_materia: Number(mat.codigo_horario),
                    estado: 'inscrito',
                    created_at: new Date(),
                    updated_at: new Date(),
                    Gestion: body.gestion,
                }
            });
            inscritas.push({
                nombre: materiaInfo?.nombre,
                horario: horarioInfo
                    ? `Grupo ${horarioInfo.grupo} - ${horarioInfo.horario}`
                    : undefined,
                motivo: 'Inscripción exitosa'
            });
        }

        return {
            ok: true,
            message: 'Materias inscritas correctamente.',
            rechazadas: [],
            inscritas,
        };
    }


    private async obtenerNombreMateria(codigo: number | string) {
        const mat = await this.prisma.materia.findUnique({ where: { id_materia: Number(codigo) } });
        return mat?.nombre ?? `Materia (${codigo})`;
    }

    private async obtenerHorarioGrupo(codigo_horario: number | string) {
        const h = await this.prisma.horario_materia.findUnique({ where: { id_horario: Number(codigo_horario) } });
        if (!h) return `Horario (${codigo_horario})`;
        return `Grupo ${h.grupo} - ${h.horario}`;
    }
    async eliminarInscripcionMateria(body: any) {
        // body: { id_persona, codigo, codigo_horario, gestion }

        const inscripcion = await this.prisma.estudiantes_materia.findUnique({
            where: {
                id_estudiante_materia: Number(body.codigo_horario),
            },
        });


        if (!inscripcion) {
            return {
                ok: false,
                message: 'No se encontró la inscripción a eliminar.',
            };
        }

        await this.prisma.estudiantes_materia.delete({
            where: { id_estudiante_materia: Number(body.codigo_horario) }
        });


        return {
            ok: true,
            message: 'Inscripción eliminada correctamente.',
        };
    }


    async getEstudiantesMateriasPaginado({
        page,
        pageSize,
        user,
        fechaInicio,
        fechaFin,
    }: {
        page: number,
        pageSize: number,
        user: number,
        fechaInicio?: string,
        fechaFin?: string
    }) {
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Number(pageSize);

        // 1. Buscar carreras que administra el usuario
        const usuario = await this.prisma.usuario.findUnique({
            where: { Id_Usuario: user },
            include: { usuario_Carrera: true }
        });
        if (!usuario) throw new Error("Usuario no encontrado");

        const carrerasIds = usuario.usuario_Carrera
            .map(rc => rc.Id_carrera)
            .filter((id): id is bigint => id !== null && id !== undefined);

        if (!carrerasIds.length) {
            return {
                items: [],
                total: 0,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: 0
            };
        }

        const estudiantesCarrera = await this.prisma.estudiante_Carrera.findMany({
            where: { Id_Carrera: { in: carrerasIds } },
            select: { Id_Estudiante: true }
        });
        const estudianteIds = [
            ...new Set(
                estudiantesCarrera
                    .map(ec => ec.Id_Estudiante)
                    .filter((id): id is bigint => id !== null && id !== undefined)
            )
        ];

        if (!estudianteIds.length) {
            return {
                items: [],
                total: 0,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: 0
            };
        }

        const startDate = fechaInicio ? new Date(fechaInicio) : dayjs().startOf('day').toDate();
        const endDate = fechaFin ? new Date(fechaFin) : dayjs().endOf('day').toDate();

        const total = await this.prisma.estudiante.count({
            where: {
                id_estudiante: { in: estudianteIds },
                estudiantes_materia: {
                    some: {
                        created_at: { gte: startDate, lte: endDate }
                    }
                }
            }
        });

        const estudiantes = await this.prisma.estudiante.findMany({
            skip,
            take,
            where: {
                id_estudiante: { in: estudianteIds },
                estudiantes_materia: {
                    some: {
                        created_at: { gte: startDate, lte: endDate }
                    }
                }
            },
            include: {
                Persona: true,
                estudiantes_materia: {
                    where: {
                        created_at: { gte: startDate, lte: endDate }
                    },
                    include: {
                        materia: true,
                        horario_materia: true
                    }
                }
            },
            orderBy: { id_estudiante: "asc" }
        });

        const items = estudiantes.map(est => {
            const nombreCompleto = est.Persona
                ? `${est.Persona.Nombre} ${est.Persona.Apellido1} ${est.Persona.Apellido2 ?? ''}`.trim()
                : null;

            const materiasPorGestion = est.estudiantes_materia.reduce((acc, mat) => {
                if (!mat.Gestion) return acc;
                if (!acc[mat.Gestion]) acc[mat.Gestion] = [];
                acc[mat.Gestion].push({
                    id_estudiante_materia: mat.id_estudiante_materia,
                    materia: mat.materia?.nombre,
                    grupo: mat.horario_materia?.grupo,
                    horario: mat.horario_materia?.horario,
                    estado: mat.estado
                });
                return acc;
            }, {} as Record<string, any[]>);

            return {
                id_estudiante: est.id_estudiante,
                nombre_completo: nombreCompleto,
                materias_por_gestion: materiasPorGestion
            };
        });

        return {
            items,
            total,
            page: Number(page),
            pageSize: Number(pageSize),
            totalPages: Math.ceil(total / pageSize)
        };
    }


}
