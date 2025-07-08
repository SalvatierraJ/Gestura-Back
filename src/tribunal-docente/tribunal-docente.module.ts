import { Module } from '@nestjs/common';
import { TribunalDocenteService } from './tribunal-docente.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [TribunalDocenteService,PrismaService]
})
export class TribunalDocenteModule {}
