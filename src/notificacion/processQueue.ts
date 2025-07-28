import {Processor, Process} from '@nestjs/bull';
import {Job} from 'bull';
import {NotificacionService} from './notificacion.service';
import { Logger } from '@nestjs/common';

@Processor('whatsappQueue')
export class WhatsAppProcessor{
    private readonly logger = new Logger(WhatsAppProcessor.name);
    constructor(private notificacionService:NotificacionService) {}
    @Process('retry-whatsapp')
    async handleRetryWhatsApp(job: Job<{ number: string; text: string }>) { 
        const { number, text } = job.data;
        this.logger.log(`🔁 Reintentando envío de WhatsApp a ${number}`);
        const success = await this.notificacionService.sendMessage(number, text);
        if (!success) {
            throw new Error(`No se pudo reenviar mensaje a ${number}`);
          }
    }
}
