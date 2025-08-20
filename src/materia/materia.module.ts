import { Module } from '@nestjs/common';
import { MateriaService } from './materia.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [MateriaService,PrismaService],
  exports: [MateriaService],
})
export class MateriaModule {}
