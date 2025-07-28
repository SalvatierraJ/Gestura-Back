import { PrismaService } from '../database/prisma.services';

export class DatabaseAuthStrategy {
    public dataPath: string;
    private prisma: PrismaService;
    private sessionId: string;

    constructor(prisma: PrismaService, sessionId: string = 'default') {
        this.prisma = prisma;
        this.sessionId = sessionId;
        this.dataPath = `session-${sessionId}`;
    }

    async setup() {
        console.log(`🔧 Configurando estrategia de autenticación en base de datos (ID: ${this.sessionId})`);
    }

    async beforeBrowserInitialized() {
        console.log(`📱 Preparando inicialización del navegador para sesión: ${this.sessionId}`);
    }

    async afterBrowserInitialized() {
        console.log(`✅ Navegador inicializado para sesión: ${this.sessionId}`);
    }

    async getAuthEventPayload() {
        try {
            const sessionData = await this.loadSession();
            if (sessionData) {
                console.log(`📦 Cargando datos de sesión desde base de datos (ID: ${this.sessionId})`);
                return sessionData;
            }
            console.log(`🆕 No hay datos de sesión previa (ID: ${this.sessionId})`);
            return null;
        } catch (error) {
            console.error('❌ Error al cargar payload de autenticación:', error);
            return null;
        }
    }

    async afterAuthenticationSuccess(sessionData?: any) {
        console.log(`🎉 Autenticación exitosa para sesión: ${this.sessionId}`);
        if (sessionData) {
            await this.saveSession(sessionData);
        }
    }

    async afterAuthenticationFailure() {
        console.log(`❌ Fallo en autenticación para sesión: ${this.sessionId}`);
        await this.deleteSession();
    }

    async disconnect() {
        console.log(`🔌 Desconectando sesión: ${this.sessionId}`);
    }

    async destroy() {
        console.log(`🗑️ Destruyendo sesión: ${this.sessionId}`);
        await this.deleteSession();
    }

    logout() {
        console.log(`👋 Cerrando sesión: ${this.sessionId}`);
        return this.deleteSession();
    }

    // Métodos principales de manejo de sesión
    async saveSession(sessionData: any) {
        try {
            // @ts-ignore - Tabla agregada recientemente, el tipo se actualizará después del reinicio
            await this.prisma.whatsAppSession.upsert({
                where: { session_id: this.sessionId },
                update: {
                    data: sessionData,
                    updated_at: new Date()
                },
                create: {
                    session_id: this.sessionId,
                    data: sessionData,
                    created_at: new Date(),
                    updated_at: new Date()
                }
            });
            console.log(`✅ Sesión de WhatsApp guardada en base de datos (ID: ${this.sessionId})`);
        } catch (error) {
            console.error('❌ Error al guardar sesión en base de datos:', error);
        }
    }

    async loadSession(): Promise<any> {
        try {
            // @ts-ignore - Tabla agregada recientemente, el tipo se actualizará después del reinicio
            const session = await this.prisma.whatsAppSession.findUnique({
                where: { session_id: this.sessionId }
            });

            if (session) {
                console.log(`✅ Sesión de WhatsApp cargada desde base de datos (ID: ${this.sessionId})`);
                return session.data;
            } else {
                console.log(`ℹ️ No se encontró sesión previa en base de datos (ID: ${this.sessionId})`);
                return null;
            }
        } catch (error) {
            console.error('❌ Error al cargar sesión desde base de datos:', error);
            return null;
        }
    }

    async deleteSession() {
        try {
            // @ts-ignore - Tabla agregada recientemente, el tipo se actualizará después del reinicio
            await this.prisma.whatsAppSession.delete({
                where: { session_id: this.sessionId }
            });
            console.log(`✅ Sesión de WhatsApp eliminada de base de datos (ID: ${this.sessionId})`);
        } catch (error) {
            // No mostrar error si la sesión no existe
            if (error.code !== 'P2025') {
                console.error('❌ Error al eliminar sesión de base de datos:', error);
            }
        }
    }

    async sessionExists(): Promise<boolean> {
        try {
            // @ts-ignore - Tabla agregada recientemente, el tipo se actualizará después del reinicio
            const session = await this.prisma.whatsAppSession.findUnique({
                where: { session_id: this.sessionId }
            });
            return session !== null;
        } catch (error) {
            console.error('❌ Error al verificar existencia de sesión:', error);
            return false;
        }
    }

    // Métodos de compatibilidad adicionales
    async getSessionData() {
        return await this.loadSession();
    }

    async setSessionData(sessionData: any) {
        await this.saveSession(sessionData);
    }

    async removeSessionData() {
        await this.deleteSession();
    }
}
