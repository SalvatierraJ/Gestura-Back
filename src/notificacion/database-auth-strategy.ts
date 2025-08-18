import { PrismaService } from '../database/prisma.services';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';

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
    console.log(`🔧 Configurando estrategia (RemoteAuth Store) — ID: ${this.sessionId}`);
  }
  async beforeBrowserInitialized() {
    console.log(`📱 Preparando navegador para sesión: ${this.sessionId}`);
  }
  async afterBrowserInitialized() {
    console.log(`✅ Navegador inicializado para sesión: ${this.sessionId}`);
  }

  
  async getAuthEventPayload() {
    console.log(`ℹ️ (MD) getAuthEventPayload no usa JSON de sesión — ID: ${this.sessionId}`);
    return null;
  }

  async afterAuthenticationSuccess() {
    console.log(`🎉 Autenticación exitosa — ID: ${this.sessionId}`);
  
  }
  async afterAuthenticationFailure() {
    console.log(`❌ Fallo en autenticación — ID: ${this.sessionId}`);
    await this.deleteSession();
  }
  async disconnect() { console.log(`🔌 Desconectando sesión: ${this.sessionId}`); }
  async destroy() {
    console.log(`🗑️ Destruyendo sesión: ${this.sessionId}`);
    await this.deleteSession();
  }
  logout() {
    console.log(`👋 Cerrando sesión: ${this.sessionId}`);
    return this.deleteSession();
  }

  async sessionExists({ session }: { session: string } = { session: this.sessionId }): Promise<boolean> {
    const row = await this.prisma.whatsAppSession.findUnique({ where: { session_id: session } });
    return !!row?.zip_data;
  }


  async save({ session }: { session: string } = { session: this.sessionId }): Promise<void> {
    const zipPath = `${session}.zip`;
    const zip = await fs.readFile(zipPath); 

    await this.prisma.whatsAppSession.upsert({
      where: { session_id: session },
      create: { session_id: session, zip_data: zip, data: Prisma.JsonNull },
      update: { zip_data: zip },
    });
    console.log(`💾 Sesión ZIP guardada en BD — session_id=${session}`);
  }

  async extract(
    { session, path }: { session: string; path: string } = { session: this.sessionId, path: `${this.sessionId}.zip` }
  ): Promise<void> {
    const row = await this.prisma.whatsAppSession.findUnique({
      where: { session_id: session },
      select: { zip_data: true },
    });
    if (!row?.zip_data) throw new Error(`No existe ZIP de sesión en BD — session_id=${session}`);

    await fs.writeFile(path, Buffer.from(row.zip_data as any));
    console.log(`📦 ZIP escrito en ${path} para RemoteAuth — session_id=${session}`);
  }


  async delete({ session }: { session: string } = { session: this.sessionId }): Promise<void> {
    await this.prisma.whatsAppSession.delete({ where: { session_id: session } }).catch(() => {});
    console.log(`🧹 Sesión remota eliminada de BD — session_id=${session}`);
  }


  async saveSession(_sessionData: any) {
    console.log('⚠️ [MD] saveSession(JSON) ignorado: RemoteAuth maneja la persistencia vía store.save()');
  }


  async loadSession(): Promise<any> {
    console.log('⚠️ [MD] loadSession(JSON) no aplica — usa RemoteAuth + store.extract()');
    return null;
  }


  async deleteSession() {
    await this.delete({ session: this.sessionId });
  }

  async sessionExistsLegacy(): Promise<boolean> {
    return this.sessionExists({ session: this.sessionId });
  }

  async getSessionData() { return this.loadSession(); }
  async setSessionData(sessionData: any) { return this.saveSession(sessionData); }
  async removeSessionData() { return this.deleteSession(); }
}
