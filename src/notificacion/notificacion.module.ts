import { Module } from '@nestjs/common';
import { NotificacionService } from './notificacion.service';
import { WhatsAppAdminController } from './whatsapp-admin.controller';
import { PrismaService } from '../database/prisma.services';
import { BullModule } from '@nestjs/bull';

@Module({
  imports : [
    BullModule.registerQueue( {name :'whatsappQueue', }),
  ],
  providers: [NotificacionService, PrismaService],
  controllers: [WhatsAppAdminController],
  exports: [NotificacionService] // Para que otros módulos puedan usarlo
})
export class NotificacionModule {}
