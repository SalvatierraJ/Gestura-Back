import { Module } from '@nestjs/common';
import { FacultadService } from './facultad.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [FacultadService,PrismaService]
})
export class FacultadModule {}
