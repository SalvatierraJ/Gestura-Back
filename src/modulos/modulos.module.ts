import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [ModulosService,PrismaService]
})
export class ModulosModule {}
