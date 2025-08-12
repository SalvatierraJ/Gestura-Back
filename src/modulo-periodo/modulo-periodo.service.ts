import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

type FiltroOpcional = {
    modalidad?: string;
    modulo?: string;
};

@Injectable()
export class ModuloPeriodoService {
    constructor(private prisma: PrismaService) { }

    getGestionActual(d = new Date()): string {
        const year = d.getFullYear();
        const month = d.getMonth();
        const sem = month <= 5 ? 1 : 2;
        return `${year}-${sem}`;
    }

    async obtenerPeriodosGestionActual(filtro: FiltroOpcional = {}) {
        const gestion = this.getGestionActual();

        return this.prisma.modulo_periodo.findMany({
            where: {
                gestion,
                ...(filtro.modalidad ? { modalidad: filtro.modalidad } : {}),
                ...(filtro.modulo ? { modulo: filtro.modulo } : {}),
            },
            orderBy: { fecha_Inicio: 'asc' },
            select: {
                id_modulo_Periodo: true,
                gestion: true,
                modulo: true,
                modalidad: true,
                fecha_Inicio: true,
                fecha_Fin: true,
                created_at_: false,
                updated_at: false,
            },
        });
    }
}
