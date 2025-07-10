import { Module } from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [EstudianteService, PrismaService]
})
export class EstudianteModule {}
