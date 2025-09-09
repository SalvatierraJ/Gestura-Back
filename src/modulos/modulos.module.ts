import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { PrismaService } from 'src/database/prisma.services';
import {ModuloController} from './modulo.controller';
@Module({
  providers: [ModulosService,PrismaService],
  controllers: [ModuloController],
})
export class ModulosModule {}
