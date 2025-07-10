import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class ModulosService {


    constructor(private prisma: PrismaService) { }


    async getAllModulos() {
        try {
            const modulos = await this.prisma.modulos.findMany({
                select: {
                    Id_Modulo: true,
                    Nombre: true
                }
            });
            return modulos;
        } catch (error) {
            throw new Error(`Error fetching facultades: ${error.message}`);
        }
    }
}
