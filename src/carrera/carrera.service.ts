import { Injectable, Body } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class CarreraService {
    constructor(private prisma: PrismaService) { }

    async createCarrera(body: any) {
        try {
            const newCarrera = await this.prisma.carrera.create({
                data: {
                    nombre_carrera: body.nombre_carrera,
                    id_facultad: body.id_facultad,
                    estado: true,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, id_facultad, ...result } = newCarrera;
            return result;
        } catch (error) {
            throw new Error(`Error creating carrera: ${error.message}`);
        }
    }

    async getAllCarreras({ page, pageSize, user }) {
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

            // Si no administra ninguna carrera, devuelve vacío
            if (carrerasIds.length === 0) {
                return {
                    items: [],
                    total: 0,
                    page: Number(page),
                    pageSize: Number(pageSize),
                    totalPages: 0
                };
            }

            // 3. Filtrar carreras por esos IDs (con paginación)
            const total = await this.prisma.carrera.count({
                where: { id_carrera: { in: carrerasIds } }
            });

            const carreras = await this.prisma.carrera.findMany({
                where: { id_carrera: { in: carrerasIds } },
                skip,
                take,
                include: { facultad: true }
            });

            const items = carreras.map(carrera => {
                const { created_at, updated_at, id_facultad, facultad, ...result } = carrera;
                const facu = facultad ? facultad.nombre_facultad : null;
                return { ...result, facu };
            });

            return {
                items,
                total,
                page: Number(page),
                pageSize: Number(pageSize),
                totalPages: Math.ceil(total / pageSize)
            };
        } catch (error) {
            throw new Error(`Error fetching carreras: ${error.message}`);
        }
    }


    async getCarreraById(id: bigint) {
        return this.prisma.carrera.findUnique({
            where: { id_carrera: id },
            include: { facultad: true }
        }).then(carrera => {
            if (!carrera) throw new Error(`Carrera with ID ${id} not found`);
            const { created_at, updated_at, id_facultad, facultad, ...result } = carrera;
            const facu = facultad ? facultad.nombre_facultad : null;
            return { ...result, facu };
        });
    }
    async updateCarrera(id: bigint, body: any) {
        try {
            const updatedCarrera = await this.prisma.carrera.update({
                where: { id_carrera: id },
                data: {
                    nombre_carrera: body.nombre_carrera,
                    id_facultad: body.id_facultad,
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, id_facultad, ...result } = updatedCarrera;
            return result;
        } catch (error) {
            throw new Error(`Error updating carrera: ${error.message}`);
        }
    }

    async updateStateCarrera(id: bigint, body: any) {
        try {
            const updatedCarrera = await this.prisma.carrera.update({
                where: { id_carrera: id },
                data: {
                    estado: body.estado,
                    updated_at: new Date(),
                }
            });
            const { created_at, updated_at, id_facultad, ...result } = updatedCarrera;
            return result;
        } catch (error) {
            throw new Error(`Error updating carrera state: ${error.message}`);
        }
    }

}
