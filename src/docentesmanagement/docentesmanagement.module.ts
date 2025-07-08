import { Module } from '@nestjs/common';
import { DocentesmanagementService } from './docentesmanagement.service';
import { DocentesmanagementController } from './docentesmanagement.controller';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { TribunalDocenteService } from 'src/tribunal-docente/tribunal-docente.service';

@Module({
  providers: [
    DocentesmanagementService,
    JwtStrategy,
    PrismaService,
    TribunalDocenteService
  ],
  controllers: [DocentesmanagementController]
})
export class DocentesmanagementModule { }
