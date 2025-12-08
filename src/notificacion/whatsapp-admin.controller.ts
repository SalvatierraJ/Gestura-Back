import { Controller, Get, Delete, Param, UseGuards, Post } from '@nestjs/common';
import { NotificacionService, WhatsAppSessionState } from './notificacion.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('whatsapp-admin')
@Controller('whatsapp-admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class WhatsAppAdminController {
    constructor(private notificacionService: NotificacionService) {}

    @Get('status')
    @ApiOperation({ 
        summary: 'Obtener estado de WhatsApp', 
        description: 'Obtiene el estado actual de la conexión de WhatsApp. Estados posibles: disconnected, connecting, qr_pending, authenticated, ready, error.' 
    })
    @ApiResponse({ status: 200, description: 'Estado de WhatsApp obtenido exitosamente', 
        example: { state: 'ready', isReady: true, message: 'WhatsApp listo para enviar mensajes', timestamp: '2024-01-15T10:00:00.000Z' }
    })
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
    @ApiOperation({ 
        summary: 'Obtener código QR de WhatsApp', 
        description: 'Obtiene el código QR actual para conectar WhatsApp. La imagen viene en formato base64. Solo disponible cuando el estado es qr_pending.' 
    })
    @ApiResponse({ status: 200, description: 'Código QR obtenido exitosamente', 
        example: { success: true, qrImage: 'data:image/png;base64,iVBORw0KGgo...', qrCode: '1@abc123...', message: 'Código QR disponible - escanea con tu teléfono' }
    })
    @ApiResponse({ status: 200, description: 'WhatsApp ya está conectado', 
        example: { success: false, message: 'WhatsApp ya está conectado - no se necesita QR' }
    })
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
    @ApiOperation({ 
        summary: 'Inicializar WhatsApp', 
        description: 'Inicia el proceso de conexión de WhatsApp. Si no hay sesión guardada, generará un código QR que se puede obtener con el endpoint /qr.' 
    })
    @ApiResponse({ status: 200, description: 'Inicialización iniciada exitosamente', 
        example: { success: true, message: 'Inicialización de WhatsApp iniciada' }
    })
    @ApiResponse({ status: 200, description: 'Error al inicializar', 
        example: { success: false, message: 'Error al inicializar: ...' }
    })
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
    @ApiOperation({ 
        summary: 'Reiniciar WhatsApp', 
        description: 'Fuerza el reinicio de la conexión de WhatsApp. Útil cuando hay problemas de conexión o se necesita reconectar.' 
    })
    @ApiResponse({ status: 200, description: 'WhatsApp reiniciado exitosamente', 
        example: { success: true, message: 'WhatsApp reiniciado exitosamente' }
    })
    @ApiResponse({ status: 200, description: 'Error al reiniciar', 
        example: { success: false, message: 'Error al reiniciar: ...' }
    })
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
    @ApiOperation({ 
        summary: 'Listar todas las sesiones de WhatsApp', 
        description: 'Obtiene la lista de todas las sesiones de WhatsApp guardadas en el sistema' 
    })
    @ApiResponse({ status: 200, description: 'Lista de sesiones obtenida exitosamente' })
    async getAllSessions() {
        return await this.notificacionService.getAllSessions();
    }

    @Delete('sessions/expired')
    @ApiOperation({ 
        summary: 'Limpiar sesiones expiradas', 
        description: 'Elimina todas las sesiones de WhatsApp que han expirado' 
    })
    @ApiResponse({ status: 200, description: 'Sesiones expiradas eliminadas exitosamente' })
    async cleanExpiredSessions() {
        await this.notificacionService.cleanExpiredSessions();
        return { message: 'Sesiones expiradas eliminadas exitosamente' };
    }

    @Delete('sessions/:sessionId')
    @ApiOperation({ 
        summary: 'Eliminar sesión específica', 
        description: 'Elimina una sesión de WhatsApp específica por su ID' 
    })
    @ApiParam({ name: 'sessionId', description: 'ID de la sesión a eliminar', type: String, example: 'whatsapp-main' })
    @ApiResponse({ status: 200, description: 'Sesión eliminada exitosamente' })
    @ApiResponse({ status: 200, description: 'Error al eliminar sesión' })
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
