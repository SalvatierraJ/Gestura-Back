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
        console.log("IDs recibidos para sortear defensa:", estudiantes);
        console.log("body", body);
        const estudiantesIds = Array.isArray(estudiantes) ? estudiantes : [estudiantes];
        const { sorteaArea, sorteaCaso, tipoDefensa } = body;
        const fechaDefensa = new Date(body.fechaDefensa || body.fechaHora);
        const defensasCreadas: any[] = [];

        return await this.prisma.$transaction(async (tx) => {
            const defensasMismaFecha = await tx.defensa.findMany({
                where: {
                    fecha_defensa: fechaDefensa,
                    id_casoEstudio: { not: null }
                },
                select: { id_casoEstudio: true }
            });
            const casosYaAsignados = new Set(defensasMismaFecha.map(d => d.id_casoEstudio?.toString()));

            const tipo = await tx.tipo_Defensa.findFirst({
                where: { Nombre: tipoDefensa }
            });
            if (!tipo) throw new HttpException("Tipo de defensa no encontrado", 400);

            for (const idEstudiante of estudiantesIds) {
                const estudiante = await tx.estudiante.findUnique({
                    where: { id_estudiante: Number(idEstudiante) }, // por si llega string
                    include: { estudiante_Carrera: { include: { carrera: true } } }
                });
                if (!estudiante) throw new HttpException("Estudiante no encontrado", 400);
                if (!estudiante.estudiante_Carrera?.length) throw new Error("Estudiante sin carrera");

                const idCarrera = estudiante.estudiante_Carrera[0].Id_Carrera;
                const areasRelacionadas = await tx.carrera_Area.findMany({
                    where: { Id_Carrera: idCarrera },
                    include: { area: true }
                });
                if (!areasRelacionadas.length) throw new HttpException("No hay áreas asociadas a la carrera", 400);

                // ------- ÁREA -------------
                let areaSorteada: number | null = null;
                let areaNombre: string | null = null;
                if (sorteaArea) {
                    const idx = areasRelacionadas.length === 1
                        ? 0
                        : Math.floor(Math.random() * areasRelacionadas.length);
                    areaSorteada = Number(areasRelacionadas[idx].Id_Area);
                    areaNombre = areasRelacionadas[idx].area?.nombre_area || null;
                } else {
                    areaSorteada = body.id_area ?? null;
                    const areaObj = areasRelacionadas.find(a => a.Id_Area === areaSorteada);
                    areaNombre = areaObj?.area?.nombre_area || null;
                }

                let casoSorteado: number | null = null;
                let casoNombre: string | null = null;
                if (sorteaCaso && areaSorteada) {
                    const casos = await tx.casos_de_estudio.findMany({
                        where: { id_area: areaSorteada, estado: true }
                    });
                    const casosDisponibles = casos.filter(
                        c => !casosYaAsignados.has(c.id_casoEstudio.toString())
                    );
                    if (!casosDisponibles.length) {
                        throw new HttpException(`No hay casos disponibles para el estudiante ${idEstudiante} en el área y fecha indicada.`, 400);
                    }
                    const idx = casosDisponibles.length === 1
                        ? 0
                        : Math.floor(Math.random() * casosDisponibles.length);
                    const caso = casosDisponibles[idx];
                    casoSorteado = Number(caso.id_casoEstudio);
                    casoNombre = caso.Nombre_Archivo || null;
                    casosYaAsignados.add(caso.id_casoEstudio.toString());
                } else if (!sorteaCaso) {
                    casoSorteado = body.id_casoEstudio ?? null;
                    if (casoSorteado) {
                        const caso = await tx.casos_de_estudio.findUnique({
                            where: { id_casoEstudio: casoSorteado }
                        });
                        casoNombre = caso?.Nombre_Archivo || null;
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
                if (defensaExistente) throw new HttpException(`Ya existe una defensa para este estudiante en esa fecha y tipo.`, 400);

                let estadoDefensa = "ASIGNADO";
                if (!areaSorteada || !casoSorteado) {
                    estadoDefensa = "PENDIENTE";
                }

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
                        // id_encargados_carrera: body.id_encargados_carrera
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
            // Enviar notificaciones fuera de la transacción para no bloquear
            for (const defensa of defensasCreadas) {
                // Enviar notificación por WhatsApp (sin bloquear)
                this.enviarNotificacionDefensa(Number(defensa.estudiante), {
                    area: defensa.area,
                    caso: defensa.caso,
                    fecha: defensa.fecha,
                    tipo_defensa: defensa.tipo_defensa,
                    estado: defensa.estado
                }).catch(error => {
                    console.error(`Error al procesar notificación WhatsApp para estudiante ${defensa.estudiante}:`, error);
                });

                // Enviar notificación por Email (sin bloquear)
                this.enviarNotificacionEmailDefensa(Number(defensa.estudiante), {
                    area: defensa.area,
                    caso: defensa.caso,
                    fecha: defensa.fecha,
                    tipo_defensa: defensa.tipo_defensa,
                    estado: defensa.estado
                }).catch(error => {
                    console.error(`Error al procesar notificación Email para estudiante ${defensa.estudiante}:`, error);
                });
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
                    usuario_Carrera:true
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
            // Obtener información del estudiante y su teléfono
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: idEstudiante },
                include: {
                    Persona: true
                }
            });

            if (!estudiante || !estudiante.Persona || !estudiante.Persona.telefono) {
                console.log(`No se pudo enviar notificación: estudiante sin teléfono (ID: ${idEstudiante})`);
                return;
            }

            const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
            const telefono = estudiante.Persona.telefono.toString();
            
            const fechaFormateada = new Date(defensaInfo.fecha).toLocaleDateString('es-BO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let mensaje = `¡Hola ${nombreCompleto}! 👋\n\n`;
            
            if (defensaInfo.estado === 'ASIGNADO') {
                mensaje += `✅ *Tu defensa ha sido programada exitosamente*\n\n`;
                mensaje += `📅 *Fecha y hora:* ${fechaFormateada}\n`;
                mensaje += `📚 *Tipo de defensa:* ${defensaInfo.tipo_defensa}\n`;
                if (defensaInfo.area) {
                    mensaje += `🎯 *Área asignada:* ${defensaInfo.area}\n`;
                }
                if (defensaInfo.caso) {
                    mensaje += `📋 *Caso de estudio:* ${defensaInfo.caso}\n`;
                }
                mensaje += `\n¡Te deseamos mucho éxito en tu defensa! 🍀`;
            } else if (defensaInfo.estado === 'PENDIENTE') {
                mensaje += `⏳ *Tu defensa ha sido registrada*\n\n`;
                mensaje += `📅 *Fecha y hora:* ${fechaFormateada}\n`;
                mensaje += `📚 *Tipo de defensa:* ${defensaInfo.tipo_defensa}\n`;
                mensaje += `\n⚠️ *Nota:* Aún faltan algunos detalles por asignar. Te notificaremos cuando esté todo listo.`;
            }

            // Enviar mensaje con timeout para evitar bloqueos largos
            const envioExitoso = await Promise.race([
                this.notificacionService.sendMessage(telefono, mensaje),
                new Promise<boolean>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 30000)
                )
            ]);

            if (envioExitoso) {
                console.log(`✅ Notificación enviada exitosamente al estudiante ${nombreCompleto} (${telefono})`);
            } else {
                console.log(`❌ No se pudo enviar la notificación al estudiante ${nombreCompleto} (${telefono})`);
            }
            
        } catch (error) {
            console.error(`❌ Error al enviar notificación al estudiante ${idEstudiante}:`, error.message || error);
            // Intentar registrar en base de datos para reenvío posterior (opcional)
            // await this.registrarNotificacionFallida(idEstudiante, defensaInfo);
        }
    }

    private async enviarNotificacionEmailDefensa(idEstudiante: number, defensaInfo: any) {
        try {
            // Obtener información del estudiante y su email
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: idEstudiante },
                include: {
                    Persona: true
                }
            });

            if (!estudiante || !estudiante.Persona || !estudiante.Persona.Correo) {
                console.log(`No se pudo enviar email: estudiante sin email (ID: ${idEstudiante})`);
                return;
            }

            const nombreCompleto = `${estudiante.Persona.Nombre} ${estudiante.Persona.Apellido1} ${estudiante.Persona.Apellido2 || ''}`.trim();
            const email = estudiante.Persona.Correo;
            
            const fechaFormateada = new Date(defensaInfo.fecha).toLocaleDateString('es-BO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let asunto = '';
            let mensaje = '';
            let templateData: any = {};

            if (defensaInfo.estado === 'ASIGNADO') {
                asunto = `✅ Defensa Programada - ${defensaInfo.tipo_defensa}`;
                mensaje = `Tu defensa ha sido programada exitosamente para el ${fechaFormateada}.`;
                
                templateData = {
                    title: '🎓 Defensa Programada Exitosamente',
                    message: `
                        <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
                        
                        <p>Te informamos que tu defensa ha sido programada con los siguientes detalles:</p>
                        
                        <ul>
                            <li><strong>📅 Fecha y hora:</strong> ${fechaFormateada}</li>
                            <li><strong>📚 Tipo de defensa:</strong> ${defensaInfo.tipo_defensa}</li>
                            ${defensaInfo.area ? `<li><strong>🎯 Área asignada:</strong> ${defensaInfo.area}</li>` : ''}
                            ${defensaInfo.caso ? `<li><strong>📋 Caso de estudio:</strong> ${defensaInfo.caso}</li>` : ''}
                        </ul>
                        
                        <p><strong>Recomendaciones importantes:</strong></p>
                        <ul>
                            <li>Llega 15 minutos antes de la hora programada</li>
                            <li>Revisa todo el material relacionado con tu área y caso de estudio</li>
                            <li>Prepárate mental y académicamente para la defensa</li>
                        </ul>
                        
                        <p>¡Te deseamos mucho éxito en tu defensa! 🍀</p>
                        
                        <p>Saludos cordiales,<br>
                        <strong>Sistema Gestura - UTEPSA</strong></p>
                    `
                };
            } else if (defensaInfo.estado === 'PENDIENTE') {
                asunto = `⏳ Defensa Registrada - Pendiente de Asignación`;
                mensaje = `Tu defensa ha sido registrada pero aún faltan algunos detalles por asignar.`;
                
                templateData = {
                    title: '📝 Defensa Registrada - Pendiente',
                    message: `
                        <p>Estimado/a <strong>${nombreCompleto}</strong>,</p>
                        
                        <p>Te informamos que tu defensa ha sido registrada en el sistema:</p>
                        
                        <ul>
                            <li><strong>📅 Fecha programada:</strong> ${fechaFormateada}</li>
                            <li><strong>📚 Tipo de defensa:</strong> ${defensaInfo.tipo_defensa}</li>
                            <li><strong>📊 Estado:</strong> Pendiente de asignación completa</li>
                        </ul>
                        
                        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0;">
                            <p><strong>⚠️ Nota importante:</strong></p>
                            <p>Aún faltan algunos detalles por asignar (área específica o caso de estudio). Te notificaremos por este mismo medio cuando todo esté completamente asignado.</p>
                        </div>
                        
                        <p>Mantente atento a futuras comunicaciones.</p>
                        
                        <p>Saludos cordiales,<br>
                        <strong>Sistema Gestura - UTEPSA</strong></p>
                    `
                };
            }

            // Enviar email con timeout para evitar bloqueos largos
            const envioExitoso = await Promise.race([
                this.notificacionService.sendEmailWithTemplate(email, asunto, templateData),
                new Promise<boolean>((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout al enviar email')), 30000)
                )
            ]);

            if (envioExitoso) {
                console.log(`✅ Email enviado exitosamente al estudiante ${nombreCompleto} (${email})`);
            } else {
                console.log(`❌ No se pudo enviar el email al estudiante ${nombreCompleto} (${email})`);
            }
            
        } catch (error) {
            console.error(`❌ Error al enviar email al estudiante ${idEstudiante}:`, error.message || error);
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
