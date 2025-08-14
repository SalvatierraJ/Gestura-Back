import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { NotificacionService } from 'src/notificacion/notificacion.service';

@Injectable()
export class DefensaService {
    constructor(
        private prisma: PrismaService,
        private notificacionService: NotificacionService
    ) { }

    async generarDefensa(estudiantes: number[] | number, body: any) {
        const estudiantesIds = Array.isArray(estudiantes) ? estudiantes : [estudiantes];
        const { sorteaArea, sorteaCaso, tipoDefensa } = body;
        const fechaDefensa = new Date(body.fechaDefensa || body.fechaHora);
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
            const defensasMismaFecha = await tx.defensa.findMany({
                where: { fecha_defensa: fechaDefensa, id_casoEstudio: { not: null } },
                select: { id_casoEstudio: true }
            });
            const casosYaAsignados = new Set(defensasMismaFecha.map(d => d.id_casoEstudio?.toString()));

            const tipo = await tx.tipo_Defensa.findFirst({ where: { Nombre: tipoDefensa } });
            if (!tipo) throw new HttpException("Tipo de defensa no encontrado", 400);

            for (const idEstudiante of estudiantesIds) {
                const estudiante = await tx.estudiante.findUnique({
                    where: { id_estudiante: Number(idEstudiante) },
                    include: { estudiante_Carrera: { include: { carrera: true } } }
                });
                if (!estudiante) throw new HttpException("Estudiante no encontrado", 400);
                if (!estudiante.estudiante_Carrera?.length) throw new Error("Estudiante sin carrera");

                const idCarrera = estudiante.estudiante_Carrera[0].Id_Carrera;

                // Áreas RELACIONADAS y DISPONIBLES (estado = true)
                const areasRelacionadas = await tx.carrera_Area.findMany({
                    where: { Id_Carrera: idCarrera, area: { estado: true } },
                    include: { area: true }
                });
                if (!areasRelacionadas.length) {
                    throw new HttpException("No hay áreas disponibles (estado true) asociadas a la carrera", 400);
                }

                const allAreaIdsAvail = areasRelacionadas.map(a => Number(a.Id_Area));

                // ----------------- SELECCIÓN DE ÁREA -----------------
                let areaSorteada: number | null = null;
                let areaNombre: string | null = null;

                if (sorteaCaso) {
                    // Caso se elige automáticamente → el área puede cambiar durante la búsqueda
                    if (sorteaArea) {
                        const idx = allAreaIdsAvail.length === 1 ? 0 : Math.floor(Math.random() * allAreaIdsAvail.length);
                        areaSorteada = allAreaIdsAvail[idx];
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                        areaNombre = ao?.area?.nombre_area || null;
                    } else {
                        const preferida = body.id_area ? Number(body.id_area) : null;
                        if (preferida && allAreaIdsAvail.includes(preferida)) {
                            areaSorteada = preferida;
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === preferida);
                            areaNombre = ao?.area?.nombre_area || null;
                        } else {
                            // si el id_area recibido no está disponible, se ignora
                            areaSorteada = null;
                            areaNombre = null;
                        }
                    }
                } else {
                    // Caso manual → validar que el área manual (si viene) esté disponible (estado true)
                    if (!sorteaArea) {
                        const manualArea = body.id_area ? Number(body.id_area) : null;
                        if (manualArea && allAreaIdsAvail.includes(manualArea)) {
                            areaSorteada = manualArea;
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === manualArea);
                            areaNombre = ao?.area?.nombre_area || null;
                        } else if (manualArea) {
                            throw new HttpException("El área indicada no está disponible (estado false) o no pertenece a la carrera.", 400);
                        }
                    } else {
                        // sorteaArea true pero sorteaCaso false (raro): sorteamos área disponible
                        const idx = allAreaIdsAvail.length === 1 ? 0 : Math.floor(Math.random() * allAreaIdsAvail.length);
                        areaSorteada = allAreaIdsAvail[idx];
                        const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                        areaNombre = ao?.area?.nombre_area || null;
                    }
                }

