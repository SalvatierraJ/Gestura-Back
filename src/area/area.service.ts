import { usuario_Carrera } from './../../node_modules/.prisma/client/index.d';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class AreaService {

    constructor(private prisma: PrismaService) { }

    async createArea(body: any) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const newArea = await tx.area.create({
                    data: {
                        nombre_area: body.nombre_area,
                        estado: true,
                        created_at: new Date(),
                        updated_at: new Date(),
                    }
                });
                
                if (Array.isArray(body.carreraIds) && body.carreraIds.length > 0) {
                    const carreraAreaData = body.carreraIds.map((carreraId: number) => ({
                        Id_Area: newArea.id_area,
                        Id_Carrera: carreraId,
                    }));

                    await tx.carrera_Area.createMany({
                        data: carreraAreaData,
                    });
                }
                
                const { created_at, updated_at, ...result } = newArea;
                return result;
            });
        } catch (error) {
            throw new Error(`Error creating area: ${error.message}`);
        }
    }
    async getAllAreas({ page, pageSize, user }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);

            // 1. Traer los roles y carreras administradas por el usuario
            const usuario = await this.prisma.usuario.findUnique({
                where: { Id_Usuario: user },
                include: {
                    usuario_Carrera:true
                }
            });

            if (!usuario) throw new Error("Usuario no encontrado");

            // 2. Extraer los IDs de carreras que administra
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

            // 3. Buscar las áreas que correspondan a esas carreras (por la tabla carrera_Area)
            // Primero, buscar los IDs de area relacionados
            const areaCarreraLinks = await this.prisma.carrera_Area.findMany({
                where: { Id_Carrera: { in: carrerasIds } },
                select: { Id_Area: true }
            });

            const areaIds = [
                ...new Set(
                    areaCarreraLinks
                        .map(link => link.Id_Area)
                        .filter((id): id is bigint => id !== null && id !== undefined)
                )
            ];

            const total = await this.prisma.area.count({
                where: { id_area: { in: areaIds } }
            });

            const areas = await this.prisma.area.findMany({
                where: { id_area: { in: areaIds } },
                skip,
                take,
                include: {
                    carrera_Area: { include: { carrera: true } }
                }
            });

            const items = areas.map(area => {
                const { created_at, updated_at, carrera_Area, ...result } = area;
                const carreras = carrera_Area
                    .filter(ca => ca.carrera !== null)
                    .map(ca => ca.carrera!.nombre_carrera);
                return { ...result, carreras };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching areas: ${error.message}`);
        }
    }


    async updateArea(id: bigint, body: any) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const updatedArea = await tx.area.update({
                    where: { id_area: id },
                    data: {
                        nombre_area: body.nombre_area,
                        updated_at: new Date(),
                    }
                });

                if (Array.isArray(body.carreraIds) && body.carreraIds.length > 0) {
                    await tx.carrera_Area.deleteMany({
                        where: { Id_Area: id },
                    });

                    const carreraAreaData = body.carreraIds.map((carreraId: number) => ({
                        Id_Area: updatedArea.id_area,
                        Id_Carrera: carreraId,
                    }));

                    await tx.carrera_Area.createMany({
                        data: carreraAreaData,
                    });
                }

                const { created_at, updated_at, ...result } = updatedArea;
                return result;
            });
        } catch (error) {
            throw new Error(`Error updating area: ${error.message}`);
        }
    }
    async updateStateArea(id: bigint, body: any) {
        try {
            const updatedArea = await this.prisma.area.update({
                where: { id_area: id },
                data: {
                    estado: body.estado,
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, ...result } = updatedArea;
            return result;
        } catch (error) {
            throw new Error(`Error updating area state: ${error.message}`);
        }
    }

}
