// src/notificacion/wweb-prisma.store.ts
import { promises as fs } from 'fs';
import { PrismaService } from '../database/prisma.services';

export class WWebPrismaStore {
  constructor(private prisma: PrismaService) {}

  async sessionExists({ session }: { session: string }): Promise<boolean> {
    const row = await this.prisma.whatsAppSession.findUnique({ where: { session_id: session } });
    return !!row;
  }

  async save({ session }: { session: string }): Promise<void> {
    const zipPath = `${session}.zip`;           // RemoteAuth lo deja aquí
    const zip = await fs.readFile(zipPath);
    await this.prisma.whatsAppSession.upsert({
      where: { session_id: session },
      update: { zip_data: zip },
      create: { session_id: session, zip_data: zip,data: {} },
      
    });
  }

  async extract({ session, path }: { session: string; path: string }): Promise<void> {
    const row = await this.prisma.whatsAppSession.findUnique({
      where: { session_id: session },
      select: { zip_data: true },
    });
    if (!row?.zip_data) throw new Error(`No existe sesión remota: ${session}`);
    await fs.writeFile(path, Buffer.from(row.zip_data as any));
  }

  async delete({ session }: { session: string }): Promise<void> {
    await this.prisma.whatsAppSession.delete({ where: { session_id: session } }).catch(() => {});
  }
}