                // ----------------- SELECCIÓN DE CASO -----------------
                let casoSorteado: number | null = null;
                let casoNombre: string | null = null;

                if (sorteaCaso) {
                    // Lista de áreas candidatas (todas disponibles = estado true)
                    let candidatas: number[];
                    if (areaSorteada) {
                        const resto = allAreaIdsAvail.filter(id => id !== Number(areaSorteada));
                        candidatas = [Number(areaSorteada), ...shuffle(resto)];
                    } else {
                        candidatas = shuffle(allAreaIdsAvail);
                    }

                    let seleccionado = false;
                    for (const idArea of candidatas) {
                        // Casos DISPONIBLES (estado = true) en esa área
                        const casos = await tx.casos_de_estudio.findMany({
                            where: { id_area: idArea, estado: true },
                            select: { id_casoEstudio: true, Nombre_Archivo: true }
                        });

                        const disponibles = casos.filter(c => !casosYaAsignados.has(c.id_casoEstudio.toString()));
                        if (disponibles.length > 0) {
                            const idx = disponibles.length === 1 ? 0 : Math.floor(Math.random() * disponibles.length);
                            const caso = disponibles[idx];

                            casoSorteado = Number(caso.id_casoEstudio);
                            casoNombre = caso.Nombre_Archivo || null;

                            areaSorteada = idArea;
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === idArea);
                            areaNombre = ao?.area?.nombre_area || null;

                            casosYaAsignados.add(caso.id_casoEstudio.toString());
                            seleccionado = true;
                            break;
                        }
                    }

