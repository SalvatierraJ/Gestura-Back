import { estudiante_Carrera, materia_preRequisito, estudiantes_materia } from './../../node_modules/.prisma/client/index.d';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import * as bcrypt from 'bcrypt';
import dayjs from 'dayjs';
interface EstudianteData {
    registro: string | number;
    estado: string;
    turno_inscripcion: string;
    turno_moda: string;
    semestre_ingreso: string;
    semestre_ultimo: string;
}

type EntradaDocente = {
    agd_appaterno: string;
    agd_apmaterno: string;
    agd_nombres: string;
    semestre: string;
    agd_docnro: string;
    mat_codigo: string;
    mdl_descripcion: string;
    mdu_codigo: string;
    pln_grupo: string;
};
@Injectable()
export class MateriaService {
    constructor(private prisma: PrismaService) { }

    async registrarMaterias(materias: any[]) {
        await this.prisma.$transaction(async (tx) => {
            const materiaIds: { [cod_materia: string]: number } = {};

            // Primera fase: registrar materias, carreras, tipos y relaciones
            for (const mat of materias) {
                let tipo = await tx.tipo_materia.findFirst({ where: { nombre: mat.tipo } });
                if (!tipo) {
                    tipo = await tx.tipo_materia.create({ data: { nombre: mat.tipo } });
                }

                let carrera = await tx.carrera.findFirst({ where: { nombre_carrera: mat.carrera } });
                if (!carrera) {
                    carrera = await tx.carrera.create({ data: { nombre_carrera: mat.carrera } });
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


                await tx.materia_carrera.create({
                    data: {
                        id_materia: materia.id_materia,
                        id_carrera: carrera.id_carrera,
                        semestre: String(mat.semestre ?? 1),
                        numero_pensum: mat.pensum
                    }
                });
            }

            // Segunda fase: prerequisitos y equivalencias
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
                        } else if (!isNaN(Number(codPre))) {
                            await tx.materia_preRequisito.create({
                                data: {
                                    id_materia: id_materia,
                                    total_materia: Number(codPre)
                                }
                            });
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
                            }
                        }
                    }
                }
            }
        }, {
            timeout: 120000
        });

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
            codigo_materia: bigint | null,
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
                modulo_fin: number | null,
                codigo_horario: bigint,
                materia_origen: 'original' | 'equivalente',
                nombre_materia: string | null,
                siglas_materia: string | null,
                codigo_materia: number
            }[]
        };

        try {
            const estudiante = await this.prisma.estudiante.findFirst({
                where: { nroRegistro },
                include: {
                    estudiante_Carrera: { include: { carrera: true } },
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
                const materiasPorPensum = await this.prisma.materia_carrera.findMany({
                    where: { id_carrera: estCarr.Id_Carrera },
                    select: {
                        numero_pensum: true,
                        id_materia: true
                    }
                });

                const pensumMateriasMap = new Map<number, bigint[]>();
                for (const item of materiasPorPensum) {
                    const numeroPensum = item.numero_pensum !== null ? Number(item.numero_pensum) : 0;
                    if (!pensumMateriasMap.has(numeroPensum)) {
                        pensumMateriasMap.set(numeroPensum, []);
                    }
                    if (item.id_materia !== null) {
                        pensumMateriasMap.get(numeroPensum)?.push(item.id_materia);
                    }
                }

                let pensumDetectado: number | null = null;
                let maxMateriasCursadas = -1;

                for (const [numeroPensum, materiasIds] of pensumMateriasMap.entries()) {
                    const cursadas = estudiante.estudiantes_materia.filter(em =>
                        materiasIds.includes(em.id_materia as bigint)
                    ).length;

                    if (cursadas > maxMateriasCursadas) {
                        maxMateriasCursadas = cursadas;
                        pensumDetectado = numeroPensum;
                    }
                }

                if (!pensumDetectado) {
                    throw new Error("No se pudo determinar el pensum del estudiante.");
                }

                const materiasCarrera = await this.prisma.materia_carrera.findMany({
                    where: {
                        id_carrera: estCarr.Id_Carrera,
                        numero_pensum: pensumDetectado
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
                        const idsEquivalentes: bigint[] = [];

                        for (const eq of equivalencias) {
                            let idEquivalente: bigint;
                            if (eq.id_materia_Origen === mat.id_materia) {
                                idEquivalente = eq.id_materia_equivalente;
                            } else {
                                idEquivalente = eq.id_materia_Origen;
                            }

                            const materiaEq = await this.prisma.materia.findUnique({
                                where: { id_materia: idEquivalente }
                            });
                            if (materiaEq && materiaEq.nombre !== mat.nombre) {
                                equivalentes.push(String(materiaEq.nombre));
                                idsEquivalentes.push(idEquivalente);
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

                        // Verificar si alguna materia equivalente fue aprobada
                        const materiasEquivalentesAprobadas = estudiante.estudiantes_materia.filter(
                            em => em.id_materia !== null && idsEquivalentes.includes(em.id_materia as bigint) && em.estado === 'aprobado'
                        );

                        // Si aprobó una materia equivalente, considerar esta materia como aprobada
                        if (materiasEquivalentesAprobadas.length > 0 && estado !== 'aprobada') {
                            estado = 'aprobada_por_equivalencia';
                        }

                        // Puede cursar: si tiene todos los prerequisitos aprobados y NO la ha aprobado antes
                        let puedeCursar = false;
                        if (estado === 'aprobada' || estado === 'aprobada_por_equivalencia') {
                            puedeCursar = false;
                        } else if (prereq.length === 0) {
                            puedeCursar = true;
                        } else {
                            puedeCursar = true;
                            for (const pr of prereq) {
                                if (pr.total_materia && pr.total_materia > 0) {
                                    // Materias aprobadas del estudiante (incluyendo equivalentes)
                                    const materiasAprobadas = estudiante.estudiantes_materia.filter(
                                        em => em.estado === 'aprobado'
                                    );

                                    // Contar también materias aprobadas por equivalencia
                                    const materiasAprobadasPorEquivalencia = estudiante.estudiantes_materia.filter(
                                        em => em.id_materia !== null && idsEquivalentes.includes(em.id_materia as bigint) && em.estado === 'aprobado'
                                    );

                                    const totalMateriasAprobadas = materiasAprobadas.length + materiasAprobadasPorEquivalencia.length;
                                    if (totalMateriasAprobadas < pr.total_materia) {
                                        puedeCursar = false;
                                        break;
                                    }
                                } else {
                                    // Prerrequisito normal (por nombre)
                                    const matReq = await this.prisma.materia.findFirst({
                                        where: { nombre: { equals: pr.nombre, mode: 'insensitive' } }
                                    });

                                    if (matReq) {
                                        // Verificar si aprobó la materia requerida directamente
                                        const aproboMateriaRequerida = estudiante.estudiantes_materia.some(
                                            em => em.id_materia === matReq.id_materia && em.estado === 'aprobado'
                                        );

                                        // Verificar si aprobó una materia equivalente a la requerida
                                        const equivalenciasMateriaRequerida = await this.prisma.equivalencias_materia.findMany({
                                            where: {
                                                OR: [
                                                    { id_materia_Origen: matReq.id_materia },
                                                    { id_materia_equivalente: matReq.id_materia }
                                                ]
                                            }
                                        });

                                        const idsEquivMateriaRequerida: bigint[] = [];
                                        for (const eqReq of equivalenciasMateriaRequerida) {
                                            let idEquivReq: bigint;
                                            if (eqReq.id_materia_Origen === matReq.id_materia) {
                                                idEquivReq = eqReq.id_materia_equivalente;
                                            } else {
                                                idEquivReq = eqReq.id_materia_Origen;
                                            }
                                            idsEquivMateriaRequerida.push(idEquivReq);
                                        }

                                        const aproboEquivalenteRequerida = estudiante.estudiantes_materia.some(
                                            em => em.id_materia !== null && idsEquivMateriaRequerida.includes(em.id_materia as bigint) && em.estado === 'aprobado'
                                        );

                                        if (!aproboMateriaRequerida && !aproboEquivalenteRequerida) {
                                            puedeCursar = false;
                                            break;
                                        }
                                    } else {
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

                        // Buscar horarios de materias equivalentes
                        const horariosEquivalentes = await this.prisma.horario_materia.findMany({
                            where: {
                                id_materia: { in: idsEquivalentes },
                                estado: true
                            },
                            include: {
                                materia: {
                                    select: {
                                        nombre: true,
                                        siglas_materia: true,
                                        id_materia: true
                                    }
                                }
                            }
                        });

                        // Combinar horarios de la materia original y equivalentes
                        const todosLosHorarios = [
                            // Horarios de la materia original
                            ...horariosAbiertos.map(h => ({
                                grupo: h.grupo,
                                turno: h.turno,
                                modalidad: h.Modalidad,
                                horario: h.horario,
                                gestion: h.gestion ?? null,
                                bimodular: h.BiModular ?? null,
                                modulo_inicio: h.modulo_inicio,
                                modulo_fin: h.modulo_fin,
                                codigo_horario: h.id_horario,
                                materia_origen: 'original' as const,
                                nombre_materia: mat.nombre,
                                siglas_materia: mat.siglas_materia,
                                codigo_materia: Number(mat.id_materia)
                            })),
                            // Horarios de materias equivalentes
                            ...horariosEquivalentes.map(h => ({
                                grupo: h.grupo,
                                turno: h.turno,
                                modalidad: h.Modalidad,
                                horario: h.horario,
                                gestion: h.gestion ?? null,
                                bimodular: h.BiModular ?? null,
                                modulo_inicio: h.modulo_inicio,
                                modulo_fin: h.modulo_fin,
                                codigo_horario: h.id_horario,
                                materia_origen: 'equivalente' as const,
                                nombre_materia: h.materia?.nombre ?? null,
                                siglas_materia: h.materia?.siglas_materia ?? null,
                                codigo_materia: Number(h.materia?.id_materia ?? 0)
                            }))
                        ];

                        materiasInfo.push({
                            nombre: mat.nombre,
                            siglas: mat.siglas_materia,
                            codigo: Number(mat.id_materia),
                            codigo_materia: mat.cod_materia,
                            semestre: mc.semestre,
                            equivalencias: equivalentes,
                            prerrequisitos: prereq,
                            puedeCursar,
                            estado,
                            vecesCursada,
                            horariosAbiertos: todosLosHorarios
                        });
                    }
                }
                resultados.push({
                    estudiante: persona ?? [],
                    carrera: estCarr.carrera?.nombre_carrera,
                    pensum: Number(pensumDetectado),
                    materias: materiasInfo
                });
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


    async getPensumDeCarreraPensum(nombreCarrera: string, numeroPensum: number) {
        type MateriaResumen = {
            id: number | string | null,
            nombre: string | null,
            siglas: string | null,
            codigo: number | null,
            semestre: string | null,
            equivalencias: { id: number | string, nombre: string | null, sigla: string | null }[],
            prerrequisitos: { id: number | string, nombre: string | null | undefined, sigla: string | null | undefined, total_materia: number | null | undefined }[]
        };

        type MateriaIdNombrePensum = {
            id: number | string,
            nombre: string,
            numeroPensum: number
        };

        try {
            // Buscar carrera
            const carrera = await this.prisma.carrera.findFirst({
                where: { nombre_carrera: nombreCarrera }
            });
            if (!carrera) throw new Error('Carrera no encontrada');

            // Todas las materias de TODOS los pensums de esa carrera
            const todasMateriasCarrera = await this.prisma.materia_carrera.findMany({
                where: {
                    id_carrera: carrera.id_carrera
                },
                include: {
                    materia: true
                }
            });

            const materiasIdNombrePensum: MateriaIdNombrePensum[] = todasMateriasCarrera
                .map(mc => ({
                    id: typeof mc.materia?.id_materia === "bigint"
                        ? Number(mc.materia?.id_materia)
                        : (mc.materia?.id_materia ?? ""),
                    nombre: mc.materia?.nombre ?? "",
                    numeroPensum: typeof mc.numero_pensum === "bigint"
                        ? Number(mc.numero_pensum)
                        : (mc.numero_pensum ?? 0)
                }));

            // Solo las materias del pensum solicitado
            const materiasCarrera = await this.prisma.materia_carrera.findMany({
                where: {
                    id_carrera: carrera.id_carrera,
                    numero_pensum: numeroPensum
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

            // Detalle de materias de ese pensum
            const materiasInfo: MateriaResumen[] = [];
            for (const mc of materiasCarrera) {
                const mat = mc.materia;
                if (mat) {
                    // Equivalencias
                    const equivalencias = await this.prisma.equivalencias_materia.findMany({
                        where: {
                            OR: [
                                { id_materia_Origen: mat.id_materia },
                                { id_materia_equivalente: mat.id_materia }
                            ]
                        }
                    });
                    const equivalentes: { id: number | string, nombre: string | null, sigla: string | null }[] = [];
                    for (const eq of equivalencias) {
                        let idEquivalente: bigint;
                        if (eq.id_materia_Origen === mat.id_materia) {
                            idEquivalente = eq.id_materia_equivalente;
                        } else {
                            idEquivalente = eq.id_materia_Origen;
                        }
                        const materiaEq = await this.prisma.materia.findUnique({
                            where: { id_materia: idEquivalente }
                        });
                        if (materiaEq && materiaEq.nombre !== mat.nombre) {
                            equivalentes.push({
                                id: typeof materiaEq.id_materia === "bigint" ? Number(materiaEq.id_materia) : materiaEq.id_materia,
                                nombre: materiaEq.nombre,
                                sigla: materiaEq.siglas_materia
                            });
                        }
                    }

                    // Prerrequisitos
                    const prereq = mat.materia_preRequisito
                        .map(pr => ({
                            id: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.id_materia ?? "",
                            nombre: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.nombre,
                            sigla: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.siglas_materia,
                            total_materia: pr.total_materia
                        }))
                        .filter(pr => pr.nombre || (pr.total_materia && pr.total_materia > 0));

                    materiasInfo.push({
                        id: typeof mat.id_materia === "bigint" ? Number(mat.id_materia) : mat.id_materia,
                        nombre: mat.nombre,
                        siglas: mat.siglas_materia,
                        codigo: Number(mat.id_materia),
                        semestre: mc.semestre,
                        equivalencias: equivalentes.map(eq => ({
                            ...eq,
                            id: typeof eq.id === "bigint" ? Number(eq.id) : eq.id
                        })),
                        prerrequisitos: prereq.map(pr => ({
                            ...pr,
                            id: typeof pr.id === "bigint" ? Number(pr.id) : pr.id
                        })),
                    });
                }
            }

            return {
                carrera: carrera.nombre_carrera,
                pensum: numeroPensum,
                materias: materiasInfo,
                materiasIdNombrePensum // <-- TODAS las materias de todos los pensums
            };

        } catch (error) {
            console.error("[ERROR]", error);
            throw error;
        }
    }

    async getCarrerasConPensumPorUsuario(idUsuario: bigint | number) {
        const usuarioCarreras = await this.prisma.usuario_Carrera.findMany({
            where: { Id_usuario: BigInt(idUsuario) },
            include: {
                carrera: true,
            },
        });

        const resultado: {
            id_carrera: bigint;
            nombre_carrera: string;
            pensums: number[];
        }[] = [];

        for (const uc of usuarioCarreras) {
            if (!uc.carrera) continue;

            const materiasCarrera = await this.prisma.materia_carrera.findMany({
                where: { id_carrera: uc.carrera.id_carrera },
                select: { numero_pensum: true }
            });

            const pensumsUnicos = [
                ...new Set(
                    materiasCarrera.map(mc => Number(mc.numero_pensum)).filter(n => !isNaN(n))
                )
            ];

            resultado.push({
                id_carrera: uc.carrera.id_carrera,
                nombre_carrera: uc.carrera.nombre_carrera,
                pensums: pensumsUnicos,
            });
        }

        return resultado;
    }

    async actualizarPrerrequisitosMateria(idMateria: number, nuevosPrerreq: { id?: number, total_materia?: number }[]) {
        await this.prisma.materia_preRequisito.deleteMany({
            where: { id_materia: idMateria }
        });

        for (const pr of nuevosPrerreq) {
            await this.prisma.materia_preRequisito.create({
                data: {
                    id_materia: idMateria,
                    id_materia_preRequisito: pr.id ?? null,
                    total_materia: pr.total_materia ?? null
                }
            });
        }
        return { ok: true, message: "Prerrequisitos actualizados" };
    }


    async actualizarEquivalenciasMateria(idMateria: number, equivalencias: any[]) {
        await this.prisma.equivalencias_materia.deleteMany({
            where: {
                OR: [
                    { id_materia_Origen: idMateria }
                ]
            }
        });

        for (const idEq of equivalencias) {
            await this.prisma.equivalencias_materia.create({
                data: {
                    id_materia_Origen: idMateria,
                    id_materia_equivalente: Number(idEq.id)
                }
            });
        }
        return { ok: true, message: "Equivalencias actualizadas" };
    }


    async updateEstudianteByRegistro(data: EstudianteData) {
        const nroRegistro = String(data.registro);

        const estudiante = await this.prisma.estudiante.findFirst({
            where: { nroRegistro },
        });

        if (!estudiante) {
            return null;
        }

        return this.prisma.estudiante.update({
            where: { id_estudiante: estudiante.id_estudiante },
            data: {
                estado: data.estado,
                turno_inscripcion: data.turno_inscripcion,
                turno_moda: data.turno_moda,
                semestre_ingreso: data.semestre_ingreso,
                semestre_ultimo: data.semestre_ultimo,
                updated_at: new Date(),
            },
        });
    }
    async updateEstudiantesBatch(lista: EstudianteData[]) {
        return Promise.all(
            lista.map((est) => this.updateEstudianteByRegistro(est))
        );
    }

    //para el chatbot posiblemente se elimine 
    async avancePensum({ registro, nombre, numeroPensum }: { registro?: string; nombre?: string; numeroPensum: number }) {
        // 1. Busca estudiante por registro o nombre (exacto o con LIKE, ajusta a tu necesidad)
        const orConditions = [
            registro ? { nroRegistro: { equals: registro } } : undefined,
            nombre
                ? {
                    Persona: {
                        Nombre: { contains: nombre, mode: 'insensitive' },
                    },
                }
                : undefined,
        ].filter(Boolean) as any[]; // Ensure no undefined values

        const estudiante = await this.prisma.estudiante.findFirst({
            where: {
                OR: orConditions,
            },
            include: {
                Persona: true,
                estudiante_Carrera: { include: { carrera: true } },
                estudiantes_materia: {
                    include: { materia: true },
                },
            },
        });

        if (!estudiante) {
            throw new Error('Estudiante no encontrado');
        }

        // 2. Buscar el pensum (materias) para la carrera y pensum dados
        const materiasPensum = await this.prisma.materia_carrera.findMany({
            where: {
                id_carrera: estudiante.estudiante_Carrera[0]?.Id_Carrera,
                numero_pensum: numeroPensum,
            },
            include: { materia: true },
        });

        // 3. Marcar materias cursadas/aprobadas/pending
        const idsMateriasCursadas = new Set(
            estudiante.estudiantes_materia.map((em) => em.id_materia),
        );
        const avance = materiasPensum.map((mc) => {
            const cursada = estudiante.estudiantes_materia.find(
                (em) => em.id_materia === mc.id_materia,
            );
            return {
                materia: mc.materia?.nombre,
                sigla: mc.materia?.siglas_materia,
                estado: cursada?.estado || 'pendiente',
            };
        });

        return {
            estudiante: {
                nombre: `${estudiante.Persona?.Nombre || ''} ${estudiante.Persona?.Apellido1 || ''} ${estudiante.Persona?.Apellido2 || ''}`,
                registro: estudiante.nroRegistro,
                carrera: estudiante.estudiante_Carrera[0]?.carrera?.nombre_carrera,
                pensum: numeroPensum,
                estado: estudiante.estado,
            },
            avance,
        };
    }


    async recomendarHorariosMateriasFaltantes(nombreCarrera: string, numeroPensum: number) {
        // Parámetros configurables:
        const PORCENTAJE_MINIMO_VENCIDO = 0.80; // 80%
        const ARRASTRES_MAXIMOS = 2;            // Hasta 2 materias pendientes permitidas

        // Calcular semestre actual y anterior dinámicamente
        const ahora = new Date();
        const anioActual = ahora.getFullYear();
        const mesActual = ahora.getMonth() + 1; // Enero=0
        let semestreActual = "";
        let semestreAnterior = "";
        if (mesActual >= 1 && mesActual <= 6) {
            semestreActual = `${anioActual}-1`;
            semestreAnterior = `${anioActual - 1}-2`;
        } else {
            semestreActual = `${anioActual}-2`;
            semestreAnterior = `${anioActual}-1`;
        }

        function extraerSemestreValido(estudiante: any): string | null {
            return estudiante.semestre_ultimo || estudiante.semestre_ingreso || null;
        }

        const carrera = await this.prisma.carrera.findFirst({
            where: { nombre_carrera: nombreCarrera }
        });
        if (!carrera) throw new Error("Carrera no encontrada");

        const materiasPensum = await this.prisma.materia_carrera.findMany({
            where: {
                id_carrera: carrera.id_carrera,
                numero_pensum: numeroPensum
            },
            include: {
                materia: {
                    include: {
                        materia_preRequisito: true
                    }
                }
            }
        });

        const estudiantesCarrera = await this.prisma.estudiante_Carrera.findMany({
            where: { Id_Carrera: carrera.id_carrera },
            include: {
                estudiante: {
                    include: {
                        estudiantes_materia: true,
                        Persona: true
                    }
                }
            }
        });

        // --- FILTRO SOLO ESTUDIANTES DEL SEMESTRE ACTUAL O ANTERIOR ---
        const estudiantesCarreraRegulares = estudiantesCarrera.filter(ec => {
            if (
                !ec.estudiante ||
                !ec.estudiante.estado ||
                ec.estudiante.estado.trim().toLowerCase() !== 'regular'
            ) return false;

            const semestre = extraerSemestreValido(ec.estudiante);

            return semestre === semestreActual || semestre === semestreAnterior;
        });
        // -------------------------------------------------------------

        // Materias agrupadas por semestre
        const materiasPorSemestre: Record<string, string[]> = {};
        for (const mp of materiasPensum) {
            if (mp.semestre && mp.id_materia) {
                if (!materiasPorSemestre[mp.semestre]) {
                    materiasPorSemestre[mp.semestre] = [];
                }
                materiasPorSemestre[mp.semestre].push(mp.id_materia.toString());
            }
        }

        // Mapeo materia → semestre
        const materiaASemestre = Object.entries(materiasPorSemestre).reduce((acc, [sem, ids]) => {
            for (const id of ids) acc[id] = parseInt(sem);
            return acc;
        }, {} as Record<string, number>);

        type ResultadoMateriaHorario = {
            materia: {
                id: bigint | number | null;
                nombre: string | null;
                sigla: string | null;
                semestre: string | null;
            };
            horarios: {
                turno: string;
                estudiantes: number;
                grupos_sugeridos: number;
                estudiantes_en_espera: number;
                detalle_estudiantes: {
                    nombre: string;
                    registro: string;
                    semestre_actual: number;
                }[];
            }[];
        };

        const resultado: ResultadoMateriaHorario[] = [];

        for (const mp of materiasPensum) {
            const idMateria = mp.id_materia;
            const prerequisitos = mp.materia?.materia_preRequisito || [];

            const estudiantesQueLaNecesitan = estudiantesCarreraRegulares.filter(ec => {
                if (!ec.estudiante) return false;

                const materiasAprobadas = ec.estudiante.estudiantes_materia
                    .filter(em => em.estado === "aprobado")
                    .map(em => em.id_materia?.toString());

                // ---------- Lógica de avance controlado (vencidos + arrastre) ----------
                let ultimoSemestreVencido = 0;
                let arrastresAcumulados = 0;
                const semestresOrdenados = Object.entries(materiasPorSemestre)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
                let arrastresPorSemestre: number[] = [];
                // Paso 1: Identificar el último semestre vencido
                for (const [sem, materias] of semestresOrdenados) {
                    const total = materias.length;
                    const aprobadas = materias.filter(id => materiasAprobadas.includes(id)).length;
                    const porcentaje = total > 0 ? aprobadas / total : 0;
                    if (porcentaje >= PORCENTAJE_MINIMO_VENCIDO) {
                        ultimoSemestreVencido = parseInt(sem);
                        arrastresPorSemestre.push(total - aprobadas); // Guardar arrastres de este semestre
                    } else {
                        arrastresPorSemestre.push(total - aprobadas);
                        break;
                    }
                }
                arrastresAcumulados = arrastresPorSemestre.slice(0, ultimoSemestreVencido).reduce((acc, n) => acc + n, 0);

                let semestreEstimado = ultimoSemestreVencido;
                if (arrastresAcumulados <= ARRASTRES_MAXIMOS) {
                    semestreEstimado = ultimoSemestreVencido + 1;
                }

                const semestreMateria = mp.semestre ? parseInt(mp.semestre) : Infinity;
                if (semestreMateria > semestreEstimado + 2) return false;

                // Prerrequisitos
                const idsReq = prerequisitos.map(p => p.id_materia_preRequisito);
                const totalReq = prerequisitos[0]?.total_materia ?? 0;

                const aprobadasRequeridas = idsReq.every(reqId =>
                    reqId && ec.estudiante && ec.estudiante.estudiantes_materia.some(em => em.id_materia === reqId && em.estado === 'aprobado')
                );

                // El total de materias aprobadas, incluyendo solo las válidas
                const totalMaterias = materiasAprobadas.filter(id => id && materiaASemestre[id.toString()] !== undefined).length;
                const cumpleTotalRequisitos = totalMaterias >= totalReq;

                // No permitir si ya cursó esta materia
                const yaCursada = ec.estudiante.estudiantes_materia.some(em => em.id_materia === idMateria && em.estado === 'aprobado');
                if (yaCursada) return false;

                // Guardar el semestre calculado
                ec.estudiante["semestre_estimado"] = semestreEstimado;
                return aprobadasRequeridas && cumpleTotalRequisitos;
            });

            // Agrupación por horarios (preferencia del estudiante)
            const conteoHorarios: Record<string, { estudiantes: Set<number>, detalle: { nombre: string, registro: string, semestre_actual: number }[] }> = {};

            estudiantesQueLaNecesitan.forEach(ec => {
                const e = ec.estudiante;
                if (e) {
                    let turnoElegido: string | null = null;
                    if (e.turno_moda && e.turno_moda.trim().toLowerCase() !== 'nada') {
                        turnoElegido = e.turno_moda.trim();
                    } else if (e.turno_inscripcion && e.turno_inscripcion.trim().toLowerCase() !== 'nada') {
                        turnoElegido = e.turno_inscripcion.trim();
                    }

                    if (turnoElegido) {
                        if (!conteoHorarios[turnoElegido]) {
                            conteoHorarios[turnoElegido] = { estudiantes: new Set(), detalle: [] };
                        }
                        conteoHorarios[turnoElegido].estudiantes.add(Number(e.id_estudiante));
                        conteoHorarios[turnoElegido].detalle.push({
                            nombre: `${e.Persona?.Nombre || ''} ${e.Persona?.Apellido1 || ''}`.trim(),
                            registro: e.nroRegistro || '',
                            semestre_actual: e["semestre_estimado"] || 1
                        });
                    }
                }
            });

            const horariosRanking = Object.entries(conteoHorarios)
                .map(([turno, data]) => ({
                    turno,
                    estudiantes: data.estudiantes.size,
                    grupos_sugeridos: Math.floor(data.estudiantes.size / 30),
                    estudiantes_en_espera: data.estudiantes.size % 30,
                    detalle_estudiantes: data.detalle
                }))
                .sort((a, b) => b.estudiantes - a.estudiantes);

            if (mp.materia) {
                resultado.push({
                    materia: {
                        id: mp.materia.id_materia,
                        nombre: mp.materia.nombre,
                        sigla: mp.materia.siglas_materia,
                        semestre: mp.semestre
                    },
                    horarios: horariosRanking
                });
            }
        }

        return resultado;
    }





    async registrarDocentesDesdeJson(json: EntradaDocente[]) {
        for (const entrada of json) {
            const materia = await this.prisma.materia.findFirst({
                where: { cod_materia: BigInt(entrada.mat_codigo) }
            });
            if (!materia) {
                console.warn(`Materia con cod_materia ${entrada.mat_codigo} no encontrada`);
                continue;
            }

            let persona = await this.prisma.persona.findFirst({
                where: {
                    OR: [
                        { CI: entrada.agd_docnro },
                        {
                            Nombre: entrada.agd_nombres,
                            Apellido1: entrada.agd_appaterno,
                            Apellido2: entrada.agd_apmaterno,
                        }
                    ]
                }
            });

            if (!persona) {
                persona = await this.prisma.persona.create({
                    data: {
                        Nombre: entrada.agd_nombres,
                        Apellido1: entrada.agd_appaterno,
                        Apellido2: entrada.agd_apmaterno,
                        CI: entrada.agd_docnro,
                    }
                });
            }

            let tribunalDocente = await this.prisma.tribunal_Docente.findFirst({
                where: {
                    id_Persona: persona.Id_Persona,
                    nroAgenda: entrada.agd_docnro,
                }
            });
            if (!tribunalDocente) {
                tribunalDocente = await this.prisma.tribunal_Docente.create({
                    data: {
                        id_Persona: persona.Id_Persona,
                        nroAgenda: entrada.agd_docnro,
                        estado: true,
                    }
                });
            }

            const horarioExistente = await this.prisma.horario_materia.findFirst({
                where: {
                    id_docente: tribunalDocente.id_tribunal,
                    id_materia: materia.id_materia,
                    grupo: entrada.pln_grupo,
                    gestion: entrada.semestre,
                    Modalidad: entrada.mdl_descripcion,
                    modulo_inicio: parseInt(entrada.mdu_codigo),
                }
            });

            if (!horarioExistente) {
                await this.prisma.horario_materia.create({
                    data: {
                        id_materia: materia.id_materia,
                        id_docente: tribunalDocente.id_tribunal,
                        grupo: entrada.pln_grupo,
                        gestion: entrada.semestre,
                        Modalidad: entrada.mdl_descripcion,
                        modulo_inicio: parseInt(entrada.mdu_codigo),
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });
            }
        }
        return { ok: true };
    }
    private getGestionActual(): string {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const s = m <= 6 ? 1 : 2;
        return `${y}-${s}`;
    }

    async obtenerMateriasYDocentesGestionActual() {
        const gestionActual = this.getGestionActual();

        const horariosActuales = await this.prisma.horario_materia.findMany({
            where: { gestion: gestionActual },
            include: {
                materia: true,
            },
            orderBy: [
                { modulo_inicio: 'asc' },
                { turno: 'asc' },
                { id_horario: 'asc' },
            ],
        });

        const materias = horariosActuales.map((h) => ({
            id: String(h.id_horario),
            nombre: h.materia?.nombre ?? '',
            sigla: h.materia?.siglas_materia ?? '',
            horario: h.horario ?? '',
            modulo: h.modulo_inicio != null ? `M${h.modulo_inicio}` : '',
            biModular: h.BiModular ?? false,
        }));

        const docentesRaw = await this.prisma.tribunal_Docente.findMany({
            include: {
                Persona: true,
                horario_materia: {
                    include: { materia: true },
                },
            },
        });

        const docentes = docentesRaw.map((doc) => ({
            docente: {
                id: String(doc.id_tribunal),
                nombres: doc.Persona?.Nombre ?? '',
                ap_paterno: doc.Persona?.Apellido1 ?? '',
                ap_materno: doc.Persona?.Apellido2 ?? '',
                ci: doc.Persona?.CI ?? '',
            },
            gestion:
                doc.horario_materia.length > 0
                    ? (doc.horario_materia
                        .map((h) => h.gestion)
                        .filter(Boolean)
                        .sort()
                        .pop() as string)
                    : null,
            materias: doc.horario_materia.map((h) => ({
                materia: h.materia?.nombre ?? '',
                sigla: h.materia?.siglas_materia ?? '',
                grupo: h.grupo ?? '',
                modulo_inicio: h.modulo_inicio ?? null,
                modalidad: h.Modalidad ?? '',
                gestion: h.gestion ?? '',
            })),
        }));

        return { materias, docentes };
    }

}
