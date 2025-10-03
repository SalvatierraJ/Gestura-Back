
import { Injectable, HttpException, HttpStatus, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { NotificacionService } from 'src/notificacion/notificacion.service';

@Injectable()
export class DefensaService {
    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    /**
     * Obtiene los datos de notificación de la última defensa de uno o varios estudiantes.
     * No envía correos, solo retorna los datos que se enviarían.
     */
    async previewNotificacionEmailUltimaDefensa(estudiantes: number[] | number) {
        const estudiantesIds = Array.isArray(estudiantes) ? estudiantes : [estudiantes];
        const resultados: any[] = [];
        for (const idEstudianteRaw of estudiantesIds) {
            const idEstudiante = Number(idEstudianteRaw);
            // Última defensa con joins necesarios
            const defensa = await this.prisma.defensa.findFirst({
                where: { id_estudiante: idEstudiante },
                orderBy: { id_defensa: 'desc' },
                include: {
                    estudiante: { include: { Persona: true } },
                    Tipo_Defensa: true,
                    area: true,
                    casos_de_estudio: true,
                }
            });
            if (!defensa) {
                resultados.push({ idEstudiante, error: 'No tiene defensas registradas' });
                continue;
            }
            const persona = defensa.estudiante?.Persona;
            const nombreCompleto = persona ? `${persona.Nombre} ${persona.Apellido1} ${persona.Apellido2 || ''}`.trim() : null;
            const email = persona?.Correo || null;
            const fechaUtc = defensa.fecha_defensa ? new Date(defensa.fecha_defensa) : null;
            const fechaFormateada = fechaUtc ? fechaUtc.toLocaleString('es-BO', {
                timeZone: 'UTC',
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : null;
            resultados.push({
                idEstudiante,
                nombreCompleto,
                email,
                tipo_defensa: defensa.Tipo_Defensa?.Nombre || null,
                area: defensa.area?.nombre_area || null,
                caso: defensa.casos_de_estudio?.Nombre_Archivo || null,
                url: defensa.casos_de_estudio?.url || null,
                fecha: defensa.fecha_defensa,
                fechaFormateada,
                estado: defensa.estado,
            });
        }
        return resultados;
    }

    async generarDefensa(estudiantes: number[] | number, body: any) {
        const estudiantesIds = Array.isArray(estudiantes) ? estudiantes : [estudiantes];
        const { sorteaArea, sorteaCaso, tipoDefensa } = body;
        const fechaDefensa = new Date(body.fechaHora);
        const defensasCreadas: any[] = [];
        const shuffle = <T,>(arr: T[]): T[] => {
            const a = arr.slice();
            for (let i = a.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [a[i], a[j]] = [a[j], a[i]];
            }
            return a;
        };

        return await this.prisma.$transaction(async (tx) => {
            // Casos ya usados en la fecha (prohibido repetir en la misma fecha)
            const defensasMismaFecha = await tx.defensa.findMany({
                where: { fecha_defensa: fechaDefensa, id_casoEstudio: { not: null } },
                select: { id_casoEstudio: true }
            });
            const casosYaAsignadosEnFecha = new Set(defensasMismaFecha.map(d => d.id_casoEstudio!.toString()));

            // Conteo histórico de usos por caso (para no superar 2)
            const usosHistoricos = await tx.defensa.groupBy({
                by: ['id_casoEstudio'],
                _count: { id_casoEstudio: true },
                where: { id_casoEstudio: { not: null } }
            });
            const totalUsosCaso = new Map<string, number>();
            for (const row of usosHistoricos) {
                if (row.id_casoEstudio != null) {
                    totalUsosCaso.set(row.id_casoEstudio.toString(), row._count.id_casoEstudio);
                }
            }

            // Helper: elegir un caso en un área cumpliendo restricciones
            const pickCasoEnArea = async (idArea: number) => {
                const casos = await tx.casos_de_estudio.findMany({
                    where: { id_area: idArea, estado: true },
                    select: { id_casoEstudio: true, Nombre_Archivo: true }
                });

                // Filtrar por: no usado en la fecha y uso total < 2
                const candidatos = casos.filter(c => {
                    const idStr = c.id_casoEstudio.toString();
                    const usadosFecha = casosYaAsignadosEnFecha.has(idStr);
                    const usosTotales = totalUsosCaso.get(idStr) ?? 0;
                    return !usadosFecha && usosTotales < 2;
                });

                if (!candidatos.length) return null;
                const idx = candidatos.length === 1 ? 0 : Math.floor(Math.random() * candidatos.length);
                const elegido = candidatos[idx];
                return {
                    id: Number(elegido.id_casoEstudio),
                    nombre: elegido.Nombre_Archivo || null,
                };
            };

            const tipo = await tx.tipo_Defensa.findFirst({ where: { Nombre: tipoDefensa } });
            if (!tipo) throw new HttpException("Tipo de defensa no encontrado", 400);

            for (const idEstudianteRaw of estudiantesIds) {
                const idEstudiante = Number(idEstudianteRaw);

                const estudiante = await tx.estudiante.findUnique({
                    where: { id_estudiante: idEstudiante },
                    include: { estudiante_Carrera: { include: { carrera: true } } }
                });
                if (!estudiante) throw new HttpException("Estudiante no encontrado", 400);
                if (!estudiante.estudiante_Carrera?.length) throw new Error("Estudiante sin carrera");

                const idCarrera = estudiante.estudiante_Carrera[0].Id_Carrera;

                // Áreas relacionadas DISPONIBLES
                const areasRelacionadas = await tx.carrera_Area.findMany({
                    where: { Id_Carrera: idCarrera, area: { estado: true } },
                    include: { area: true }
                });
                if (!areasRelacionadas.length) {
                    throw new HttpException("No hay áreas disponibles (estado true) asociadas a la carrera", 400);
                }
                const allAreaIdsAvail = areasRelacionadas.map(a => Number(a.Id_Area));

                // ¿Tiene defensa PENDIENTE (misma tipología) con algo por asignar?
                const pendiente = await tx.defensa.findFirst({
                    where: {
                        id_estudiante: idEstudiante,
                        id_tipo_defensa: tipo.id_TipoDefensa,
                        estado: 'PENDIENTE',
                        OR: [{ id_area: null }, { id_casoEstudio: null }],
                    },
                    select: {
                        id_defensa: true,
                        id_area: true,
                        id_casoEstudio: true,
                    }
                });

                // Variables comunes de salida
                let areaFinal: number | null = null;
                let areaNombre: string | null = null;
                let casoFinal: number | null = null;
                let casoNombre: string | null = null;

                // ------------------ RELLENAR DEFENSA PENDIENTE ------------------
                if (pendiente) {
                    // Caso 1: faltan área y caso
                    if (!pendiente.id_area && !pendiente.id_casoEstudio) {
                        // Elegir área candidata
                        let candidatas = [...allAreaIdsAvail];
                        // Si el caller envía un área preferida válida, la probamos primero
                        const preferida = body.id_area ? Number(body.id_area) : null;
                        if (preferida && allAreaIdsAvail.includes(preferida)) {
                            candidatas = [preferida, ...shuffle(allAreaIdsAvail.filter(a => a !== preferida))];
                        } else {
                            candidatas = shuffle(candidatas);
                        }

                        // Recorremos áreas hasta hallar un caso válido
                        let asignado = false;
                        for (const idArea of candidatas) {
                            const pick = await pickCasoEnArea(idArea);
                            if (pick) {
                                areaFinal = idArea;
                                // nombre área
                                const ao = areasRelacionadas.find(a => Number(a.Id_Area) === idArea);
                                areaNombre = ao?.area?.nombre_area || null;

                                casoFinal = pick.id;
                                casoNombre = pick.nombre;

                                // Marcar uso para esta fecha y en total
                                const casoStr = String(casoFinal);
                                casosYaAsignadosEnFecha.add(casoStr);
                                totalUsosCaso.set(casoStr, (totalUsosCaso.get(casoStr) ?? 0) + 1);

                                // Actualizar defensa existente
                                const updated = await tx.defensa.update({
                                    where: { id_defensa: pendiente.id_defensa },
                                    data: {
                                        fecha_defensa: fechaDefensa,
                                        id_area: areaFinal,
                                        id_casoEstudio: casoFinal,
                                        estado: 'ASIGNADO',
                                        updated_at: new Date(),
                                    }
                                });

                                defensasCreadas.push({
                                    id_defensa: updated.id_defensa,
                                    estudiante: idEstudiante,
                                    area: areaNombre,
                                    caso: casoNombre,
                                    fecha: updated.fecha_defensa,
                                    estado: updated.estado,
                                    tipo_defensa: tipoDefensa
                                });

                                asignado = true;
                                break;
                            }
                        }

                        if (!asignado) {
                            throw new HttpException(
                                `No hay casos disponibles (estado true, sin repetir fecha y con tope < 2 usos) para el estudiante ${idEstudiante}.`,
                                400
                            );
                        }

                        // Pasamos al siguiente estudiante (ya actualizamos)
                        continue;
                    }

                    // Caso 2: ya tiene área, falta caso → sortear solo caso en esa área
                    if (pendiente.id_area && !pendiente.id_casoEstudio) {
                        const idArea = Number(pendiente.id_area);
                        // Verificamos que el área siga disponible para la carrera
                        if (!allAreaIdsAvail.includes(idArea)) {
                            throw new HttpException(
                                `El área ya asignada en la defensa pendiente no está disponible para la carrera (o estado=false).`,
                                400
                            );
                        }

                        const pick = await pickCasoEnArea(idArea);
                        if (!pick) {
                            throw new HttpException(
                                `No hay casos disponibles en el área indicada (estado true, sin repetir fecha y con tope < 2 usos).`,
                                400
                            );
                        }

                        areaFinal = idArea;
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === idArea);
                        areaNombre = ao?.area?.nombre_area || null;

                        casoFinal = pick.id;
                        casoNombre = pick.nombre;

                        const casoStr = String(casoFinal);
                        casosYaAsignadosEnFecha.add(casoStr);
                        totalUsosCaso.set(casoStr, (totalUsosCaso.get(casoStr) ?? 0) + 1);

                        const updated = await tx.defensa.update({
                            where: { id_defensa: pendiente.id_defensa },
                            data: {
                                fecha_defensa: fechaDefensa,
                                id_casoEstudio: casoFinal,
                                estado: 'ASIGNADO',
                                updated_at: new Date(),
                            }
                        });

                        defensasCreadas.push({
                            id_defensa: updated.id_defensa,
                            estudiante: idEstudiante,
                            area: areaNombre,
                            caso: casoNombre,
                            fecha: updated.fecha_defensa,
                            estado: updated.estado,
                            tipo_defensa: tipoDefensa
                        });

                        continue;
                    }

                    // Caso raro: tiene caso pero no área → usar área del caso si es válida
                    if (!pendiente.id_area && pendiente.id_casoEstudio) {
                        const caso = await tx.casos_de_estudio.findUnique({
                            where: { id_casoEstudio: Number(pendiente.id_casoEstudio) },
                            select: { id_area: true, estado: true, Nombre_Archivo: true }
                        });
                        if (!caso || !caso.estado || !caso.id_area || !allAreaIdsAvail.includes(Number(caso.id_area))) {
                            throw new HttpException(
                                `La defensa pendiente tiene caso asignado pero el área del caso no es válida/disponible.`,
                                400
                            );
                        }
                        const casoStr = String(pendiente.id_casoEstudio);
                        // Validar restricciones del caso
                        const usosTotales = totalUsosCaso.get(casoStr) ?? 0;
                        if (usosTotales >= 2) {
                            throw new HttpException(`El caso ya alcanzó el máximo de 2 usos.`, 400);
                        }
                        if (casosYaAsignadosEnFecha.has(casoStr)) {
                            throw new HttpException(`El caso ya está asignado a otro estudiante en esa fecha.`, 400);
                        }

                        areaFinal = Number(caso.id_area);
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaFinal);
                        areaNombre = ao?.area?.nombre_area || null;

                        casoFinal = Number(pendiente.id_casoEstudio);
                        casoNombre = caso.Nombre_Archivo || null;

                        casosYaAsignadosEnFecha.add(casoStr);
                        totalUsosCaso.set(casoStr, usosTotales + 1);

                        const updated = await tx.defensa.update({
                            where: { id_defensa: pendiente.id_defensa },
                            data: {
                                fecha_defensa: fechaDefensa,
                                id_area: areaFinal,
                                estado: 'ASIGNADO',
                                updated_at: new Date(),
                            }
                        });

                        defensasCreadas.push({
                            id_defensa: updated.id_defensa,
                            estudiante: idEstudiante,
                            area: areaNombre,
                            caso: casoNombre,
                            fecha: updated.fecha_defensa,
                            estado: updated.estado,
                            tipo_defensa: tipoDefensa
                        });

                        continue;
                    }
                }


                let areaSorteada: number | null = null;
                let areaNombreSel: string | null = null;

                if (sorteaCaso) {
                    if (sorteaArea) {
                        const idx = allAreaIdsAvail.length === 1 ? 0 : Math.floor(Math.random() * allAreaIdsAvail.length);
                        areaSorteada = allAreaIdsAvail[idx];
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                        areaNombreSel = ao?.area?.nombre_area || null;
                    } else {
                        const preferida = body.id_area ? Number(body.id_area) : null;
                        if (preferida && allAreaIdsAvail.includes(preferida)) {
                            areaSorteada = preferida;
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                            areaNombreSel = ao?.area?.nombre_area || null;
                        } else {
                            areaSorteada = null;
                            areaNombreSel = null;
                        }
                    }
                } else {
                    // Caso manual: validar área si viene
                    if (!sorteaArea) {
                        const manualArea = body.id_area ? Number(body.id_area) : null;
                        if (manualArea && allAreaIdsAvail.includes(manualArea)) {
                            areaSorteada = manualArea;
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === manualArea);
                            areaNombreSel = ao?.area?.nombre_area || null;
                        } else if (manualArea) {
                            throw new HttpException("El área indicada no está disponible (estado false) o no pertenece a la carrera.", 400);
                        }
                    } else {
                        const idx = allAreaIdsAvail.length === 1 ? 0 : Math.floor(Math.random() * allAreaIdsAvail.length);
                        areaSorteada = allAreaIdsAvail[idx];
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                        areaNombreSel = ao?.area?.nombre_area || null;
                    }
                }

                // Selección de caso
                let casoSorteado: number | null = null;
                let casoNombreSel: string | null = null;

                if (sorteaCaso) {
                    let candidatas: number[];
                    if (areaSorteada) {
                        const resto = allAreaIdsAvail.filter(id => id !== Number(areaSorteada));
                        candidatas = [Number(areaSorteada), ...shuffle(resto)];
                    } else {
                        candidatas = shuffle(allAreaIdsAvail);
                    }

                    let seleccionado = false;
                    for (const idArea of candidatas) {
                        const pick = await pickCasoEnArea(idArea);
                        if (pick) {
                            casoSorteado = pick.id;
                            casoNombreSel = pick.nombre;
                            areaSorteada = idArea;

                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === idArea);
                            areaNombreSel = ao?.area?.nombre_area || null;

                            const casoStr = String(casoSorteado);
                            casosYaAsignadosEnFecha.add(casoStr);
                            totalUsosCaso.set(casoStr, (totalUsosCaso.get(casoStr) ?? 0) + 1);

                            seleccionado = true;
                            break;
                        }
                    }

                    if (!seleccionado) {
                        throw new HttpException(
                            `No hay casos disponibles (estado true, sin repetir fecha y con tope < 2 usos).`,
                            400
                        );
                    }
                } else {
                    // Caso manual: validar restricciones
                    const casoManual = body.id_casoEstudio ? Number(body.id_casoEstudio) : null;
                    if (casoManual) {
                        const caso = await tx.casos_de_estudio.findUnique({
                            where: { id_casoEstudio: casoManual }
                        });
                        if (!caso || !caso.estado) {
                            throw new HttpException("El caso indicado no está disponible (estado false) o no existe.", 400);
                        }
                        const casoStr = String(casoManual);
                        const usosTotales = totalUsosCaso.get(casoStr) ?? 0;
                        if (usosTotales >= 2) {
                            throw new HttpException("El caso indicado ya alcanzó el máximo de 2 usos.", 400);
                        }
                        if (casosYaAsignadosEnFecha.has(casoStr)) {
                            throw new HttpException("El caso indicado ya fue asignado en esa fecha.", 400);
                        }
                        // Si no se indicó área, usar la del caso (y validar que esté disponible)
                        if (!areaSorteada) {
                            if (!caso.id_area || !allAreaIdsAvail.includes(Number(caso.id_area))) {
                                throw new HttpException("El área del caso no está disponible para la carrera.", 400);
                            }
                            areaSorteada = Number(caso.id_area);
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                            areaNombreSel = ao?.area?.nombre_area || null;
                        }
                        casoSorteado = casoManual;
                        casoNombreSel = caso.Nombre_Archivo || null;

                        // Marcar restricciones
                        casosYaAsignadosEnFecha.add(casoStr);
                        totalUsosCaso.set(casoStr, usosTotales + 1);
                    }
                }

                // Validación: no crear duplicado exacto (mismo estudiante, tipo, fecha)
                const defensaExistente = await tx.defensa.findFirst({
                    where: {
                        id_estudiante: idEstudiante,
                        id_tipo_defensa: tipo.id_TipoDefensa,
                        fecha_defensa: fechaDefensa
                    }
                });
                if (defensaExistente) {
                    throw new HttpException(`Ya existe una defensa para este estudiante en esa fecha y tipo.`, 400);
                }

                let estadoDefensa = "ASIGNADO";
                if (!areaSorteada || !casoSorteado) estadoDefensa = "PENDIENTE";

                const defensa = await tx.defensa.create({
                    data: {
                        fecha_defensa: fechaDefensa,
                        id_estudiante: idEstudiante,
                        id_tipo_defensa: tipo.id_TipoDefensa,
                        id_casoEstudio: casoSorteado,
                        id_area: areaSorteada,
                        estado: estadoDefensa,
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });

                defensasCreadas.push({
                    id_defensa: defensa.id_defensa,
                    estudiante: idEstudiante,
                    area: areaNombreSel,
                    caso: casoNombreSel,
                    fecha: defensa.fecha_defensa,
                    estado: defensa.estado,
                    tipo_defensa: tipoDefensa
                });
            }

            return defensasCreadas;
        }).then(async (defensasCreadas) => {
            // Notificaciones fuera de la transacción
            for (const defensa of defensasCreadas) {
                this.enviarNotificacionDefensa(Number(defensa.estudiante), {
                    area: defensa.area,
                    caso: defensa.caso,
                    fecha: defensa.fecha,
                    tipo_defensa: defensa.tipo_defensa,
                    estado: defensa.estado
                }).catch(err => console.error(`Error WhatsApp estudiante ${defensa.estudiante}:`, err));

                this.enviarNotificacionEmailDefensa(Number(defensa.estudiante), {
                    area: defensa.area,
                    caso: defensa.caso,
                    fecha: defensa.fecha,
                    tipo_defensa: defensa.tipo_defensa,
                    estado: defensa.estado
                }).catch(err => console.error(`Error Email estudiante ${defensa.estudiante}:`, err));
            }
            return defensasCreadas;
        });
    }



    async getAllDefensasDetalle({ page, pageSize, tipoDefensaNombre, user }: { page: number, pageSize: number, tipoDefensaNombre?: string, user: any }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: {
                    usuario_Carrera: true
                }
            });
            if (!usuario) throw new Error("Usuario no encontrado");

            const carrerasIds = usuario.usuario_Carrera
                .map(rc => rc.Id_carrera)
                .filter((id): id is bigint => id !== null && id !== undefined);

            if (carrerasIds.length === 0) {
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

            if (estudianteIds.length === 0) {
                return {
                    items: [],
                    total: 0,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: 0
                };
            }

            // 3. Filtro por tipo si llega
            let tipoDefensaId: number | undefined = undefined;
            if (tipoDefensaNombre) {
                const tipo = await this.prisma.tipo_Defensa.findFirst({
                    where: { Nombre: tipoDefensaNombre }
                });
                if (!tipo) throw new Error("Tipo de defensa no encontrado");
                tipoDefensaId = Number(tipo.id_TipoDefensa);
            }

            // 4. Contar total (solo defensas de estudiantes de esas carreras)
            const total = await this.prisma.defensa.count({
                where: {
                    id_estudiante: { in: estudianteIds },
                    ...(typeof tipoDefensaId !== "undefined" ? { id_tipo_defensa: tipoDefensaId } : {})
                }
            });

            // 5. Traer defensas con filtro
            const defensas = await this.prisma.defensa.findMany({
                skip,
                take,
                where: {
                    id_estudiante: { in: estudianteIds },
                    ...(typeof tipoDefensaId !== "undefined" ? { id_tipo_defensa: tipoDefensaId } : {})
                },
                include: {
                    estudiante: { include: { Persona: true } },
                    Tipo_Defensa: true,
                    tribunal_defensa: {
                        include: { tribunal_Docente: { include: { Persona: true } } }
                    },
                    area: true,
                    casos_de_estudio: true,
                },
                orderBy: { id_defensa: "desc"}
            });

            // 6. Formatear resultados (igual que tu código original)
            const items = defensas.map((defensa) => {
                // Estudiante
                const persona = defensa.estudiante?.Persona;
                const estudianteNombre = persona
                    ? `${persona.Nombre} ${persona.Apellido1} ${persona.Apellido2 || ""}`.trim()
                    : null;

                // Jurados
                const jurados = (defensa.tribunal_defensa || [])
                    .filter(td => !!td.tribunal_Docente?.Persona)
                    .map(td => {
                        if (!td.tribunal_Docente || !td.tribunal_Docente.Persona) {
                            return null;
                        }
                        const p = td.tribunal_Docente.Persona;
                        return {
                            id_tribunal: td.tribunal_Docente.id_tribunal,
                            nombre: `${p.Nombre} ${p.Apellido1} ${p.Apellido2 || ""}`.trim(),
                        };
                    }).filter(j => j !== null);

                // Fecha y hora AM/PM
                let fechaDefensa: string | null = null;
                let horaDefensa: string | null = null;
                if (defensa.fecha_defensa) {
                    const original = new Date(defensa.fecha_defensa);
                    fechaDefensa = original.toLocaleDateString("es-BO", {
                        timeZone: 'UTC'
                    });

                    horaDefensa = original.toLocaleTimeString("es-BO", {
                        timeZone: 'UTC',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }).replace(/\./g, "").toUpperCase();
                }

                return {
                    ...defensa,
                    estudiante: estudianteNombre,
                    nombre_tipo_defensa: defensa.Tipo_Defensa?.Nombre,
                    area: defensa.area?.nombre_area || null,
                    caso: defensa.casos_de_estudio?.Nombre_Archivo || null,
                    tiene_jurado: jurados.length > 0,
                    jurados,
                    fecha: fechaDefensa,
                    hora: horaDefensa,
                };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching defensas: ${error.message}`);
        }
    }
    async getDefensasFiltradas({ page, pageSize, user, tipoDefensaNombre, word }: { page: number, pageSize: number, user: bigint, tipoDefensaNombre?: string, word?: string }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            // 1. Obtener las carreras que administra el usuario para delimitar la búsqueda
            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: { usuario_Carrera: true }
            });
            if (!usuario) throw new Error("Usuario no encontrado");

            const carrerasIds = usuario.usuario_Carrera
                .map(rc => rc.Id_carrera)
                .filter((id): id is bigint => id !== null && id !== undefined);

            if (carrerasIds.length === 0) {
                return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
            }

            // A partir de las carreras, obtener los IDs de los estudiantes correspondientes
            const estudiantesCarrera = await this.prisma.estudiante_Carrera.findMany({
                where: { Id_Carrera: { in: carrerasIds } },
                select: { Id_Estudiante: true }
            });
            const estudianteIds = [...new Set(estudiantesCarrera.map(ec => ec.Id_Estudiante).filter((id): id is bigint => !!id))];

            if (estudianteIds.length === 0) {
                return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
            }

            // 2. Construir la cláusula 'where' de forma dinámica
            const whereClause: any = { AND: [] };

            // Condición base: La defensa debe pertenecer a uno de los estudiantes autorizados
            whereClause.AND.push({ id_estudiante: { in: estudianteIds } });

            // Condición opcional: Filtrar por tipo de defensa si se proporciona
            if (tipoDefensaNombre) {
                const tipo = await this.prisma.tipo_Defensa.findFirst({
                    where: { Nombre: { equals: tipoDefensaNombre, mode: 'insensitive' } }
                });
                if (tipo) {
                    whereClause.AND.push({ id_tipo_defensa: tipo.id_TipoDefensa });
                } else {
                    // Si se especifica un tipo y no se encuentra, no habrá resultados
                    return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
                }
            }

            // Condición opcional: Filtrar por palabra clave si se proporciona
            if (word && word.trim() !== '') {
                whereClause.AND.push({
                    OR: [
                        // Buscar en datos del estudiante
                        { estudiante: { Persona: { Nombre: { contains: word, mode: 'insensitive' } } } },
                        { estudiante: { Persona: { Apellido1: { contains: word, mode: 'insensitive' } } } },
                        { estudiante: { Persona: { Apellido2: { contains: word, mode: 'insensitive' } } } },
                        { estudiante: { Persona: { CI: { contains: word, mode: 'insensitive' } } } },
                        // Buscar en datos de la defensa
                        { estado: { contains: word, mode: 'insensitive' } },
                        { aula: { contains: word, mode: 'insensitive' } },
                        // Buscar en datos de relaciones
                        { area: { nombre_area: { contains: word, mode: 'insensitive' } } },
                        { casos_de_estudio: { Nombre_Archivo: { contains: word, mode: 'insensitive' } } },
                        // Buscar por nombre de jurado (tribunal)
                        {
                            tribunal_defensa: {
                                some: {
                                    tribunal_Docente: {
                                        Persona: {
                                            OR: [
                                                { Nombre: { contains: word, mode: 'insensitive' } },
                                                { Apellido1: { contains: word, mode: 'insensitive' } },
                                                { Apellido2: { contains: word, mode: 'insensitive' } },
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ]
                });
            }

            // 3. Realizar consultas de conteo y obtención de datos con la misma cláusula
            const total = await this.prisma.defensa.count({ where: whereClause });

            const defensas = await this.prisma.defensa.findMany({
                skip,
                take,
                where: whereClause,
                include: {
                    estudiante: { include: { Persona: true } },
                    Tipo_Defensa: true,
                    tribunal_defensa: {
                        include: { tribunal_Docente: { include: { Persona: true } } }
                    },
                    area: true,
                    casos_de_estudio: true,
                },
                orderBy: { id_defensa: "desc"  }
            });

            // 4. Formatear los resultados para la respuesta final
            const items = defensas.map((defensa) => {
                const persona = defensa.estudiante?.Persona;
                const estudianteNombre = persona ? `${persona.Nombre} ${persona.Apellido1} ${persona.Apellido2 || ""}`.trim() : null;

                const jurados = (defensa.tribunal_defensa || [])
                    .map(td => {
                        const p = td.tribunal_Docente?.Persona;
                        // **CORRECCIÓN AQUÍ**
                        // Se comprueba que tanto el tribunal_Docente como su Persona existan antes de usarlos.
                        if (!td.tribunal_Docente || !p) {
                            return null;
                        }
                        return {
                            id_tribunal: td.tribunal_Docente.id_tribunal,
                            nombre: `${p.Nombre} ${p.Apellido1} ${p.Apellido2 || ""}`.trim(),
                        };
                    }).filter((j): j is { id_tribunal: bigint; nombre: string; } => j !== null);

                let fechaDefensa: string | null = null;
                let horaDefensa: string | null = null;
                if (defensa.fecha_defensa) {
                    const original = new Date(defensa.fecha_defensa);
                    fechaDefensa = original.toLocaleDateString("es-BO", {
                        timeZone: 'UTC'
                    });

                    horaDefensa = original.toLocaleTimeString("es-BO", {
                        timeZone: 'UTC',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    }).replace(/\./g, "").toUpperCase(); // Formato HH:MM AM/PM
                }

                return {
                    ...defensa, // Devolvemos todos los campos de la defensa por si se necesitan
                    estudiante: estudianteNombre,
                    nombre_tipo_defensa: defensa.Tipo_Defensa?.Nombre || null,
                    area: defensa.area?.nombre_area || null,
                    caso: defensa.casos_de_estudio?.Nombre_Archivo || null,
                    tiene_jurado: jurados.length > 0,
                    jurados,
                    fecha: fechaDefensa,
                    hora: horaDefensa,
                };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            console.error("Error en getDefensasFiltradas:", error);
            throw new Error(`Error al obtener las defensas: ${error.message}`);
        }
    }


    async agregarNotaDefensa(id_defensa: number, nota: number) {

        const defensa = await this.prisma.defensa.findUnique({
            where: { id_defensa: BigInt(id_defensa) }
        });
        if (!defensa) throw new HttpException("Defensa no encontrada", 400);

        let estado = "REPROBADO";
        if (Number(nota) >= 51) estado = "APROBADO";
        const defensaActualizada = await this.prisma.defensa.update({
            where: { id_defensa: BigInt(id_defensa) },
            data: {
                nota: Number(nota),
                estado,
                updated_at: new Date()
            }
        });

        // Enviar notificación de calificación por WhatsApp (sin bloquear)
        this.enviarNotificacionCalificacion(defensa, Number(nota), estado).catch(error => {
            console.error(`Error al enviar notificación de calificación WhatsApp:`, error);
        });

        // Enviar notificación de calificación por Email (sin bloquear)
        this.enviarNotificacionEmailCalificacion(defensa, Number(nota), estado).catch(error => {
            console.error(`Error al enviar notificación de calificación Email:`, error);
        });

        return defensaActualizada;
    }
    async agregarAulaDefensa(id_defensa: number, aula: string) {
        const defensa = await this.prisma.defensa.findUnique({
            where: { id_defensa: BigInt(id_defensa) }
        });
        if (!defensa) throw new Error("Defensa no encontrada");

        const defensaActualizada = await this.prisma.defensa.update({
            where: { id_defensa: BigInt(id_defensa) },
            data: {
                aula,
                updated_at: new Date()
            }
        });

        return defensaActualizada;
    }

    public async enviarNotificacionDefensa(idEstudiante: number, defensaInfo: any) {
        try {
            // 1) Datos del estudiante
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: idEstudiante },
                include: { Persona: true }
            });

            if (!estudiante?.Persona?.telefono) {
                console.log(`No se pudo enviar notificación: estudiante sin teléfono (ID: ${idEstudiante})`);
                return;
            }

            // 2) URL del caso (si existiera)
            const linkcaso = await this.prisma.defensa.findFirst({
                where: { id_estudiante: idEstudiante },
                orderBy: { id_defensa: 'desc' },
                select: { casos_de_estudio: { select: { url: true } } }
            });

            const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
            const telefono = String(estudiante.Persona.telefono);

            const fechaUtc = new Date(defensaInfo.fecha);

            const fechaFormateada = fechaUtc.toLocaleString('es-BO', {
                timeZone: 'UTC',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let mensaje = `Estimado/a ${nombreCompleto}:\n\n`;

            if (defensaInfo.estado === 'ASIGNADO') {
                mensaje += `Le informamos que su defensa ha sido programada.\n\n`;
                mensaje += `— Fecha y hora: ${fechaFormateada}\n`;
                mensaje += `— Tipo de defensa: ${defensaInfo.tipo_defensa}\n`;
                if (defensaInfo.area) mensaje += `— Área asignada: ${defensaInfo.area}\n`;
                if (defensaInfo.caso) mensaje += `— Caso de estudio: ${defensaInfo.caso}\n`;
                if (linkcaso) {
                    mensaje += `— Enlace al caso: ${linkcaso.casos_de_estudio?.url || 'No disponible'}\n`;
                }
                mensaje += `\nPor favor, verifique la información y procure presentarse con antelación.`;
            } else if (defensaInfo.estado === 'PENDIENTE') {
                mensaje += `Se ha registrado su defensa.\n\n`;
                mensaje += `— Fecha y hora: ${fechaFormateada}\n`;
                mensaje += `— Tipo de defensa: ${defensaInfo.tipo_defensa}\n`;
                mensaje += `\nNota: algunos detalles se encuentran en proceso de asignación. Le notificaremos cuando estén confirmados.`;
            } else {
                // Estado desconocido (fallback formal)
                mensaje += `Se registró un movimiento relacionado con su defensa.\n\n`;
                mensaje += `— Fecha y hora: ${fechaFormateada}\n`;
                mensaje += `— Tipo de defensa: ${defensaInfo.tipo_defensa}\n`;
            }

            mensaje += `\n\nAtentamente,\nCoordinación Académica`;

            // 5) Envío con timeout
            const envioExitoso = await Promise.race([
                this.notificacionService.sendMessage(telefono, mensaje),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 30000)
                ),
            ]);

            if (envioExitoso) {
                console.log(`Notificación enviada exitosamente a ${nombreCompleto} (${telefono})`);
            } else {
                console.log(`No se pudo enviar la notificación a ${nombreCompleto} (${telefono})`);
            }
        } catch (error) {
            console.error(`❌ Error al enviar notificación al estudiante ${idEstudiante}:`, error?.message || error);
            // Opcional: registrar para reintento posterior
            // await this.registrarNotificacionFallida(idEstudiante, defensaInfo);
        }
    }



    public async enviarNotificacionEmailDefensa(idEstudiante: number, defensaInfo: any) {
        try {
            // 1) Datos del estudiante
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: idEstudiante },
                include: { Persona: true }
            });

            if (!estudiante?.Persona?.Correo) {
                console.log(`No se pudo enviar email: estudiante sin email (ID: ${idEstudiante})`);
                return;
            }

            const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
            const nombreUpper = nombreCompleto.toUpperCase();
            const email = String(estudiante.Persona.Correo);

            // 2) URL del caso (si existiera)
            const linkcaso = await this.prisma.defensa.findFirst({
                where: { id_estudiante: idEstudiante },
                orderBy: { id_defensa: 'desc' },
                select: { casos_de_estudio: { select: { url: true } } }
            });
            const linkCasoUrl = linkcaso?.casos_de_estudio?.url || '';

            // 3) Fecha/hora en zona de Bolivia (mostrar UTC exacto como fue guardado)
            const fechaUtc = new Date(defensaInfo.fecha);
            const fechaFormateada = fechaUtc.toLocaleString('es-BO', {
                timeZone: 'UTC',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 4) Asunto + título por estado (sin cambiar la lógica)
            let asunto = '';
            let title = '';

            if (defensaInfo.estado === 'ASIGNADO') {
                asunto = `Programación de defensa – ${defensaInfo.tipo_defensa}`;
                title = 'Programación de defensa';
            } else if (defensaInfo.estado === 'PENDIENTE') {
                asunto = 'Defensa registrada – pendiente de asignación';
                title = 'Defensa registrada';
            } else {
                asunto = 'Actualización sobre su defensa';
                title = 'Actualización de registro';
            }

            // 5) Constructor de plantilla Tabular (sin alterar diseño)
            const buildTabularHtml = ({
                title,
                nombreUpper,
                fechaFormateada,
                tipoDefensa,
                area,
                caso,
                linkCasoUrl
            }: {
                title: string;
                nombreUpper: string;
                fechaFormateada: string;
                tipoDefensa: string;
                area?: string;
                caso?: string;
                linkCasoUrl?: string;
            }) => {
                const areaRow = area ? `
<tr><td align="center">
  <table class="t51" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
    <tr><td width="448" class="t50" style="width:694px;">
      <table class="t49" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
        <tr><td class="t48">
          <p class="t46" style="margin:0;Margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
            <span class="t43" style="font-weight:bold;">Área asignada:</span>
            <span class="t45"><span class="t44" style="font-weight:400;"> ${area}</span></span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
<tr><td><div class="t56" style="line-height:4px;font-size:1px;display:block;">&nbsp;&nbsp;</div></td></tr>
` : '';

                const casoRow = caso ? `
<tr><td align="center">
  <table class="t60" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
    <tr><td width="448" class="t59" style="width:694px;">
      <table class="t58" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
        <tr><td class="t57">
          <p class="t55" style="margin:0;Margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
            <span class="t52" style="font-weight:bold;">Caso de estudio: </span>
            <span class="t54"><span class="t53" style="font-weight:400;">${caso}</span></span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
` : '';

                const botonRow = linkCasoUrl ? `
<tr><td align="center">
  <table class="t73" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
    <tr><td width="510" class="t72" style="width:800px;">
      <table class="t71" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
        <tr><td class="t70" style="border:1px solid #E3E3E3;overflow:hidden;padding:10px;border-radius:0 0 6px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
            <tr><td align="center">
              <table class="t69" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                <tr><td width="488" class="t68" style="width:600px;">
                  <table class="t67" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                    <tr>
                      <td class="t66" style="overflow:hidden;background-color:#FF595F;text-align:center;line-height:24px;padding:18px 14px;border-radius:4px;">
                        <a href="${linkCasoUrl}" target="_blank" style="display:block;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;font-weight:700;font-size:16px;color:#FFFFFF;text-align:center;text-decoration:none;">
                          DESCARGAR CASO DE ESTUDIO
                        </a>
                      </td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</td></tr>
` : '';

                // ——— Plantilla completa (Tabular) con inserciones dinámicas ———
                return `<!--
* This email was built using Tabular.
* For more information, visit https://tabular.email
-->
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="es">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="x-apple-disable-message-reformatting" />
<meta content="target-densitydpi=device-dpi" name="viewport" />
<meta content="true" name="HandheldFriendly" />
<meta content="width=device-width" name="viewport" />
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no" />
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&amp;family=Roboto:wght@400;700&amp;display=swap" rel="stylesheet" type="text/css" />
<title></title>
<style type="text/css">
/* (Se conserva el CSS original de Tabular tal cual, sin cambios de diseño) */
table{border-collapse:separate;table-layout:fixed;mso-table-lspace:0pt;mso-table-rspace:0pt}table td{border-collapse:collapse}.ExternalClass{width:100%}.ExternalClass,.ExternalClass p,.ExternalClass span,.ExternalClass font,.ExternalClass td,.ExternalClass div{line-height:100%}body,a,li,p,h1,h2,h3{-ms-text-size-adjust:100%;-webkit-text-size-adjust:100%}html{-webkit-text-size-adjust:none!important}body{min-width:100%;Margin:0px;padding:0px}body,#innerTable{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}#innerTable img+div{display:none;display:none!important}img{Margin:0;padding:0;-ms-interpolation-mode:bicubic}h1,h2,h3,p,a{line-height:inherit;overflow-wrap:normal;white-space:normal;word-break:break-word}a{text-decoration:none}h1,h2,h3,p{min-width:100%!important;width:100%!important;max-width:100%!important;display:inline-block!important;border:0;padding:0;margin:0}a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important}u + #body a{color:inherit;text-decoration:none;font-size:inherit;font-family:inherit;font-weight:inherit;line-height:inherit}a[href^="mailto"],a[href^="tel"],a[href^="sms"]{color:inherit;text-decoration:none}
@media (min-width:481px){.hd{display:none!important}}
@media (max-width:480px){.hm{display:none!important}}
@media (max-width:480px){.t101,.t84,.t98{text-align:center!important}.t82,.t98,.t99{display:block!important}.t118{padding-left:30px!important;padding-right:30px!important}.t82{mso-line-height-alt:14px!important;line-height:14px!important}.t80{display:revert!important}.t83,.t97{vertical-align:middle!important;display:inline-block!important;width:100%!important}.t83{max-width:98px!important}.t97{max-width:800px!important}}
</style>
</head>
<body id="body" class="t124" style="min-width:100%;Margin:0px;padding:0px;background-color:#FAFAFA;">
<div class="t123" style="background-color:#FAFAFA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center">
    <tr>
      <td class="t122" style="font-size:0;line-height:0;mso-line-height-rule:exactly;background-color:#FAFAFA;" valign="top" align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" align="center" id="innerTable">
          <tr><td align="center">
            <table class="t121" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
              <tr><td width="630" class="t120" style="width:630px;">
                <table class="t119" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                  <tr><td class="t118" style="background-color:#FFFFFF;padding:40px 60px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
                      <tr><td align="left">
                        <!-- Logo/cuadro -->
                        <table class="t4" role="presentation" cellpadding="0" cellspacing="0" style="Margin-right:auto;">
                          <tr><td width="40" class="t3" style="width:40px;">
                            <table class="t2" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t1">
                                <div style="font-size:0px;">
                                  <img class="t0" style="display:block;border:0;height:auto;width:100%;Margin:0;max-width:100%;" width="40" height="40" alt="" src="https://02f839bd-3369-4e6e-9247-1b8f6c6c8eb6.b-cdn.net/e/08283a31-7b1f-41ce-aa80-e84b0d4c4451/66ab8273-8d91-49b8-9923-8e143d2b0301.png"/>
                                </div>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <tr><td><div class="t5" style="line-height:40px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                      <tr><td align="center">
                        <table class="t10" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td width="510" class="t9" style="width:744px;">
                            <table class="t8" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t7">
                                <h1 class="t6" style="margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:34px;font-weight:700;font-size:29px;color:#333333;text-align:center;">
                                  Universidad Tecnologica Privada de Santa Cruz
                                </h1>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <tr><td><div class="t11" style="line-height:11px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                      <tr><td align="center">
                        <table class="t16" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td class="t15">
                            <table class="t14" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t13">
                                <p class="t12" style="margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:16px;color:#333333;text-align:left;">
                                  ${title}
                                </p>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <tr><td><div class="t17" style="line-height:4px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                      <!-- Bloque nombre -->
                      <tr><td align="center">
                        <table class="t77" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td width="510" class="t76" style="width:800px;">
                            <table class="t75" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t74" style="padding:30px 0 10px 0;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
                                  <tr><td align="center">
                                    <table class="t27" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                      <tr><td width="510" class="t26" style="width:800px;">
                                        <table class="t25" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                          <tr><td class="t24" style="border:1px solid #E3E3E3;overflow:hidden;padding:30px;border-radius:6px 6px 0 0;">
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
                                              <tr><td align="center">
                                                <table class="t23" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                                  <tr><td width="448" class="t22" style="width:600px;">
                                                    <table class="t21" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                                      <tr><td class="t20">
                                                        <p class="t19" style="margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
                                                          <span class="t18" style="font-weight:bold;">${nombreUpper}</span>
                                                        </p>
                                                      </td></tr>
                                                    </table>
                                                  </td></tr>
                                                </table>
                                              </td></tr>
                                            </table>
                                          </td></tr>
                                        </table>
                                      </td></tr>
                                    </table>
                                  </td></tr>
                                </table>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <!-- Detalles -->
                      <tr><td align="center">
                        <table class="t64" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td width="510" class="t63" style="width:800px;">
                            <table class="t62" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t61" style="border:1px solid #E3E3E3;padding:30px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
                                  <tr><td align="center">
                                    <table class="t34" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                      <tr><td width="448" class="t33" style="width:600px;">
                                        <table class="t32" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                          <tr><td class="t31">
                                            <p class="t30" style="margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
                                              <span class="t28" style="font-weight:bold;">Fecha y hora: </span>
                                              <span class="t29" style="font-weight:400;">${fechaFormateada}</span>
                                            </p>
                                          </td></tr>
                                        </table>
                                      </td></tr>
                                    </table>
                                  </td></tr>

                                  <tr><td><div class="t38" style="line-height:4px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                                  <tr><td align="center">
                                    <table class="t42" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                      <tr><td width="448" class="t41" style="width:600px;">
                                        <table class="t40" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                          <tr><td class="t39">
                                            <p class="t37" style="margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
                                              <span class="t35" style="font-weight:bold;">Tipo de defensa:&nbsp;</span>
                                              <span class="t36" style="font-weight:400;">${tipoDefensa}</span>
                                            </p>
                                          </td></tr>
                                        </table>
                                      </td></tr>
                                    </table>
                                  </td></tr>

                                  <tr><td><div class="t47" style="line-height:4px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                                  ${areaRow}
                                  ${casoRow}
                                </table>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      ${botonRow}

                      <!-- Nota/indicaciones -->
                      <tr><td><div class="t102" style="line-height:40px;font-size:1px;display:block;">&nbsp;</div></td></tr>
                      <tr><td align="center">
                        <table class="t106" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td width="510" class="t105" style="width:800px;">
                            <table class="t104" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t103" style="border-bottom:2px solid #EEEEEE;border-top:2px solid #EEEEEE;padding:25px 0;">
                                <div class="t101" style="width:100%;text-align:left;">
                                  <div class="t100" style="display:inline-block;">
                                    <table class="t99" role="presentation" cellpadding="0" cellspacing="0" align="left" valign="middle">
                                      <tr class="t98"><td></td>
                                        <td class="t83" width="96.77" valign="middle">
                                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t81" style="width:100%;">
                                            <tr><td class="t79" style="background-color:transparent;">
                                              <div style="font-size:0px;">
                                                <img class="t78" style="display:block;border:0;height:auto;width:100%;Margin:0;max-width:100%;" width="86.77" height="86.77" alt="" src="https://02f839bd-3369-4e6e-9247-1b8f6c6c8eb6.b-cdn.net/e/08283a31-7b1f-41ce-aa80-e84b0d4c4451/8e50d5af-81d4-43f9-b45a-82b24ea3e745.png"/>
                                              </div>
                                            </td><td class="t80" style="width:10px;" width="10"></td></tr>
                                          </table>
                                          <div class="t82" style="font-size:1px;display:none;">&nbsp;&nbsp;</div>
                                        </td>
                                        <td class="t97" width="413.22" valign="middle">
                                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="t96" style="width:100%;">
                                            <tr><td class="t95">
                                              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100% !important;">
                                                <tr><td align="center">
                                                  <table class="t88" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                                    <tr><td width="413.22" class="t87" style="width:600px;">
                                                      <table class="t86" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                                        <tr><td class="t85">
                                                          <p class="t84" style="margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:700;font-size:16px;color:#454545;text-align:left;">
                                                            Preséntese con al menos 15 minutos de antelación.&nbsp;
                                                          </p>
                                                        </td></tr>
                                                      </table>
                                                    </td></tr>
                                                  </table>
                                                </td></tr>
                                              </table>
                                            </td></tr>
                                            <tr><td><div class="t90" style="line-height:16px;font-size:1px;display:block;">&nbsp;</div></td></tr>
                                            <tr><td align="center">
                                              <table class="t94" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                                                <tr><td width="413.22" class="t93" style="width:600px;">
                                                  <table class="t92" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                                                    <tr><td class="t91">
                                                      <p class="t89" style="margin:0;font-family:Roboto,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:400;font-size:16px;color:#333333;text-align:left;">
                                                        Verifique su material y documentación. Considere las instrucciones específicas de la coordinación.
                                                      </p>
                                                    </td></tr>
                                                  </table>
                                                </td></tr>
                                              </table>
                                            </td></tr>
                                          </table>
                                        </td></tr>
                                    </table>
                                  </div>
                                </div>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <tr><td><div class="t107" style="line-height:40px;font-size:1px;display:block;">&nbsp;</div></td></tr>

                      <tr><td align="center">
                        <table class="t112" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td class="t111">
                            <table class="t110" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t109">
                                <p class="t108" style="margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:13px;color:#949494;text-align:left;">
                                  Este mensaje ha sido enviado por la Coordinación Académica.
                                </p>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                      <tr><td align="center">
                        <table class="t117" role="presentation" cellpadding="0" cellspacing="0" style="Margin-left:auto;Margin-right:auto;">
                          <tr><td class="t116">
                            <table class="t115" role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;">
                              <tr><td class="t114">
                                <p class="t113" style="margin:0;font-family:Poppins,BlinkMacSystemFont,Segoe UI,Helvetica Neue,Arial,sans-serif;line-height:22px;font-weight:500;font-size:13px;color:#949494;text-align:left;">
                                  Universidad Tecnologica Privada de Santa Cruz · Av. Noel Kempff Mercado 715, Santa Cruz de la Sierra
                                </p>
                              </td></tr>
                            </table>
                          </td></tr>
                        </table>
                      </td></tr>

                    </table>
                  </td></tr>
                </table>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</div>
<div class="gmail-fix" style="display:none;white-space:nowrap;font:15px courier;line-height:0;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div>
</body>
</html>`;
            };

            // 6) Construcción del HTML según estado (sin alterar la lógica general)
            let messageHTML = buildTabularHtml({
                title,
                nombreUpper,
                fechaFormateada,
                tipoDefensa: defensaInfo.tipo_defensa,
                area: defensaInfo.area,
                caso: defensaInfo.caso,
                linkCasoUrl: linkCasoUrl
            });

            // 7) Envío con timeout (mismo mecanismo)
            const templateData = { title, message: messageHTML };

            const envioExitoso = await Promise.race([
                this.notificacionService.sendEmailWithTemplate(email, asunto, templateData),
                new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Timeout al enviar email')), 30000))
            ]);

            if (envioExitoso) {
                console.log(`Email enviado exitosamente a ${nombreCompleto} (${email})`);
            } else {
                console.log(`No se pudo enviar el email a ${nombreCompleto} (${email})`);
            }
        } catch (error) {
            console.error(`❌ Error al enviar email al estudiante ${idEstudiante}:`, (error as any)?.message || error);
        }
    }



    private async enviarNotificacionCalificacion(defensa: any, nota: number, estado: string) {
        try {
            if (!defensa.estudiante?.Persona?.telefono) {
                console.log(`No se pudo enviar notificación de calificación: estudiante sin teléfono`);
                return;
            }

            const nombreCompleto = `${defensa.estudiante.Persona.Nombre} ${defensa.estudiante.Persona.Apellido1} ${defensa.estudiante.Persona.Apellido2 || ''}`.trim();
            const telefono = defensa.estudiante.Persona.telefono.toString();

            const fechaFormateada = new Date(defensa.fecha_defensa).toLocaleDateString('es-BO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let mensaje = `¡Hola ${nombreCompleto}! 👋\n\n`;

            if (estado === 'APROBADO') {
                mensaje += `🎉 *¡FELICIDADES! Has APROBADO tu defensa* 🎉\n\n`;
                mensaje += `✅ *Calificación obtenida:* ${nota}/100\n`;
                mensaje += `📅 *Fecha de defensa:* ${fechaFormateada}\n`;
                mensaje += `📚 *Tipo de defensa:* ${defensa.Tipo_Defensa?.Nombre || 'N/A'}\n`;
                if (defensa.area?.nombre_area) {
                    mensaje += `🎯 *Área:* ${defensa.area.nombre_area}\n`;
                }
                mensaje += `\n¡Excelente trabajo! Continúa con el siguiente paso en tu formación académica. 🚀`;
            } else {
                mensaje += `📋 *Resultado de tu defensa*\n\n`;
                mensaje += `❌ *Estado:* No Aprobado\n`;
                mensaje += `📊 *Calificación obtenida:* ${nota}/100\n`;
                mensaje += `📅 *Fecha de defensa:* ${fechaFormateada}\n`;
                mensaje += `📚 *Tipo de defensa:* ${defensa.Tipo_Defensa?.Nombre || 'N/A'}\n`;
                mensaje += `\n💪 No te desanimes. Revisa los comentarios del tribunal y prepárate para una nueva oportunidad.`;
            }

            const envioExitoso = await Promise.race([
                this.notificacionService.sendMessage(telefono, mensaje),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 30000)
                )
            ]);

            if (envioExitoso) {
                console.log(`✅ Notificación de calificación enviada exitosamente por WhatsApp al estudiante ${nombreCompleto}`);
            } else {
                console.log(`❌ No se pudo enviar la notificación de calificación por WhatsApp al estudiante ${nombreCompleto}`);
            }

        } catch (error) {
            console.error(`❌ Error al enviar notificación de calificación por WhatsApp:`, error.message || error);
        }
    }

    private async enviarNotificacionEmailCalificacion(defensa: any, nota: number, estado: string) {
        try {
            if (!defensa.estudiante?.Persona?.Correo) {
                console.log(`No se pudo enviar email de calificación: estudiante sin email`);
                return;
            }

            const nombreCompleto = `${defensa.estudiante.Persona.Nombre} ${defensa.estudiante.Persona.Apellido1} ${defensa.estudiante.Persona.Apellido2 || ''}`.trim();
            const email = defensa.estudiante.Persona.Correo;

            const fechaFormateada = new Date(defensa.fecha_defensa).toLocaleDateString('es-BO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            let asunto = '';
            let templateData: any = {};

            if (estado === 'APROBADO') {
                asunto = `🎉 ¡FELICIDADES! Defensa Aprobada - Calificación: ${nota}/100`;

                templateData = {
                    title: '🎉 ¡DEFENSA APROBADA!',
                    message: `
                        <div style="text-align: center; background-color: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 5px; margin: 15px 0;">
                            <h2 style="color: #155724; margin: 0;">¡FELICIDADES!</h2>
                            <p style="color: #155724; font-size: 18px; margin: 10px 0;"><strong>Has APROBADO tu defensa</strong></p>
                        </div>
                        
                        <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
                        
                        <p>Nos complace informarte que has aprobado exitosamente tu defensa con los siguientes detalles:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 15px 0;">
                            <ul style="list-style: none; padding: 0;">
                                <li style="margin: 10px 0;"><strong>✅ Calificación obtenida:</strong> <span style="color: #28a745; font-size: 18px; font-weight: bold;">${nota}/100</span></li>
                                <li style="margin: 10px 0;"><strong>📅 Fecha de defensa:</strong> ${fechaFormateada}</li>
                                <li style="margin: 10px 0;"><strong>📚 Tipo de defensa:</strong> ${defensa.Tipo_Defensa?.Nombre || 'N/A'}</li>
                                ${defensa.area?.nombre_area ? `<li style="margin: 10px 0;"><strong>🎯 Área:</strong> ${defensa.area.nombre_area}</li>` : ''}
                                ${defensa.casos_de_estudio?.Nombre_Archivo ? `<li style="margin: 10px 0;"><strong>📋 Caso de estudio:</strong> ${defensa.casos_de_estudio.Nombre_Archivo}</li>` : ''}
                            </ul>
                        </div>
                        
                        <p><strong>¡Excelente trabajo!</strong> Tu dedicación y esfuerzo han dado frutos. Continúa con el siguiente paso en tu formación académica.</p>
                        
                        <p>Te deseamos mucho éxito en tus futuros proyectos académicos y profesionales. 🚀</p>
                        
                        <p>Saludos cordiales,<br>
                        <strong>Sistema Gestura - UTEPSA</strong></p>
                    `,
                    buttonText: 'Ver Detalles en el Sistema',
                    buttonUrl: '#' // Aquí puedes poner la URL del sistema
                };
            } else {
                asunto = `📋 Resultado de Defensa - Calificación: ${nota}/100`;

                templateData = {
                    title: '📋 Resultado de tu Defensa',
                    message: `
                        <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
                        
                        <p>Te informamos sobre el resultado de tu defensa:</p>
                        
                        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 15px 0;">
                            <ul style="list-style: none; padding: 0;">
                                <li style="margin: 10px 0;"><strong>📊 Calificación obtenida:</strong> <span style="color: #dc3545; font-size: 18px; font-weight: bold;">${nota}/100</span></li>
                                <li style="margin: 10px 0;"><strong>❌ Estado:</strong> <span style="color: #dc3545;">No Aprobado</span></li>
                                <li style="margin: 10px 0;"><strong>📅 Fecha de defensa:</strong> ${fechaFormateada}</li>
                                <li style="margin: 10px 0;"><strong>📚 Tipo de defensa:</strong> ${defensa.Tipo_Defensa?.Nombre || 'N/A'}</li>
                                ${defensa.area?.nombre_area ? `<li style="margin: 10px 0;"><strong>🎯 Área:</strong> ${defensa.area.nombre_area}</li>` : ''}
                            </ul>
                        </div>
                        
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>💪 No te desanimes:</strong></p>
                            <p>Esta experiencia es parte del proceso de aprendizaje. Te recomendamos:</p>
                            <ul>
                                <li>Revisar los comentarios y observaciones del tribunal</li>
                                <li>Consultar con tus asesores académicos</li>
                                <li>Prepararte adecuadamente para una nueva oportunidad</li>
                                <li>Mantener una actitud positiva y perseverante</li>
                            </ul>
                        </div>
                        
                        <p>Recuerda que cada experiencia nos ayuda a crecer. ¡Tú puedes lograrlo!</p>
                        
                        <p>Saludos cordiales,<br>
                        <strong>Sistema Gestura - UTEPSA</strong></p>
                    `
                };
            }

            const envioExitoso = await Promise.race([
                this.notificacionService.sendEmailWithTemplate(email, asunto, templateData),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout al enviar email')), 30000)
                )
            ]);

            if (envioExitoso) {
                console.log(`✅ Email de calificación enviado exitosamente al estudiante ${nombreCompleto} (${email})`);
            } else {
                console.log(`❌ No se pudo enviar el email de calificación al estudiante ${nombreCompleto} (${email})`);
            }

        } catch (error) {
            console.error(`❌ Error al enviar email de calificación:`, error.message || error);
        }
    }



    async eliminarDefensa(
        idDefensa: number | string,
        opts: { force?: boolean } = {},
    ) {
        const id = Number(idDefensa);
        if (!Number.isFinite(id)) {
            throw new BadRequestException('id_defensa inválido');
        }

        return this.prisma.$transaction(async (tx) => {
            const defensa = await tx.defensa.findUnique({
                where: { id_defensa: id },
                select: { id_defensa: true, estado: true },
            });

            if (!defensa) {
                throw new NotFoundException('Defensa no encontrada');
            }

            if (!opts.force && (defensa.estado === 'APROBADO' || defensa.estado === 'REPROBADO')) {
                throw new BadRequestException(
                    `No se puede eliminar una defensa en estado ${defensa.estado}. Usa ?force=true si realmente quieres borrarla.`,
                );
            }

            const [delTribunal, delArchivos] = await Promise.all([
                tx.tribunal_defensa.deleteMany({ where: { id_defensa: id } }),
                tx.archivos_defensa.deleteMany({ where: { id_defensa: id } }),
            ]);

            const delDefensa = await tx.defensa.delete({
                where: { id_defensa: id },
            });

            return {
                ok: true,
                id_defensa: delDefensa.id_defensa,
                estado_prev: defensa.estado,
                deleted_children: {
                    tribunal_defensa: delTribunal.count,
                    archivos_defensa: delArchivos.count,
                },
            };
        });
    }

    /**
     * Envía un mensaje personalizado de WhatsApp a múltiples estudiantes por número de registro
     * @param registros Array de números de registro de estudiantes
     * @param mensaje Mensaje personalizado a enviar
     * @returns Array con resultados del envío para cada estudiante
     */
    public async enviarMensajeWhatsAppMasivoPorRegistro(registros: string[], mensaje: string) {
        const resultados: { 
            registro: string; 
            idEstudiante?: number;
            enviado: boolean; 
            nombre?: string; 
            telefono?: string; 
            error?: string 
        }[] = [];

        for (const registro of registros) {
            try {
                // Buscar estudiante por número de registro
                const estudiante = await this.prisma.estudiante.findFirst({
                    where: { nroRegistro: registro },
                    include: { Persona: true }
                });

                if (!estudiante) {
                    resultados.push({
                        registro,
                        enviado: false,
                        error: 'Estudiante no encontrado con este número de registro'
                    });
                    continue;
                }

                if (!estudiante.Persona?.telefono) {
                    resultados.push({
                        registro,
                        idEstudiante: Number(estudiante.id_estudiante),
                        enviado: false,
                        nombre: `${estudiante.Persona?.Nombre || ''} ${estudiante.Persona?.Apellido1 || ''}`.trim(),
                        error: 'Estudiante sin número de teléfono'
                    });
                    continue;
                }

                const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
                const telefono = String(estudiante.Persona.telefono);

                // Personalizar el mensaje con el nombre del estudiante
                const mensajePersonalizado = mensaje.replace(/\{nombre\}/g, nombreCompleto);

                // Envío directo a la cola (más confiable que sendMessage)
                try {
                    // Usar el método sendMessage que automáticamente encola si falla
                    const envioExitoso = await this.notificacionService.sendMessage(telefono, mensajePersonalizado);
                    
                    if (envioExitoso) {
                        console.log(`Mensaje personalizado enviado exitosamente a ${nombreCompleto} (${telefono}) - Registro: ${registro}`);
                        resultados.push({
                            registro,
                            idEstudiante: Number(estudiante.id_estudiante),
                            enviado: true,
                            nombre: nombreCompleto,
                            telefono
                        });
                    } else {
                        console.log(`Mensaje encolado para reintento: ${nombreCompleto} (${telefono}) - Registro: ${registro}`);
                        resultados.push({
                            registro,
                            idEstudiante: Number(estudiante.id_estudiante),
                            enviado: true, // Lo marcamos como enviado porque se encoló
                            nombre: nombreCompleto,
                            telefono
                        });
                    }
                } catch (error) {
                    console.log(`Mensaje encolado por error: ${nombreCompleto} (${telefono}) - Registro: ${registro} - Error: ${error.message}`);
                    resultados.push({
                        registro,
                        idEstudiante: Number(estudiante.id_estudiante),
                        enviado: true, // Lo marcamos como enviado porque se encoló
                        nombre: nombreCompleto,
                        telefono
                    });
                }

            } catch (error) {
                console.error(`Error al enviar mensaje personalizado al estudiante con registro ${registro}:`, error?.message || error);
                resultados.push({
                    registro,
                    enviado: false,
                    error: error?.message || 'Error desconocido'
                });
            }
        }

        return {
            total: registros.length,
            enviados: resultados.filter(r => r.enviado).length,
            fallidos: resultados.filter(r => !r.enviado).length,
            resultados
        };
    }

    /**
     * Obtiene el estado actual del servicio de WhatsApp
     * @returns Estado del servicio de notificaciones
     */
    public async getEstadoWhatsApp() {
        try {
            const estado = this.notificacionService.getEstado();
            console.log('Estado de WhatsApp:', estado);
            return estado;
        } catch (error) {
            console.error('Error al obtener estado de WhatsApp:', error);
            return {
                error: 'No se pudo obtener el estado de WhatsApp',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Envía un mensaje personalizado de WhatsApp a múltiples estudiantes (método original por IDs)
     * @param estudiantesIds Array de IDs de estudiantes
     * @param mensaje Mensaje personalizado a enviar
     * @returns Array con resultados del envío para cada estudiante
     */
    public async enviarMensajeWhatsAppMasivo(estudiantesIds: number[], mensaje: string) {
        const resultados: { 
            idEstudiante: number; 
            enviado: boolean; 
            nombre?: string; 
            telefono?: string; 
            error?: string 
        }[] = [];

        for (const idEstudiante of estudiantesIds) {
            try {
                // Obtener datos del estudiante
                const estudiante = await this.prisma.estudiante.findUnique({
                    where: { id_estudiante: idEstudiante },
                    include: { Persona: true }
                });

                if (!estudiante) {
                    resultados.push({
                        idEstudiante,
                        enviado: false,
                        error: 'Estudiante no encontrado'
                    });
                    continue;
                }

                if (!estudiante.Persona?.telefono) {
                    resultados.push({
                        idEstudiante,
                        enviado: false,
                        nombre: `${estudiante.Persona?.Nombre || ''} ${estudiante.Persona?.Apellido1 || ''}`.trim(),
                        error: 'Estudiante sin número de teléfono'
                    });
                    continue;
                }

                const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
                const telefono = String(estudiante.Persona.telefono);

                // Personalizar el mensaje con el nombre del estudiante
                const mensajePersonalizado = mensaje.replace(/\{nombre\}/g, nombreCompleto);

                // Enviar mensaje con timeout
                const envioExitoso = await Promise.race([
                    this.notificacionService.sendMessage(telefono, mensajePersonalizado),
                    new Promise<boolean>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 30000)
                    ),
                ]);

                if (envioExitoso) {
                    console.log(`Mensaje personalizado enviado exitosamente a ${nombreCompleto} (${telefono})`);
                    resultados.push({
                        idEstudiante,
                        enviado: true,
                        nombre: nombreCompleto,
                        telefono
                    });
                } else {
                    resultados.push({
                        idEstudiante,
                        enviado: false,
                        nombre: nombreCompleto,
                        telefono,
                        error: 'Error al enviar mensaje'
                    });
                }

            } catch (error) {
                console.error(`Error al enviar mensaje personalizado al estudiante ${idEstudiante}:`, error?.message || error);
                resultados.push({
                    idEstudiante,
                    enviado: false,
                    error: error?.message || 'Error desconocido'
                });
            }
        }

        return {
            total: estudiantesIds.length,
            enviados: resultados.filter(r => r.enviado).length,
            fallidos: resultados.filter(r => !r.enviado).length,
            resultados
        };
    }


}
