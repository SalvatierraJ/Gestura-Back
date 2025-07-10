import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class PermisosService {
    constructor(private prisma: PrismaService) { }


    async getAllPermisos() {
        try {
            const permisos = await this.prisma.permisos.findMany({
                select: {
                    Id_Permiso: true,
                    Nombre: true,
                    Descripcion: true
                }
            });
            return permisos;
        } catch (error) {
            throw new Error(`Error fetching facultades: ${error.message}`);
        }
    }

}
