import { Module } from '@nestjs/common';
import { CasosEstudioService } from './casos-estudio.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [CasosEstudioService,PrismaService]
})
export class CasosEstudioModule {}
