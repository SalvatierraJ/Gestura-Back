import { Module } from '@nestjs/common';
import { DefensaService } from './defensa.service';
import { PrismaService } from 'src/database/prisma.services';
import { NotificacionModule } from 'src/notificacion/notificacion.module';

@Module({
  imports: [NotificacionModule],
  providers: [DefensaService, PrismaService],
  exports: [DefensaService] 
})
export class DefensaModule {}
