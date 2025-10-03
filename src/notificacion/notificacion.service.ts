import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.services';
import { DatabaseAuthStrategy } from './database-auth-strategy';
import * as QRCode from 'qrcode';
import * as nodemailer from 'nodemailer';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Client, RemoteAuth } from 'whatsapp-web.js';

// Enum para esta   dos de sesión
export enum WhatsAppSessionState {
    DISCONNECTED = 'disconnected',
    CONNECTING = 'connecting',
    QR_PENDING = 'qr_pending',
    AUTHENTICATED = 'authenticated',
    READY = 'ready',
    ERROR = 'error'
}

@Injectable()
export class NotificacionService {
    private readonly logger = new Logger(NotificacionService.name);
    private client: any;
    private initialized = false;
    private ready = false;
    private initializationPromise: Promise<void> | null = null;
    private authStrategy: DatabaseAuthStrategy;
    private currentState: WhatsAppSessionState = WhatsAppSessionState.DISCONNECTED;
    private currentQRCode: string | null = null;
    private currentQRImage: string | null = null; // Base64 de la imagen QR
    private emailTransporter: nodemailer.Transporter;
    private store: DatabaseAuthStrategy;


    constructor(private prisma: PrismaService, @InjectQueue('whatsappQueue') private whatsappQueue: Queue) {
        this.logger.log('Servicio de notificación de WhatsApp instanciado.');
        this.authStrategy = new DatabaseAuthStrategy(this.prisma, 'whatsapp-main');

        // Configurar el transporter de email
        this.emailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER || '',
                pass: process.env.GMAIL_APP_PASSWORD || ''
            }
        });
        this.store = new DatabaseAuthStrategy(this.prisma, 'whatsapp-main');
    }

    async initialize() {
        if (this.initialized && this.ready) return;

        // Si ya hay una inicialización en progreso, esperar a que termine
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Si está inicializado pero no listo, forzar reinicio
        if (this.initialized && !this.ready) {
            this.logger.log('Cliente inicializado pero no listo, forzando reinicio...');
            await this.forceRestart();
            return;
        }

        this.currentState = WhatsAppSessionState.CONNECTING;

        this.initializationPromise = new Promise<void>((resolve, reject) => {
            this.logger.log('Iniciando el bot de WhatsApp...');

            this.client = new Client({
                authStrategy: new RemoteAuth({
                    clientId: 'whatsapp-main',
                    dataPath: './.wwebjs_auth',
                    store: this.store,
                    backupSyncIntervalMs: 300000,
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-gpu',
                        '--no-first-run',
                        '--disable-extensions',
                        '--disable-plugins',
                        '--disable-images',
                        '--disable-sync',
                        '--disable-translate',
                        '--hide-scrollbars',
                        '--mute-audio',
                        '--no-default-browser-check',
                        '--disable-background-timer-throttling',
                        '--disable-backgrounding-occluded-windows',
                        '--disable-renderer-backgrounding',
                        '--disable-background-networking',
                        '--disable-client-side-phishing-detection',
                        '--disable-component-extensions-with-background-pages',
                        '--disable-domain-reliability',
                        '--disable-features=TranslateUI',
                        '--disable-ipc-flooding-protection',
                        '--disable-hang-monitor',
                        '--disable-prompt-on-repost',
                        '--disable-sync-preferences',
                        '--disable-web-resources',
                        '--disable-logging',
                        '--disable-permissions-api',
                        '--disable-presentation-api',
                        '--disable-print-preview',
                        '--disable-speech-api',
                        '--disable-file-system',
                        '--disable-notifications',
                        '--disable-geolocation',
                        '--disable-media-session-api',
                        '--disable-device-discovery-notifications',
                        '--disable-background-downloads',
                        '--disable-add-to-shelf',
                        '--memory-pressure-off',
                        '--max_old_space_size=2048'
                    ],
                    timeout: 120000
                }
            });

            this.client.on('qr', async (qr) => {
                this.currentState = WhatsAppSessionState.QR_PENDING;
                this.currentQRCode = qr;

                this.logger.log('📱 Código QR generado - disponible para el frontend');

                // Generar imagen QR como base64
                try {
                    this.currentQRImage = await QRCode.toDataURL(qr, {
                        width: 256,
                        margin: 2,
                        color: {
                            dark: '#000000',
                            light: '#FFFFFF'
                        }
                    });
                    this.logger.log('✅ Imagen QR generada exitosamente');
                } catch (error) {
                    this.logger.error('❌ Error al generar imagen QR:', error);
                }
            });

            this.client.on('ready', () => {
                this.currentState = WhatsAppSessionState.READY;
                this.ready = true;
                setTimeout(() => {
                    this.currentQRCode = null;
                    this.currentQRImage = null;
                    this.logger.log('🧹 QR code limpiado después de conexión exitosa');
                }, 10000);
                this.logger.log('🎉 ¡El cliente está listo y conectado a WhatsApp!');
                resolve();
            });

            this.client.on('authenticated', async (session) => {
                this.currentState = WhatsAppSessionState.AUTHENTICATED;
                this.logger.log('🔐 Cliente autenticado exitosamente');

                // Guardar sesión en base de datos
                try {
                    await this.authStrategy.saveSession(session);
                    this.logger.log('💾 Sesión sincronizada con base de datos');
                } catch (error) {
                    this.logger.error('❌ Error al sincronizar sesión:', error);
                }

                // Timeout para forzar el estado ready si no se dispara automáticamente
                setTimeout(() => {
                    if (this.currentState === WhatsAppSessionState.AUTHENTICATED && !this.ready) {
                        this.logger.log('⏰ Timeout: Forzando estado ready después de autenticación');
                        this.currentState = WhatsAppSessionState.READY;
                        this.ready = true;
                        this.logger.log('🎉 ¡Cliente marcado como listo por timeout!');
                        resolve();
                    }
                }, 15000); // 15 segundos después de autenticación
            });

            this.client.on('auth_failure', (msg) => {
                this.currentState = WhatsAppSessionState.ERROR;
                this.logger.error('❌ Fallo en la autenticación:', msg);
                reject(new Error(`Fallo en la autenticación: ${msg}`));
            });

            this.client.on('disconnected', (reason) => {
                this.currentState = WhatsAppSessionState.DISCONNECTED;
                this.logger.warn('🔌 Cliente desconectado:', reason);
                this.ready = false;
                this.initialized = false;
                this.currentQRCode = null;
                this.currentQRImage = null;
            });

            // Eventos adicionales para mejor detección del estado
            this.client.on('loading_screen', (percent, message) => {
                this.logger.log(`📱 Cargando WhatsApp Web: ${percent}% - ${message}`);
            });

            this.client.on('change_state', (state) => {
                this.logger.log(`🔄 Cambio de estado interno: ${state}`);
                if (state === 'CONNECTED') {
                    this.logger.log('🔗 WhatsApp Web conectado, esperando ready...');
                }
            });

            this.client.on('remote_session_saved', () => {
                this.logger.log('💾 Sesión remota guardada');
            });

            this.client.on('message', (message) => {
                this.logger.log(`📨 Mensaje recibido de ${message.from}: "${message.body}"`);
                if (message.body.toLowerCase() === 'ping') {
                    message.reply('pong');
                    this.logger.log(`🏓 Respondiendo "pong" a ${message.from}`);
                }
            });

            this.client.initialize().then(() => {
                this.initialized = true;
            }).catch((error) => {
                this.currentState = WhatsAppSessionState.ERROR;
                this.logger.error('❌ Error al inicializar el cliente:', error);
                reject(error);
            });
        });

        return this.initializationPromise;
    }

    // Método para obtener el estado actual de la sesión
    getSessionState(): WhatsAppSessionState {
        return this.currentState;
    }

    // Método para obtener el código QR como string
    getCurrentQRCode(): string | null {
        return this.currentQRCode;
    }

    // Método para obtener la imagen QR como base64
    getCurrentQRImage(): string | null {
        this.logger.log(`🔍 Solicitando QR image - Estado: ${this.currentState}, QR disponible: ${!!this.currentQRImage}`);
        return this.currentQRImage;
    }

    // Método para verificar si está listo para enviar mensajes
    isReady(): boolean {
        return this.ready && this.currentState === WhatsAppSessionState.READY;
    }

    // Método para limpiar QR manualmente
    clearQRCode(): void {
        this.currentQRCode = null;
        this.currentQRImage = null;
        this.logger.log('🧹 QR code limpiado manualmente');
    }

    // Método para sincronizar sesión existente con base de datos
    async syncSessionWithDatabase() {
        try {
            if (this.client && this.ready) {
                const sessionData = await this.client.getState();
                await this.authStrategy.saveSession(sessionData);
                this.logger.log('🔄 Sesión existente sincronizada con base de datos');
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('❌ Error al sincronizar sesión existente:', error);
            return false;
        }
    }

    async forceRestart() {
        try {
            if (this.client) {
                await this.client.destroy();
            }
            this.initialized = false;
            this.ready = false;
            this.initializationPromise = null;
            this.currentState = WhatsAppSessionState.DISCONNECTED;
            this.currentQRCode = null;
            this.currentQRImage = null;

            this.logger.log('🔄 Reiniciando cliente de WhatsApp...');
            await this.initialize();
        } catch (error) {
            this.logger.error('❌ Error al reiniciar cliente:', error);
            throw error;
        }
    }

    async sendMessage(number: string, text: string) {
        try {
            // Verificar estado actual
            this.logger.log(`Estado actual: initialized=${this.initialized}, ready=${this.ready}, state=${this.currentState}`);
            
            // Si no está inicializado o no está listo, inicializar
            if (!this.initialized || !this.ready) {
                this.logger.log('Cliente no está listo, inicializando...');
                await this.initialize();
                
                // Esperar un poco más para que se estabilice
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Verificar que el cliente esté realmente listo después de la inicialización
            if (!this.ready || !this.client) {
                this.logger.error(`Cliente no disponible después de inicialización: ready=${this.ready}, client=${!!this.client}`);
                throw new Error('Cliente de WhatsApp no está disponible');
            }

            // Verificar conexión y reconectar si es necesario
            if (this.client && typeof this.client.getState === 'function') {
                const state = await this.client.getState();
                if (state !== 'CONNECTED') {
                    this.logger.warn(`Cliente no está conectado (estado: ${state}), reiniciando...`);
                    await this.forceRestart();
                    // Esperar un poco para que se estabilice tras reinicio
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            const chatId = `591${number}@c.us`;
            this.logger.log(`Enviando mensaje a ${number}...`);

            // Verificar que la conexión esté activa antes de enviar
            try {
                if (!this.client) {
                    throw new Error('Cliente de WhatsApp es null');
                }
                
                const state = await this.client.getState();
                this.logger.log(`Estado de WhatsApp Web: ${state}`);
                
                if (state !== 'CONNECTED') {
                    throw new Error(`WhatsApp Web no está conectado. Estado: ${state}`);
                }
                
                // Verificar que el cliente tenga acceso a las funciones internas
                try {
                    await this.client.getChats();
                    this.logger.log('✅ Cliente tiene acceso a getChats()');
                } catch (chatError) {
                    this.logger.error(`❌ Error al acceder a getChats(): ${chatError.message}`);
                    
                    // Si es el error de sesión corrupta, activar limpieza
                    if (chatError.message && chatError.message.includes('Cannot read properties of undefined')) {
                        this.logger.warn('🔄 Detectado error de sesión corrupta en getChats, activando limpieza...');
                        this.limpiarSesionCorrupta().catch(error => {
                            this.logger.error('Error al limpiar sesión corrupta:', error);
                        });
                    }
                    
                    throw new Error('Cliente no tiene acceso a funciones de WhatsApp');
                }
            } catch (error) {
                this.logger.error(`Error al verificar estado de WhatsApp: ${error.message}`);
                throw new Error('WhatsApp Web no está conectado');
            }

            // Añadir un pequeño delay para asegurar que el cliente esté completamente listo
            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.client.sendMessage(chatId, text);
            this.logger.log(`Mensaje enviado exitosamente a ${number}.`);
            return true;
        } catch (err) {
            this.logger.error(`Error al enviar el mensaje a ${number}, lo encolamos:`, err);
            
            // Si es el error específico de sesión corrupta, limpiar completamente
            if (err.message && err.message.includes('Cannot read properties of undefined')) {
                this.logger.warn('🔄 Detectado error de sesión corrupta, limpiando completamente...');
                
                // Limpiar sesión corrupta en background
                this.limpiarSesionCorrupta().then(() => {
                    this.logger.log('✅ Sesión corrupta limpiada, listo para próxima inicialización');
                }).catch(error => {
                    this.logger.error('Error al limpiar sesión corrupta:', error);
                });
            }
            
            await this.whatsappQueue.add('retry-whatsapp', { number, text }, {
                attempts: 9999,
                backoff: 60000,
                removeOnComplete: true,
                removeOnFail: false
            })
            return false;
        }
    }

    async cleanExpiredSessions() {
        try {
            this.logger.log('🧹 Limpiando sesiones expiradas de WhatsApp...');
            // @ts-ignore - Tabla agregada recientemente
            const result = await this.prisma.whatsAppSession.deleteMany({
                where: {
                    expires_at: {
                        lte: new Date()
                    }
                }
            });
            this.logger.log(`✅ ${result.count} sesiones expiradas eliminadas`);
        } catch (error) {
            this.logger.error('❌ Error al limpiar sesiones expiradas:', error);
        }
    }

    async getAllSessions() {
        try {
            // @ts-ignore - Tabla agregada recientemente
            const sessions = await this.prisma.whatsAppSession.findMany({
                select: {
                    id: true,
                    session_id: true,
                    created_at: true,
                    updated_at: true,
                    expires_at: true
                }
            });
            return sessions;
        } catch (error) {
            this.logger.error('❌ Error al obtener sesiones:', error);
            return [];
        }
    }

    async deleteSessionById(sessionId: string) {
        try {
            // @ts-ignore - Tabla agregada recientemente
            await this.prisma.whatsAppSession.delete({
                where: { session_id: sessionId }
            });
            this.logger.log(`✅ Sesión eliminada: ${sessionId}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Error al eliminar sesión ${sessionId}:`, error);
            return false;
        }
    }

    // Método para enviar emails
    async sendEmail(to: string, subject: string, text: string, html?: string) {
        try {
            this.logger.log(`📧 Enviando email a ${to}...`);

            const mailOptions = {
                from: process.env.GMAIL_USER || '',
                to: to,
                subject: subject,
                text: text,
                html: html || text
            };

            const result = await this.emailTransporter.sendMail(mailOptions);
            this.logger.log(`✅ Email enviado exitosamente a ${to}. Message ID: ${result.messageId}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Error al enviar email a ${to}:`, error);
            return false;
        }
    }

    // Método para enviar emails con plantilla personalizada
    async sendEmailWithTemplate(
        to: string,
        subject: string,
        templateData: {
            title: string;
            message: string;    // Puede ser HTML completo (Tabular) o solo contenido parcial
            buttonText?: string;
            buttonUrl?: string;
        }
    ) {
        try {
            // 1) Utilidad simple para crear un texto alterno (text/plain)
            const htmlToText = (html: string) => {
                return html
                    // quita estilos/scripts
                    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                    // saltos para <br> y <p>
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<\/p>/gi, '\n\n')
                    // elimina el resto de tags
                    .replace(/<[^>]+>/g, ' ')
                    // decodifica entidades comunes
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/&amp;/gi, '&')
                    .replace(/&quot;/gi, '"')
                    .replace(/&#39;/gi, "'")
                    .replace(/&lt;/gi, '<')
                    .replace(/&gt;/gi, '>')
                    // colapsa espacios
                    .replace(/\s+\n/g, '\n')
                    .replace(/\n\s+/g, '\n')
                    .replace(/[ \t]{2,}/g, ' ')
                    .trim();
            };

            // 2) Detectar si message es un HTML completo (Tabular)
            const isFullHtml = /<!DOCTYPE|<html[\s>]/i.test(templateData.message);

            let htmlTemplate: string;
            let textAlt: string;

            if (isFullHtml) {
                // Caso A: el message YA es un HTML completo (tu plantilla Tabular)
                htmlTemplate = templateData.message;
                // texto alterno básico con título+botón (si viene)
                const extras =
                    templateData.buttonText && templateData.buttonUrl
                        ? `\n\n${templateData.buttonText}: ${templateData.buttonUrl}`
                        : '';
                textAlt = `${templateData.title}\n\n${htmlToText(templateData.message)}${extras}`;
            } else {
                // Caso B: message es un fragmento. Usar wrapper existente (sin meterlo en <p>)
                htmlTemplate = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${templateData.title}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #007bffff; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f8f9fa; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${templateData.title}</h1>
          </div>
          <div class="content">
            <div>${templateData.message}</div>
            ${templateData.buttonText && templateData.buttonUrl
                        ? `<a href="${templateData.buttonUrl}" class="button">${templateData.buttonText}</a>`
                        : ''
                    }
          </div>
          <div class="footer">
            <p>Este es un email automático del sistema Gestura.</p>
          </div>
        </body>
        </html>
      `.trim();

                const extras =
                    templateData.buttonText && templateData.buttonUrl
                        ? `\n\n${templateData.buttonText}: ${templateData.buttonUrl}`
                        : '';
                textAlt = `${templateData.title}\n\n${htmlToText(templateData.message)}${extras}`;
            }

            // 3) Enviar (textAlt como texto plano, htmlTemplate como HTML)
            return await this.sendEmail(to, subject, textAlt, htmlTemplate);
        } catch (error) {
            this.logger.error(`❌ Error al enviar email con plantilla a ${to}:`, error);
            return false;
        }
    }

    /**
     * Obtiene el estado actual del servicio de WhatsApp
     * @returns Estado del servicio
     */
    public getEstado() {
        return {
            inicializado: this.initialized,
            listo: this.ready,
            estadoActual: this.currentState,
            qrCodeDisponible: !!this.currentQRCode,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Fuerza la reconexión del cliente de WhatsApp
     * @returns Resultado de la reconexión
     */
    public async forzarReconexion() {
        try {
            this.logger.log('🔄 Forzando reconexión de WhatsApp...');
            
            // Resetear estados
            this.ready = false;
            this.initialized = false;
            this.currentState = WhatsAppSessionState.DISCONNECTED;
            this.initializationPromise = null;

            // Cerrar cliente actual si existe
            if (this.client) {
                try {
                    await this.client.destroy();
                    this.logger.log('🔌 Cliente anterior cerrado');
                } catch (error) {
                    this.logger.warn('⚠️ Error al cerrar cliente anterior:', error);
                }
                this.client = null;
            }

            // Reinicializar
            await this.initialize();
            
            return {
                success: true,
                message: 'Reconexión iniciada',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.logger.error('Error al forzar reconexión:', error);
            return {
                success: false,
                error: error?.message || 'Error desconocido',
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Verifica la conexión de WhatsApp y reconecta si es necesario
     */
    private async verificarYReconectar(): Promise<void> {
        try {
            if (!this.client) {
                throw new Error('Cliente no disponible');
            }

            const state = await this.client.getState();
            this.logger.log(`Estado de WhatsApp Web: ${state}`);

            if (state !== 'CONNECTED') {
                this.logger.warn(`WhatsApp Web no está conectado (${state}), intentando reconectar...`);
                
                // Marcar como no listo
                this.ready = false;
                this.initialized = false;
                
                // Reiniciar
                await this.forceRestart();
                
                // Esperar a que se reconecte
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                // Verificar nuevamente
                const newState = await this.client.getState();
                if (newState !== 'CONNECTED') {
                    throw new Error(`No se pudo reconectar. Estado: ${newState}`);
                }
                
                this.logger.log('✅ Reconexión exitosa');
            }
        } catch (error) {
            this.logger.error(`Error al verificar conexión: ${error.message}`);
            throw error;
        }
    }

    /**
     * Limpia completamente la sesión corrupta y reinicia
     */
    private async limpiarSesionCorrupta(): Promise<void> {
        try {
            this.logger.log('🧹 Limpiando sesión corrupta...');
            
            // Cerrar cliente actual
            if (this.client) {
                try {
                    await this.client.destroy();
                } catch (error) {
                    this.logger.warn('Error al cerrar cliente corrupto:', error);
                }
                this.client = null;
            }
            
            // Resetear estados
            this.ready = false;
            this.initialized = false;
            this.currentState = WhatsAppSessionState.DISCONNECTED;
            this.initializationPromise = null;
            this.currentQRCode = null;
            this.currentQRImage = null;
            
            // Limpiar archivos de sesión
            try {
                const fs = require('fs');
                const path = require('path');
                
                const authPath = './.wwebjs_auth';
                const cachePath = './.wwebjs_cache';
                
                if (fs.existsSync(authPath)) {
                    fs.rmSync(authPath, { recursive: true, force: true });
                    this.logger.log('🗑️ Archivos de autenticación eliminados');
                }
                
                if (fs.existsSync(cachePath)) {
                    fs.rmSync(cachePath, { recursive: true, force: true });
                    this.logger.log('🗑️ Archivos de caché eliminados');
                }
            } catch (error) {
                this.logger.warn('Error al limpiar archivos de sesión:', error);
            }
            
            // Esperar un poco antes de reinicializar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            this.logger.log('✅ Sesión corrupta limpiada, listo para reinicializar');
        } catch (error) {
            this.logger.error('Error al limpiar sesión corrupta:', error);
            throw error;
        }
    }

}
