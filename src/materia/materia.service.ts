import { estudiante_Carrera, materia_preRequisito, estudiantes_materia } from './../../node_modules/.prisma/client/index.d';
import { BadRequestException, Injectable } from '@nestjs/common';
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
        // ---------- Helpers ----------
        const romanMap: Record<string, string> = {
            ' i ': ' 1 ', ' ii ': ' 2 ', ' iii ': ' 3 ', ' iv ': ' 4 ', ' v ': ' 5 ',
            ' vi ': ' 6 ', ' vii ': ' 7 ', ' viii ': ' 8 ', ' ix ': ' 9 ', ' x ': ' 10 ',
        };
        const normalizeBasic = (s?: string | null) =>
            (s ?? '')
                .normalize('NFD').replace(/\p{Diacritic}/gu, '') // quita tildes
                .toLowerCase()
                .replace(/[^a-z0-9 ]+/g, ' ')                    // quita signos
                .replace(/\s+/g, ' ')
                .trim();

        const normalizeWithRomans = (s?: string | null) => {
            let t = ` ${normalizeBasic(s)} `;
            for (const [r, n] of Object.entries(romanMap)) t = t.replace(new RegExp(r, 'g'), n);
            // inverso (por si DB usa romanos y entrada arábigos)
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
            return 1 - d / maxLen; // 1 idéntico, 0 nada
        };
        const toBigInt = (v: unknown): bigint | null => {
            if (v === null || v === undefined) return null;
            return typeof v === 'bigint' ? v : BigInt(v as number);
        };

        // ---------- 1) Buscar si el estudiante ya existe ----------
        const estudianteExistente = await this.prisma.estudiante.findFirst({
            where: { nroRegistro: data.nroRegistro },
            include: {
                estudiante_Carrera: { select: { Id_CarreraEstudiante: true, Id_Carrera: true } },
            },
        });

        // Decidir si creamos entidades base
        let persona: any = null;
        let estudiante: any = null;
        let usuario: any = null;

        if (!estudianteExistente) {
            // Crear persona/estudiante/usuario/rol solo si NO existe
            const personaPayload = {
                Nombre: data.persona?.nombre ?? "",
                Apellido1: data.persona?.apellido1 ?? "",
                Apellido2: data.persona?.apellido2 ?? "",
                Correo: data.persona?.correo ?? "",
                CI: data.persona?.ci ?? "",
                telefono: data.persona?.telefono ? Number(data.persona.telefono) : undefined,
            };

            persona = await this.prisma.persona.create({ data: personaPayload });

            estudiante = await this.prisma.estudiante.create({
                data: { nroRegistro: data.nroRegistro, id_Persona: persona.Id_Persona },
            });

            const hashedPassword = await bcrypt.hash("12345678", 10);

            // Crea usuario solo si no existe usuario con ese Nombre_Usuario
            const usuarioExist = await this.prisma.usuario.findFirst({
                where: { Nombre_Usuario: data.nroRegistro },
                select: { Id_Usuario: true },
            });
            if (!usuarioExist) {
                usuario = await this.prisma.usuario.create({
                    data: {
                        Nombre_Usuario: data.nroRegistro,
                        Password: hashedPassword,
                        Id_Persona: persona.Id_Persona,
                    },
                });
                await this.prisma.usuario_Rol.create({
                    data: { Id_Usuario: usuario.Id_Usuario, Id_Rol: 2 },
                });
            }

            // Vincular carrera
            await this.prisma.estudiante_Carrera.create({
                data: { Id_Estudiante: estudiante.id_estudiante, Id_Carrera: data.carreraId },
            });
        } else {
            // Ya existe: no creamos persona/usuario; reusamos estudiante
            estudiante = estudianteExistente;

            // Si no tiene vínculo de carrera, créalo con el carreraId recibido
            const hasCarrera = estudianteExistente.estudiante_Carrera.length > 0;
            if (!hasCarrera && data.carreraId) {
                await this.prisma.estudiante_Carrera.create({
                    data: { Id_Estudiante: estudiante.id_estudiante, Id_Carrera: data.carreraId },
                });
            }
        }

        // ---------- 2) Registrar materias SOLO si se enviaron ----------
        const materiasInput = Array.isArray(data.materias) ? data.materias : [];
        if (materiasInput.length > 0) {
            // Recuperar (o crear si faltaba) el vínculo de carrera más reciente
            const vinculoCarrera = await this.prisma.estudiante_Carrera.findFirst({
                where: { Id_Estudiante: estudiante.id_estudiante },
                orderBy: { Id_CarreraEstudiante: 'desc' },
                select: { Id_Carrera: true },
            });
            if (!vinculoCarrera?.Id_Carrera) throw new Error('El estudiante no tiene carrera asociada');

            const idCarrera = vinculoCarrera.Id_Carrera;

            // Último pensum de esa carrera
            const { _max } = await this.prisma.materia_carrera.aggregate({
                where: { id_carrera: idCarrera },
                _max: { numero_pensum: true },
            });
            const ultimoPensum = _max.numero_pensum;
            if (ultimoPensum == null) throw new Error('La carrera no tiene pensum registrado');

            // Materias del último pensum
            const materiasPensum = await this.prisma.materia.findMany({
                where: {
                    nombre: { not: null },
                    materia_carrera: { some: { id_carrera: idCarrera, numero_pensum: ultimoPensum } },
                },
                select: { id_materia: true, nombre: true },
            });
            const idsPensum = materiasPensum.map(m => m.id_materia);

            // Equivalencias asociadas al pensum (para aceptar nombres de otras versiones)
            const equivalencias = await this.prisma.equivalencias_materia.findMany({
                where: {
                    OR: [
                        { id_materia_Origen: { in: idsPensum } },
                        { id_materia_equivalente: { in: idsPensum } },
                    ],
                },
                select: { id_materia_Origen: true, id_materia_equivalente: true },
            });

            // Materias equivalentes “externas” (no en el último pensum) para construir alias
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

            // Construcción de alias normalizados -> id_materia (del último pensum)
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

                // Fuzzy
                let bestKey = '';
                let bestScore = 0;
                for (const k of aliasKeys) {
                    const s = similarity(norm, k);
                    if (s > bestScore) { bestScore = s; bestKey = k; }
                }
                if (bestScore >= THRESHOLD) return aliasToId.get(bestKey);
                return undefined;
            };

            // Registrar SOLO si no existe (skip si ya está)
            await this.prisma.$transaction(async (tx) => {
                for (const mat of materiasInput) {
                    const idMateria = pickIdByNombre(mat.nombre);
                    if (!idMateria) {
                        console.error('Materia NO mapeada al último pensum:', mat.nombre);
                        // Saltar o lanzar error. Si prefieres NO romper el flujo, descomenta:
                        // continue;
                        throw new Error(`Materia no pertenece al último pensum o no existe: ${mat.nombre}`);
                    }

                    // ¿Ya existe la inscripción? -> saltar
                    const yaExiste = await tx.estudiantes_materia.findUnique({
                        where: {
                            id_estudiante_id_materia_Gestion: {
                                id_estudiante: estudiante.id_estudiante,
                                id_materia: idMateria,
                                Gestion: mat.gestion,
                            },
                        },
                        select: { id_estudiante_materia: true },
                    });
                    if (yaExiste) continue;

                    // Crear nueva inscripción
                    await tx.estudiantes_materia.create({
                        data: {
                            id_estudiante: estudiante.id_estudiante,
                            id_materia: idMateria,
                            calificacion: mat.nota ?? null,
                            estado: mat.estado,
                            Gestion: mat.gestion,
                        },
                    });
                }
            });
        }

        return {
            message: estudianteExistente ? "Estudiante existente: materias actualizadas (idempotente)" : "Estudiante creado con éxito",
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
            codigo: number | null,
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

        // Helpers
        const toBigInt = (v: unknown): bigint | null => {
            if (v === null || v === undefined) return null;
            return typeof v === 'bigint' ? v : BigInt(v as number);
        };
        const normalizeText = (s?: string | null) => (s ?? '').trim().toLowerCase();
        const isApproved = (estado?: string | null) => {
            const e = normalizeText(estado);
            // soporta "aprobado", "aprobada", variantes con espacios o mayúsculas
            return e === 'aprobado' || e === 'aprobada' || e.startsWith('aprob');
        };

        try {
            const estudiante = await this.prisma.estudiante.findFirst({
                where: { nroRegistro },
                include: {
                    estudiante_Carrera: { include: { carrera: true } },
                    // Traemos la materia de cada cursada para poder comparar por código, nombre y sigla
                    estudiantes_materia: {
                        include: {
                            materia: {
                                select: {
                                    id_materia: true,
                                    nombre: true,
                                    siglas_materia: true,
                                    cod_materia: true,
                                    // para filtrar “aprobadas” por misma carrera del ciclo actual
                                    materia_carrera: { select: { id_carrera: true, numero_pensum: true } }
                                }
                            }
                        }
                    }
                }
            });

            if (!estudiante) throw new Error("Estudiante no encontrado");

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

            // Recorremos cada carrera del estudiante
            for (const estCarr of estudiante.estudiante_Carrera) {
                // ---------------------------------------
                // 1) Determinar el pensum (mejor match; si no, último oficial)
                // ---------------------------------------
                const materiasPorPensum = await this.prisma.materia_carrera.findMany({
                    where: { id_carrera: estCarr.Id_Carrera },
                    select: { numero_pensum: true, id_materia: true }
                });

                const pensumMateriasMap = new Map<number, bigint[]>();
                for (const item of materiasPorPensum) {
                    if (item.numero_pensum == null) continue; // evita bug “0 falsy”
                    const numeroPensum = Number(item.numero_pensum);
                    if (!pensumMateriasMap.has(numeroPensum)) pensumMateriasMap.set(numeroPensum, []);
                    if (item.id_materia != null) pensumMateriasMap.get(numeroPensum)!.push(item.id_materia);
                }

                // IDs cursados (todas las cursadas del estudiante) normalizados a bigint
                const idsCursados: bigint[] = estudiante.estudiantes_materia
                    .map(em => toBigInt(em.id_materia))
                    .filter((x): x is bigint => x !== null);

                let pensumDetectado: number | null = null;
                let maxMateriasCursadas = -1;

                for (const [numeroPensum, materiasIds] of pensumMateriasMap.entries()) {
                    const setIds = new Set<bigint>(materiasIds.map(v => BigInt(v)));
                    const cursadas = idsCursados.filter(id => setIds.has(id)).length;
                    if (cursadas > maxMateriasCursadas) {
                        maxMateriasCursadas = cursadas;
                        pensumDetectado = numeroPensum;
                    }
                }

                if (pensumDetectado === null) {
                    const { _max } = await this.prisma.materia_carrera.aggregate({
                        where: { id_carrera: estCarr.Id_Carrera },
                        _max: { numero_pensum: true }
                    });
                    pensumDetectado = _max.numero_pensum != null ? Number(_max.numero_pensum) : null;
                }
                if (pensumDetectado === null) throw new Error("No se pudo determinar el pensum del estudiante.");

                // ---------------------------------------
                // 2) Construir sets de materias APROBADAS del estudiante
                //    — solo las que pertenezcan a esta CARRERA (evita falsos positivos)
                // ---------------------------------------
                const idCarreraBI = toBigInt(estCarr.Id_Carrera);
                const aprobadasId = new Set<bigint>();
                const aprobadasCod = new Set<string>();       // cod_materia como string
                const aprobadasNombre = new Set<string>();    // nombre normalizado
                const aprobadasSigla = new Set<string>();     // sigla normalizada

                for (const em of estudiante.estudiantes_materia) {
                    if (!isApproved(em.estado)) continue;
                    const matEm = em.materia;
                    // Solo contamos como “aprobada” si la materia está vinculada a esta carrera
                    const perteneceACarrera = matEm?.materia_carrera?.some(mc => {
                        return toBigInt(mc.id_carrera) === idCarreraBI;
                    });
                    if (!perteneceACarrera) continue;

                    const id = toBigInt(em.id_materia);
                    if (id !== null) aprobadasId.add(id);

                    if (matEm?.cod_materia != null) aprobadasCod.add(String(matEm.cod_materia));
                    if (matEm?.nombre) aprobadasNombre.add(normalizeText(matEm.nombre));
                    if (matEm?.siglas_materia) aprobadasSigla.add(normalizeText(matEm.siglas_materia));
                }

                // ---------------------------------------
                // 3) Materias del pensum elegido para esta carrera
                // ---------------------------------------
                const materiasCarrera = await this.prisma.materia_carrera.findMany({
                    where: {
                        id_carrera: estCarr.Id_Carrera,
                        numero_pensum: BigInt(pensumDetectado)
                    },
                    include: {
                        materia: {
                            include: {
                                materia_preRequisito: {
                                    include: {
                                        materia_materia_preRequisito_id_materia_preRequisitoTomateria: true
                                    }
                                }
                            }
                        }
                    }
                });

                const materiasInfo: MateriaResumen[] = [];

                for (const mc of materiasCarrera) {
                    const mat = mc.materia;
                    if (!mat) continue;

                    // --- Equivalencias (id ↔ id)
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
                        const idEquivalente =
                            eq.id_materia_Origen === mat.id_materia
                                ? eq.id_materia_equivalente
                                : eq.id_materia_Origen;

                        const materiaEq = await this.prisma.materia.findUnique({
                            where: { id_materia: idEquivalente },
                            select: { nombre: true }
                        });
                        if (materiaEq && materiaEq.nombre !== mat.nombre) {
                            equivalentes.push(String(materiaEq.nombre));
                            idsEquivalentes.push(idEquivalente);
                        }
                    }

                    // --- Prerrequisitos ya asociados
                    const prereq = (mat.materia_preRequisito ?? [])
                        .map(pr => ({
                            nombre: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.nombre,
                            sigla: pr.materia_materia_preRequisito_id_materia_preRequisitoTomateria?.siglas_materia,
                            total_materia: pr.total_materia
                        }))
                        .filter(pr => pr.nombre || (pr.total_materia && pr.total_materia > 0));

                    // --- Estado/APROBADA (con fallbacks)
                    let estado: string | null = null;

                    const idMat = toBigInt(mat.id_materia);
                    if (idMat && aprobadasId.has(idMat)) {
                        estado = 'aprobada';
                    } else if (idsEquivalentes.some(idEq => aprobadasId.has(idEq))) {
                        estado = 'aprobada_por_equivalencia';
                    } else {
                        // Fallback por código, nombre, sigla (misma carrera)
                        const cod = mat.cod_materia != null ? String(mat.cod_materia) : null;
                        const nom = normalizeText(mat.nombre);
                        const sig = normalizeText(mat.siglas_materia);

                        if ((cod && aprobadasCod.has(cod)) ||
                            (nom && aprobadasNombre.has(nom)) ||
                            (sig && aprobadasSigla.has(sig))) {
                            estado = 'aprobada_por_coincidencia';
                        }
                    }

                    // --- Veces cursada (por ID exacto)
                    const vecesCursada = estudiante.estudiantes_materia.filter(
                        em => toBigInt(em.id_materia) === idMat
                    ).length;

                    // --- Puede cursar (prerrequisitos)
                    let puedeCursar = false;
                    if (estado === 'aprobada' || estado === 'aprobada_por_equivalencia' || estado === 'aprobada_por_coincidencia') {
                        puedeCursar = false;
                    } else if (prereq.length === 0) {
                        puedeCursar = true;
                    } else {
                        puedeCursar = true;
                        for (const pr of prereq) {
                            if (pr.total_materia && pr.total_materia > 0) {
                                // Nota: aquí podrías contar por carrera si lo necesitas; por ahora cuenta global del estudiante
                                const totalAprobadas = estudiante.estudiantes_materia.filter(em => isApproved(em.estado)).length;
                                if (totalAprobadas < pr.total_materia) {
                                    puedeCursar = false;
                                    break;
                                }
                            } else {
                                // Resolver prerrequisito por nombre dentro de la MISMA carrera/pensum
                                const matReq = await this.prisma.materia.findFirst({
                                    where: {
                                        nombre: { equals: pr.nombre ?? '', mode: 'insensitive' },
                                        materia_carrera: {
                                            some: {
                                                id_carrera: estCarr.Id_Carrera,
                                                numero_pensum: BigInt(pensumDetectado)
                                            }
                                        }
                                    }
                                });

                                if (!matReq) { puedeCursar = false; break; }

                                const aproboMateriaReq = estudiante.estudiantes_materia.some(
                                    em => toBigInt(em.id_materia) === toBigInt(matReq.id_materia) && isApproved(em.estado)
                                );

                                // Equivalencias de la requerida
                                const equivalenciasReq = await this.prisma.equivalencias_materia.findMany({
                                    where: {
                                        OR: [
                                            { id_materia_Origen: matReq.id_materia },
                                            { id_materia_equivalente: matReq.id_materia }
                                        ]
                                    }
                                });
                                const idsEquivReq: bigint[] = equivalenciasReq.map(eq =>
                                    eq.id_materia_Origen === matReq.id_materia
                                        ? eq.id_materia_equivalente
                                        : eq.id_materia_Origen
                                );

                                const aproboEquivalenteReq = estudiante.estudiantes_materia.some(em => {
                                    const id = toBigInt(em.id_materia);
                                    return id !== null && idsEquivReq.includes(id) && isApproved(em.estado);
                                });

                                if (!aproboMateriaReq && !aproboEquivalenteReq) {
                                    puedeCursar = false;
                                    break;
                                }
                            }
                        }
                    }

                    // --- Horarios (original + equivalentes)
                    const horariosAbiertos = await this.prisma.horario_materia.findMany({
                        where: { id_materia: mat.id_materia, estado: true }
                    });

                    const horariosEquivalentes = idsEquivalentes.length
                        ? await this.prisma.horario_materia.findMany({
                            where: { id_materia: { in: idsEquivalentes }, estado: true },
                            include: {
                                materia: { select: { nombre: true, siglas_materia: true, id_materia: true } }
                            }
                        })
                        : [];

                    const todosLosHorarios = [
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
            id_docente: String(h.id_docente)?.replace('null', ''),
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


    async asignarDocente(
        horarioId: number,
        docenteId?: number | null
    ) {
        if (horarioId == null) {
            throw new BadRequestException('horarioId es requerido');
        }

        const id_horario = Number(horarioId);
        const id_docente =
            docenteId === null || docenteId === undefined || String(docenteId).trim() === ''
                ? null
                : Number(docenteId);

        const updated = await this.prisma.horario_materia.update({
            where: { id_horario },
            data: {
                id_docente,
                updated_at: new Date(),
            },
        });

        return {
            ok: true,
            horario: {
                id: updated.id_horario,
                gestion: updated.gestion,
                horario: updated.horario,
                modulo_inicio: updated.modulo_inicio,
                BiModular: updated.BiModular,
            }
        };
    }


}
