import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class JuradosService {
    constructor(private prisma: PrismaService) { }


    async asignarJurados({
        defensasIds,
        auto = true,
        juradoIds = [],
    }: {
        defensasIds: number[];
        auto?: boolean;
        juradoIds?: number[];
    }) {
        if (!Array.isArray(defensasIds) || defensasIds.length === 0) throw new HttpException("Debe enviar al menos una defensa", 400);

        const defensas = await this.prisma.defensa.findMany({
            where: { id_defensa: { in: defensasIds } },
            include: { area: true },
        });
        if (defensas.length !== defensasIds.length) throw new HttpException("Algunas defensas no existen", 400);

        const resultados: any[] = [];
        for (const defensa of defensas) {
            if (!defensa.id_area) throw new HttpException(`La defensa ${defensa.id_defensa} no tiene área asignada`, 400);

            const juradosElegibles = await this.prisma.tribunal_Docente.findMany({
                where: {
                    estado: true,
                    area_Tribunal: { some: { id_area: defensa.id_area } }
                },
                include: { area_Tribunal: true }
            });

            if (juradosElegibles.length < 2)
                throw new HttpException(`No hay suficientes jurados activos para el área de la defensa ${defensa.id_defensa}`, 400);

            let juradosAAsignar: number[] = [];
            if (auto) {
                const asignaciones = await this.prisma.tribunal_defensa.groupBy({
                    by: ['id_tribunal'],
                    where: { id_tribunal: { in: juradosElegibles.map(j => j.id_tribunal) } },
                    _count: { id_tribunalDefensa: true }
                });
                const juradosOrdenados = [...juradosElegibles].sort((a, b) => {
                    const asignA = asignaciones.find(x => x.id_tribunal === a.id_tribunal)?._count.id_tribunalDefensa || 0;
                    const asignB = asignaciones.find(x => x.id_tribunal === b.id_tribunal)?._count.id_tribunalDefensa || 0;
                    return asignA - asignB;
                });
                juradosAAsignar = juradosOrdenados.slice(0, 2).map(j => Number(j.id_tribunal));
            } else {
                if (!juradoIds || juradoIds.length < 2) throw new HttpException("Debe seleccionar al menos 2 jurados", 400);
                const validos = juradosElegibles.map(j => j.id_tribunal);
                juradosAAsignar = juradoIds
                    .map(id => BigInt(id))
                    .filter(id => validos.includes(id))
                    .map(id => Number(id));
                if (juradosAAsignar.length < 2)
                    throw new HttpException("No todos los jurados seleccionados son válidos para el área", 400);
            }

            const asignaciones = await Promise.all(
                juradosAAsignar.map(id_tribunal =>
                    this.prisma.tribunal_defensa.create({
                        data: {
                            id_tribunal,
                            id_defensa: defensa.id_defensa,
                            fecha_Asignacion: Date.now(),
                            created_at: new Date(),
                            updated_at: new Date()
                        }
                    })
                )
            );

            resultados.push({
                defensa: defensa.id_defensa,
                area: defensa.area?.nombre_area,
                jurados: asignaciones
            });
        }

        return resultados;
    }

    async actualizarJurados({
        defensaId,
        juradoIds,
    }: {
        defensaId: number | string;
        juradoIds: (number | string)[];
    }) {
        // Validaciones iniciales
        if (!defensaId || !juradoIds) {
            throw new HttpException("Se requieren defensaId y juradoIds", HttpStatus.BAD_REQUEST);
        }
        // Eliminar duplicados
        const juradoIdsUnicos = Array.from(new Set(juradoIds));

        if (!Array.isArray(juradoIdsUnicos) || juradoIdsUnicos.length < 2) {
            throw new HttpException("Debe seleccionar al menos 2 jurados distintos", HttpStatus.BAD_REQUEST);
        }

        // CONVIERTE defensaId a BigInt
        let id = defensaId;
        if (Array.isArray(id)) {
            id = id[0];
        }
        const defensa = await this.prisma.defensa.findUnique({
            where: { id_defensa: BigInt(id) },
        });

        if (!defensa) throw new HttpException(`La defensa con ID ${defensaId} no existe`, HttpStatus.NOT_FOUND);
        if (!defensa.id_area) throw new HttpException(`La defensa ${defensa.id_defensa} no tiene área asignada`, HttpStatus.BAD_REQUEST);

        const juradosElegibles = await this.prisma.tribunal_Docente.findMany({
            where: {
                estado: true,
                area_Tribunal: { some: { id_area: defensa.id_area } },
            },
            select: { id_tribunal: true }
        });

        const idsElegibles = juradosElegibles.map(j => j.id_tribunal);

        // CONVIERTE cada juradoId a BigInt para comparar
        const todosValidos = juradoIdsUnicos.every(id => idsElegibles.includes(BigInt(id)));

        if (!todosValidos) {
            throw new HttpException("Al menos un jurado seleccionado no es válido o no pertenece al área de la defensa", HttpStatus.BAD_REQUEST);
        }

        if (idsElegibles.length < 2) {
            throw new HttpException("No hay suficientes jurados elegibles para esta área", HttpStatus.BAD_REQUEST);
        }

        const transaccion = await this.prisma.$transaction([
            this.prisma.tribunal_defensa.deleteMany({
                where: { id_defensa: BigInt(defensaId) },
            }),
            ...juradoIdsUnicos.map(id_tribunal =>
                this.prisma.tribunal_defensa.create({
                    data: {
                        id_tribunal: BigInt(id_tribunal),
                        id_defensa: BigInt(defensaId),
                        fecha_Asignacion: Date.now(),
                    },
                })
            ),
        ]);

        const nuevasAsignaciones = transaccion.slice(1);

        return {
            mensaje: `Jurados para la defensa ${defensaId} actualizados correctamente.`,
            juradosAsignados: nuevasAsignaciones,
        };
    }

    async getJuradosConSugerencia() {
        const jurados = await this.prisma.tribunal_Docente.findMany({
            where: { estado: true },
            include: {
                Persona: true,
                area_Tribunal: {
                    include: { area: true }
                },
                tribunal_defensa: true
            }
        });

        return jurados.map(jurado => ({
            id: jurado.id_tribunal,
            nombre_completo: [
                jurado.Persona?.Nombre,
                jurado.Persona?.Apellido1,
                jurado.Persona?.Apellido2
            ].filter(Boolean).join(" "),
            areas: (jurado.area_Tribunal || [])
                .map(at => ({
                    id_area: at.area?.id_area,
                    nombre_area: at.area?.nombre_area
                }))
                .filter(a => a.id_area && a.nombre_area),
            cantidad_asignaciones: jurado.tribunal_defensa.length,
            sugerido: jurado.tribunal_defensa.length <= 2
        }));
    }



}
