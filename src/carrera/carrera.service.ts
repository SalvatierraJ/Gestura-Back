import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { Prisma } from '@prisma/client';

@Injectable()
export class CarreraService {
    constructor(private prisma: PrismaService) { }

    private normalizeName(s: string) {
        return (s ?? '').trim();
    }

    async createCarrera(body: any, userId: any) {
        const nombre = this.normalizeName(body.nombre_carrera);
        const id_facultad: bigint | null =
            body.id_facultad != null ? BigInt(body.id_facultad) : null;

        return this.prisma.$transaction(async (tx) => {
            const activa = await tx.carrera.findFirst({
                where: {
                    delete_status: { not: true },
                    delete_at: null,
                    id_facultad: id_facultad,
                    nombre_carrera: { equals: nombre, mode: 'insensitive' },
                },
            });
            if (activa) {
                return this.mapCarrera(activa);
            }


            const borrada = await tx.carrera.findFirst({
                where: {
                    OR: [{ delete_status: true }, { delete_at: { not: null } }],
                    id_facultad: id_facultad,
                    nombre_carrera: { equals: nombre, mode: 'insensitive' },
                },
            });
            if (borrada) {
                const restored = await tx.carrera.update({
                    where: { id_carrera: borrada.id_carrera },
                    data: {
                        nombre_carrera: nombre,
                        id_facultad: id_facultad,
                        delete_status: false,
                        delete_at: null,
                        estado: true,
                        updated_at: new Date(),
                    },
                });
                return this.mapCarrera(restored);
            }

            try {
                const created = await tx.carrera.create({
                    data: {
                        nombre_carrera: nombre,
                        id_facultad: id_facultad,
                        estado: true,
                        delete_status: false,
                        delete_at: null,
                        created_at: new Date(),
                        updated_at: new Date(),
                        usuario_Carrera: {
                            create: {
                                Id_usuario: Number(userId),
                            },
                        }
                    },
                });
                return this.mapCarrera(created);
            } catch (e: any) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    throw new Error('Ya existe una carrera activa con ese nombre en la misma facultad');
                }
                throw e;
            }
        });
    }

    async getCarrerasFiltred({ page = 1, pageSize = 100, user, word = '' }) {
        const skip = (Number(page) - 1) * Number(pageSize);
        const take = Number(pageSize);

        const usuario = await this.prisma.usuario.findUnique({
            where: { Id_Usuario: user },
            include: { usuario_Carrera: true },
        });
        if (!usuario) throw new Error('No se encontro ningun usuuario');

        const carrerasIds = usuario.usuario_Carrera
            .map((rc) => rc.Id_carrera)
            .filter((id): id is bigint => id != null);

        if (carrerasIds.length === 0) {
            return { items: [], total: 0, page: Number(page), pageSize: Number(pageSize), totalPages: 0 };
        }

        const whereBase = {
            id_carrera: { in: carrerasIds },
            delete_status: { not: true },
            delete_at: null,
            ...(word ? { nombre_carrera: { contains: word, mode: 'insensitive' as const } } : {}),
        };

        const total = await this.prisma.carrera.count({ where: whereBase });
        const carreras = await this.prisma.carrera.findMany({
            where: whereBase,
            skip,
            take,
            include: { facultad: true },
        });

        const items = carreras.map((c) => {
            const { created_at, updated_at, id_facultad, facultad, ...result } = c;
            return { ...result, facu: facultad ? facultad.nombre_facultad : null };
        });
        console.log('Carreras filtradas:', items);
        return {
            items,
            total,
            page: Number(page),
            pageSize: Number(pageSize),
            totalPages: Math.ceil(total / pageSize),
        };
    }


    async getAllCarreras({ page = 1, pageSize = 10, user, includeDeleted = false }) {
        const pageN = Number(page), sizeN = Number(pageSize);
        const skip = (pageN - 1) * sizeN, take = sizeN;

        const userId = typeof user === 'bigint' ? user : BigInt(String(user));
        const usuario = await this.prisma.usuario.findUnique({
            where: { Id_Usuario: userId },
            include: { usuario_Carrera: true },
        });
        if (!usuario) throw new Error('Usuario no encontrado');

        const carrerasIds = Array.from(new Set(
            (usuario.usuario_Carrera || [])
                .map((rc: any) => rc?.Id_Carrera ?? rc?.Id_carrera ?? rc?.id_carrera)
                .filter((id: any): id is bigint => id != null)
        ));

        if (carrerasIds.length === 0) {
            return { items: [], total: 0, page: pageN, pageSize: sizeN, totalPages: 0 };
        }

        const base = { id_carrera: { in: carrerasIds } };
        const whereBase = includeDeleted
            ? base
            : { ...base, delete_at: null, NOT: { delete_status: true } };

        const [total, carreras] = await this.prisma.$transaction([
            this.prisma.carrera.count({ where: whereBase }),
            this.prisma.carrera.findMany({
                where: whereBase,
                skip, take,
                orderBy: { id_carrera: 'asc' },
                include: { facultad: true },
            }),
        ]);

        const items = carreras.map((c) => {
            const { created_at, updated_at, id_facultad, facultad, ...rest } = c;
            return { ...rest, facu: facultad ? facultad.nombre_facultad : null };
        });

        return {
            items,
            total,
            page: pageN,
            pageSize: sizeN,
            totalPages: Math.ceil(total / sizeN),
        };
    }



    async getCarreraById(id: bigint) {
        const carrera = await this.prisma.carrera.findFirst({
            where: { id_carrera: id, delete_status: { not: true }, delete_at: null },
            include: { facultad: true },
        });
        if (!carrera) throw new Error(`Carrera with ID ${id} not found`);
        const { created_at, updated_at, id_facultad, facultad, ...result } = carrera;
        return { ...result, facu: facultad ? facultad.nombre_facultad : null };
    }


    async updateCarrera(id: bigint, body: any) {
        const nombre = this.normalizeName(body.nombre_carrera);
        const id_facultad: bigint | null =
            body.id_facultad != null ? BigInt(body.id_facultad) : null;

        const dup = await this.prisma.carrera.findFirst({
            where: {
                id_carrera: { not: id },
                delete_status: { not: true },
                delete_at: null,
                id_facultad: id_facultad,
                nombre_carrera: { equals: nombre, mode: 'insensitive' },
            },
            select: { id_carrera: true },
        });
        if (dup) throw new Error('Ya existe una carrera activa con ese nombre en la misma facultad');

        const updated = await this.prisma.carrera.update({
            where: { id_carrera: id },
            data: {
                nombre_carrera: nombre,
                id_facultad: id_facultad,
                updated_at: new Date(),
            },
        });
        const { created_at, updated_at, id_facultad: _f, ...result } = updated;
        return result;
    }

    async updateStateCarrera(id: bigint, body: any) {
        if (body.delete === true) {
            const updated = await this.prisma.carrera.update({
                where: { id_carrera: id },
                data: {
                    delete_status: true,
                    delete_at: new Date(),
                    estado: false,
                    updated_at: new Date(),
                },
            });
            const { created_at, updated_at, id_facultad, ...result } = updated;
            return result;
        }

        if (body.delete === false) {
            const c = await this.prisma.carrera.findUnique({ where: { id_carrera: id } });
            if (!c) throw new Error('Carrera no encontrada');

            const dup = await this.prisma.carrera.findFirst({
                where: {
                    id_carrera: { not: id },
                    delete_status: { not: true },
                    delete_at: null,
                    id_facultad: c.id_facultad,
                    nombre_carrera: { equals: c.nombre_carrera, mode: 'insensitive' },
                },
                select: { id_carrera: true },
            });
            if (dup) {
                throw new Error('No se puede restaurar: ya existe una carrera activa con ese nombre en la misma facultad');
            }

            const restored = await this.prisma.carrera.update({
                where: { id_carrera: id },
                data: {
                    delete_status: false,
                    delete_at: null,
                    estado: true,
                    updated_at: new Date(),
                },
            });
            const { created_at, updated_at, id_facultad, ...result } = restored;
            return result;
        }

        if (typeof body.estado === 'boolean') {
            const updated = await this.prisma.carrera.update({
                where: { id_carrera: id },
                data: { estado: body.estado, updated_at: new Date() },
            });
            const { created_at, updated_at, id_facultad, ...result } = updated;
            return result;
        }

        throw new Error('Petición inválida para updateStateCarrera');
    }

    private mapCarrera(carrera: any) {
        const { created_at, updated_at, id_facultad, ...result } = carrera;
        return result;
    }
}
