import { PrismaService } from '../database/prisma.services';
import { Prisma } from '@prisma/client';

/** Serializa seguro para JSON/Prisma:
 *  - Buffer -> { __type: 'Buffer', base64: '...' }
 *  - BigInt -> string
 */
function toJsonSafe(value: any): any {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (typeof Buffer !== 'undefined' && v instanceof Buffer) {
        return { __type: 'Buffer', base64: v.toString('base64') };
      }
      return v;
    })
  );
}

/** Rehidrata los tipos serializados por toJsonSafe */
function fromJsonSafe<T = any>(value: any): T {
  const revive = (v: any): any => {
    if (v && typeof v === 'object') {
      if (v.__type === 'Buffer' && typeof v.base64 === 'string') {
        return Buffer.from(v.base64, 'base64');
      }
      if (Array.isArray(v)) return v.map(revive);
      const out: any = {};
      for (const k of Object.keys(v)) out[k] = revive(v[k]);
      return out;
    }
    return v;
  };
  return revive(value);
}

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

  // ---------------- Métodos de sesión ----------------

  async saveSession(sessionData: any) {
    try {
      // Garantiza que nunca se envíe data: undefined y que sea JSON-serializable
      const dataJson =
        sessionData === undefined || sessionData === null
          ? Prisma.JsonNull // si prefieres objeto vacío: {}
          : toJsonSafe(sessionData);

      // @ts-ignore - Tabla agregada recientemente, el tipo se actualizará después del reinicio
      await this.prisma.whatsAppSession.upsert({
        where: { session_id: this.sessionId },
        update: {
          data: dataJson,
          // Si tu modelo usa @updatedAt en Prisma, puedes quitar esta línea:
          updated_at: new Date()
        },
        create: {
          session_id: this.sessionId,
          data: dataJson,
          // Si tu modelo usa @default(now())/@updatedAt, puedes quitar estas dos:
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
        const restored = fromJsonSafe(session.data);
        console.log(`✅ Sesión de WhatsApp cargada desde base de datos (ID: ${this.sessionId})`);
        return restored;
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
    } catch (error: any) {
      // Ignora "record not found"
      if (error?.code !== 'P2025') {
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

  // ---------------- Aliases de compatibilidad ----------------

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
