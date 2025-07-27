import { Controller, Get, Delete, Param, UseGuards, Post } from '@nestjs/common';
import { NotificacionService, WhatsAppSessionState } from './notificacion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('whatsapp-admin')
@UseGuards(JwtAuthGuard)
export class WhatsAppAdminController {
    constructor(private notificacionService: NotificacionService) {}

    @Get('status')
    async getWhatsAppStatus() {
        const state = this.notificacionService.getSessionState();
        const isReady = this.notificacionService.isReady();
        
        return {
            state,
            isReady,
            message: this.getStatusMessage(state),
            timestamp: new Date().toISOString()
        };
    }   

    @Get('qr')
    async getQRCode() {
        const state = this.notificacionService.getSessionState();
        const qrImage = this.notificacionService.getCurrentQRImage();
        const qrCode = this.notificacionService.getCurrentQRCode();

        // Si hay QR disponible, devolverlo independientemente del estado
        if (qrImage) {
            return {
                success: true,
                qrImage, // Base64 de la imagen
                qrCode,  // String del QR (opcional)
                state,   // Estado actual para referencia
                message: 'Código QR disponible - escanea con tu teléfono'
            };
        } else if (state === WhatsAppSessionState.READY) {
            return {
                success: false,
                state,
                message: 'WhatsApp ya est   á conectado - no se necesita QR'
            };
        } else if (state === WhatsAppSessionState.CONNECTING) {
            return {
                success: false,
                state,
                message: 'Conectando... espera un momento para obtener el QR'
            };
        } else if (state === WhatsAppSessionState.QR_PENDING) {
            return {
                success: false,
                state,
                message: 'Generando QR... intenta de nuevo en unos segundos'
            };
        } else {
            return {
                success: false,
                state,
                message: 'QR no disponible - inicia el servicio primero'
            };
        }
    }

    @Post('initialize')
    async initializeWhatsApp() {
        try {
            await this.notificacionService.initialize();
            return {
                success: true,
                message: 'Inicialización de WhatsApp iniciada'
            };
        } catch (error) {
            return {
                success: false,
                message: `Error al inicializar: ${error.message}`
            };
        }
    }

    @Post('restart')
    async restartWhatsApp() {
        try {
            await this.notificacionService.forceRestart();
            return {
                success: true,
                message: 'WhatsApp reiniciado exitosamente'
            };
        } catch (error) {
            return {
                success: false,
                message: `Error al reiniciar: ${error.message}`
            };
        }
    }

    @Get('sessions')
    async getAllSessions() {
        return await this.notificacionService.getAllSessions();
    }

    @Delete('sessions/expired')
    async cleanExpiredSessions() {
        await this.notificacionService.cleanExpiredSessions();
        return { message: 'Sesiones expiradas eliminadas exitosamente' };
    }

    @Delete('sessions/:sessionId')
    async deleteSession(@Param('sessionId') sessionId: string) {
        const success = await this.notificacionService.deleteSessionById(sessionId);
        if (success) {
            return { message: `Sesión ${sessionId} eliminada exitosamente` };
        } else {
            return { message: `Error al eliminar la sesión ${sessionId}` };
        }
    }

    private getStatusMessage(state: WhatsAppSessionState): string {
        switch (state) {
            case WhatsAppSessionState.DISCONNECTED:
                return 'WhatsApp desconectado - requiere inicialización';
            case WhatsAppSessionState.CONNECTING:
                return 'Conectando a WhatsApp...';
            case WhatsAppSessionState.QR_PENDING:
                return 'Esperando escaneo del código QR';
            case WhatsAppSessionState.AUTHENTICATED:
                return 'Autenticado - estableciendo conexión';
            case WhatsAppSessionState.READY:
                return 'WhatsApp listo para enviar mensajes';
            case WhatsAppSessionState.ERROR:
                return 'Error en la conexión - requiere reinicio';
            default:
                return 'Estado desconocido';
        }
    }
}
