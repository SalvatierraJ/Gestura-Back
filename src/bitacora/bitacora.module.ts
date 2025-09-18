import { Module } from '@nestjs/common';
import { BitacoraService } from './bitacora.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [BitacoraService, PrismaService],
  exports: [BitacoraService],
})
export class BitacoraModule {}
