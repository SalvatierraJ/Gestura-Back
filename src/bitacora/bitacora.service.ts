import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';

@Injectable()
export class BitacoraService {
  constructor(private prisma: PrismaService) {}

  /**
   * Registra un evento en la tabla Bitacora.
   * @param data Los datos del evento a registrar.
   */
  async log(data: {
    Tabla_Afectada: string;
    id_registros_afectados: bigint;
    operacion: string;
    Usuario_Responsable: bigint;
    detalles: object;
  }): Promise<void> {
    try {
      await this.prisma.bitacora.create({
        data: {
          Tabla_Afectada: data.Tabla_Afectada,
          id_registros_afectados: data.id_registros_afectados,
          operacion: data.operacion,
          Usuario_Responsable: data.Usuario_Responsable,
          detalles: data.detalles,
          fecha_Hora: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    } catch (error) {
      console.error('Error al registrar en la bitácora:', error);
    }
  }
}