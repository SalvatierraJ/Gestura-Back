import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class AreaService {

    constructor(private prisma: PrismaService) { }

    async createArea(body: any) {
        try {
            const newArea = await this.prisma.area.create({
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

                await this.prisma.carrera_Area.createMany({
                    data: carreraAreaData,
                });
            }
            const { created_at, updated_at, ...result } = newArea;
            return result;
        } catch (error) {
            throw new Error(`Error creating area: ${error.message}`);
        }
    }
    async getAllAreas({ page, pageSize }) {
        try {
            const skip = (Number(page) - 1) * Number(pageSize);
            const take = Number(pageSize);
            const total = await this.prisma.area.count();
            const areas = await this.prisma.area.findMany({
                skip,
                take,
                include: { carrera_Area: { include: { carrera: true } } }
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
            const updatedArea = await this.prisma.area.update({
                where: { id_area: id },
                data: {
                    nombre_area: body.nombre_area,
                    updated_at: new Date(),
                }
            });

            if (Array.isArray(body.carreraIds) && body.carreraIds.length > 0) {
                await this.prisma.carrera_Area.deleteMany({
                    where: { Id_Area: id },
                });

                const carreraAreaData = body.carreraIds.map((carreraId: number) => ({
                    Id_Area: updatedArea.id_area,
                    Id_Carrera: carreraId,
                }));

                await this.prisma.carrera_Area.createMany({
                    data: carreraAreaData,
                });
            }

            const { created_at, updated_at, ...result } = updatedArea;
            return result;
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
