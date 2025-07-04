import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class FacultadService {
    constructor(private prisma:PrismaService){}

    async getAllFacultades() {
        try {
            const facultades = await this.prisma.facultad.findMany({
             select: {
                id_facultad: true,
                nombre_facultad: true,
             }
            });
            return facultades;
        } catch (error) {
            throw new Error(`Error fetching facultades: ${error.message}`);
        }
    }
}
