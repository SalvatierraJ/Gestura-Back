import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [PermisosService,PrismaService]
})
export class PermisosModule {}
