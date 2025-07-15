import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class DefensaService {
    constructor(private prisma: PrismaService) { }

    async generarDefensa(estudiantes: number[] | number, body: any) {
        console.log("IDs recibidos para sortear defensa:", estudiantes);
        console.log("body", body);
        const estudiantesIds = Array.isArray(estudiantes) ? estudiantes : [estudiantes];
        const { sorteaArea, sorteaCaso, tipoDefensa } = body;
        const fechaDefensa = new Date(body.fechaDefensa || body.fechaHora);
        const defensasCreadas: any[] = [];

        const defensasMismaFecha = await this.prisma.defensa.findMany({
            where: {
                fecha_defensa: fechaDefensa,
                id_casoEstudio: { not: null }
            },
            select: { id_casoEstudio: true }
        });
        const casosYaAsignados = new Set(defensasMismaFecha.map(d => d.id_casoEstudio?.toString()));

        const tipo = await this.prisma.tipo_Defensa.findFirst({
            where: { Nombre: tipoDefensa }
        });
        if (!tipo) throw new HttpException("Tipo de defensa no encontrado", 400);

        for (const idEstudiante of estudiantesIds) {
            const estudiante = await this.prisma.estudiante.findUnique({
                where: { id_estudiante: Number(idEstudiante) }, // por si llega string
                include: { estudiante_Carrera: { include: { carrera: true } } }
            });
            if (!estudiante) throw new HttpException("Estudiante no encontrado", 400);
            if (!estudiante.estudiante_Carrera?.length) throw new Error("Estudiante sin carrera");

            const idCarrera = estudiante.estudiante_Carrera[0].Id_Carrera;
            const areasRelacionadas = await this.prisma.carrera_Area.findMany({
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
                const casos = await this.prisma.casos_de_estudio.findMany({
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
                    const caso = await this.prisma.casos_de_estudio.findUnique({
                        where: { id_casoEstudio: casoSorteado }
                    });
                    casoNombre = caso?.Nombre_Archivo || null;
                }
            }

            // -------- DEFENSA --------------
            const defensaExistente = await this.prisma.defensa.findFirst({
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

            const defensa = await this.prisma.defensa.create({
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
    }

    async getAllDefensasDetalle({ page, pageSize, tipoDefensaNombre, user }: { page: number, pageSize: number, tipoDefensaNombre?: string, user: any }) {
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
                                include: { rol_Carrera: true }
                            }
                        }
                    }
                }
            });
            if (!usuario) throw new Error("Usuario no encontrado");

            const carrerasIds = usuario.Usuario_Rol
                .flatMap(ur => ur.Rol?.rol_Carrera || [])
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

            // 2. Buscar IDs de estudiantes de esas carreras
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
                    ...(tipoDefensaId && { id_tipo_defensa: tipoDefensaId })
                }
            });

            // 5. Traer defensas con filtro
            const defensas = await this.prisma.defensa.findMany({
                skip,
                take,
                where: {
                    id_estudiante: { in: estudianteIds },
                    ...(tipoDefensaId && { id_tipo_defensa: tipoDefensaId })
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





}