                    if (!seleccionado) {
                        throw new HttpException(
                            `No hay casos disponibles (estado true) para el estudiante ${idEstudiante} en las áreas relacionadas y fecha indicada.`,
                            400
                        );
                    }
                } else {
                    // Caso MANUAL: validar disponibilidad y no asignación
                    const casoManual = body.id_casoEstudio ? Number(body.id_casoEstudio) : null;
                    if (casoManual) {
                        const caso = await tx.casos_de_estudio.findUnique({
                            where: { id_casoEstudio: casoManual }
                        });
                        if (!caso || !caso.estado) {
                            throw new HttpException("El caso indicado no está disponible (estado false) o no existe.", 400);
                        }
                        if (casosYaAsignados.has(casoManual.toString())) {
                            throw new HttpException("El caso indicado ya fue asignado en esa fecha.", 400);
                        }
                        // Si no se indicó área, usar la del caso (y validar que esa área esté disponible para la carrera)
                        if (!areaSorteada) {
                            if (!caso.id_area || !allAreaIdsAvail.includes(Number(caso.id_area))) {
                                throw new HttpException("El área del caso no está disponible para la carrera.", 400);
                            }
                            areaSorteada = Number(caso.id_area);
                            const ao = areasRelacionadas.find(a => Number(a.Id_Area) === areaSorteada);
                            areaNombre = ao?.area?.nombre_area || null;
                        }

                        casoSorteado = casoManual;
                        casoNombre = caso.Nombre_Archivo || null;
                        casosYaAsignados.add(casoManual.toString());
                    }
                }

                // -------- DEFENSA --------------
                const defensaExistente = await tx.defensa.findFirst({
                    where: {
                        id_estudiante: Number(idEstudiante),
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
                        id_estudiante: Number(idEstudiante),
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
                    area: areaNombre,
                    caso: casoNombre,
                    fecha: defensa.fecha_defensa,
                    estado: defensa.estado,
                    tipo_defensa: tipoDefensa
                });
            }

            return defensasCreadas;
        }).then(async (defensasCreadas) => {
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
                orderBy: { fecha_defensa: "desc" }
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
                    const d = new Date(defensa.fecha_defensa);
                    fechaDefensa = d.toLocaleDateString("es-BO");
                    let hora = d.toLocaleTimeString("es-BO", { hour: '2-digit', minute: '2-digit', hour12: true });
                    horaDefensa = hora.replace(/\./g, "").toUpperCase();
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
                orderBy: { fecha_defensa: "desc" }
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
                    const d = new Date(defensa.fecha_defensa);
                    fechaDefensa = d.toLocaleDateString("es-BO"); // Formato dd/mm/aaaa
                    horaDefensa = d.toLocaleTimeString("es-BO", { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\./g, "").toUpperCase(); // Formato HH:MM AM/PM
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

    private async enviarNotificacionDefensa(idEstudiante: number, defensaInfo: any) {
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
                select: { casos_de_estudio: { select: { url: true } } }
            });

            const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
            const telefono = String(estudiante.Persona.telefono);

            // 3) Fecha y hora (formato es-BO + zona horaria La Paz)
            const fechaFormateada = new Date(defensaInfo.fecha).toLocaleString('es-BO', {
                timeZone: 'America/La_Paz',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 4) Mensaje formal (sin emojis)
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


    private async enviarNotificacionEmailDefensa(idEstudiante: number, defensaInfo: any) {
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
            const email = String(estudiante.Persona.Correo);

            // 2) URL del caso (si existiera)
            const linkcaso = await this.prisma.defensa.findFirst({
                where: { id_estudiante: idEstudiante },
                select: { casos_de_estudio: { select: { url: true } } }
            });

            // 3) Fecha/hora en zona de Bolivia
            const fechaFormateada = new Date(defensaInfo.fecha).toLocaleString('es-BO', {
                timeZone: 'America/La_Paz',
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // 4) Paleta institucional
            const colorRojo = '#B71C1C'; // rojo institucional
            const colorNegro = '#000000';
            const colorTexto = '#111111';
            const colorBorde = '#e6e6e6';

            // 5) Asunto + Template (formal, sin emojis)
            let asunto = '';
            let title = '';
            let messageHTML = '';

            const headerHTML = `
      <div style="background:#ffffff;padding:24px 24px 8px 24px;font-family:Segoe UI,Roboto,Arial,sans-serif;color:${colorTexto};">
        <div style="border-top:6px solid ${colorRojo};"></div>
        <h1 style="margin:16px 0 4px 0;color:${colorNegro};font-size:20px;line-height:1.3;">
          Universidad Tecnologica Privada de Santa Cruz
        </h1>
    `;

            const footerHTML = `
        <hr style="border:none;border-top:1px solid ${colorBorde};margin:20px 0;" />
        <p style="margin:0;color:${colorTexto};font-size:12px;line-height:1.5;">
          Este mensaje ha sido enviado por la Coordinación Académica.
        </p>
      </div>
    `;

            if (defensaInfo.estado === 'ASIGNADO') {
                asunto = `Programación de defensa – ${defensaInfo.tipo_defensa}`;
                title = 'Programación de defensa';

                messageHTML = `
        ${headerHTML}
        <h2 style="margin:0 0 16px 0;color:${colorRojo};font-size:18px;line-height:1.35;">${title}</h2>
        <p style="margin:0 0 12px 0;">Estimado/a <strong>${nombreCompleto}</strong>:</p>
        <p style="margin:0 0 12px 0;">
          Le informamos que su defensa ha sido programada con los siguientes detalles:
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;">
          <tr>
            <td style="padding:6px 0;width:180px;color:${colorNegro};font-weight:600;">Fecha y hora</td>
            <td style="padding:6px 0;">${fechaFormateada}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Tipo de defensa</td>
            <td style="padding:6px 0;">${defensaInfo.tipo_defensa}</td>
          </tr>
          ${defensaInfo.area ? `
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Área asignada</td>
            <td style="padding:6px 0;">${defensaInfo.area}</td>
          </tr>` : ''}
          ${defensaInfo.caso ? `
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Caso de estudio</td>
            <td style="padding:6px 0;">${defensaInfo.caso}</td>
          </tr>` : ''}
          ${linkcaso?.casos_de_estudio?.url ? `
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Enlace al caso</td>
            <td style="padding:6px 0;word-break:break-all;">
              <a href="${linkcaso.casos_de_estudio.url}" style="color:${colorRojo};text-decoration:none;">
                ${linkcaso.casos_de_estudio.url}
              </a>
            </td>
          </tr>` : ''}
        </table>

        <div style="background:#fff;border:1px solid ${colorBorde};border-left:4px solid ${colorRojo};padding:12px;border-radius:4px;margin:12px 0;">
          <p style="margin:0 0 8px 0;"><strong>Indicaciones:</strong></p>
          <ul style="margin:0 0 0 18px;padding:0;">
            <li>Preséntese con al menos 15 minutos de antelación.</li>
            <li>Verifique su material y documentación.</li>
            <li>Considere las instrucciones específicas de la coordinación.</li>
          </ul>
        </div>

        <p style="margin:16px 0 0 0;">
          Atentamente,<br/>
          <strong>Coordinación Académica</strong>
        </p>
        ${footerHTML}
      `;
            } else if (defensaInfo.estado === 'PENDIENTE') {
                asunto = 'Defensa registrada – pendiente de asignación';
                title = 'Defensa registrada';

                messageHTML = `
        ${headerHTML}
        <h2 style="margin:0 0 16px 0;color:${colorRojo};font-size:18px;line-height:1.35;">${title}</h2>
        <p style="margin:0 0 12px 0;">Estimado/a <strong>${nombreCompleto}</strong>:</p>
        <p style="margin:0 0 12px 0;">
          Su defensa ha sido registrada con los siguientes datos:
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;">
          <tr>
            <td style="padding:6px 0;width:180px;color:${colorNegro};font-weight:600;">Fecha y hora</td>
            <td style="padding:6px 0;">${fechaFormateada}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Tipo de defensa</td>
            <td style="padding:6px 0;">${defensaInfo.tipo_defensa}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Estado</td>
            <td style="padding:6px 0;">Pendiente de asignación completa</td>
          </tr>
        </table>

        <div style="background:#fff;border:1px solid ${colorBorde};border-left:4px solid ${colorRojo};padding:12px;border-radius:4px;margin:12px 0;">
          <p style="margin:0;">
            Algunos detalles (como el área específica o el caso de estudio) están en proceso de asignación.
            Le notificaremos por este mismo medio cuando se encuentren confirmados.
          </p>
        </div>

        <p style="margin:16px 0 0 0;">
          Atentamente,<br/>
          <strong>Coordinación Académica</strong>
        </p>
        ${footerHTML}
      `;
            } else {
                // Fallback formal
                asunto = 'Actualización sobre su defensa';
                title = 'Actualización de registro';
                messageHTML = `
        ${headerHTML}
        <h2 style="margin:0 0 16px 0;color:${colorRojo};font-size:18px;line-height:1.35;">${title}</h2>
        <p style="margin:0 0 12px 0;">Estimado/a <strong>${nombreCompleto}</strong>:</p>
        <p style="margin:0 0 12px 0;">
          Se registró una actualización relacionada con su defensa.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:0 0 12px 0;">
          <tr>
            <td style="padding:6px 0;width:180px;color:${colorNegro};font-weight:600;">Fecha y hora</td>
            <td style="padding:6px 0;">${fechaFormateada}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${colorNegro};font-weight:600;">Tipo de defensa</td>
            <td style="padding:6px 0;">${defensaInfo.tipo_defensa}</td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;">
          Atentamente,<br/>
          <strong>Coordinación Académica</strong>
        </p>
        ${footerHTML}
      `;
            }

            const templateData = {
                title,          // si tu plantilla usa el título aparte
                message: messageHTML
            };

            // 6) Envío con timeout
            const envioExitoso = await Promise.race([
                this.notificacionService.sendEmailWithTemplate(email, asunto, templateData),
                new Promise<boolean>((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout al enviar email')), 30000)
                )
            ]);

            if (envioExitoso) {
                console.log(`Email enviado exitosamente a ${nombreCompleto} (${email})`);
            } else {
                console.log(`No se pudo enviar el email a ${nombreCompleto} (${email})`);
            }
        } catch (error) {
            console.error(`❌ Error al enviar email al estudiante ${idEstudiante}:`, error?.message || error);
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




}
