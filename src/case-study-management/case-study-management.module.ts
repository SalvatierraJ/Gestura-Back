import { facultad } from './../../node_modules/.prisma/client/index.d';
import { Module } from '@nestjs/common';
import { CaseStudyManagementController } from './case-study-management.controller';
import { CaseStudyManagementService } from './case-study-management.service';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { FacultadService } from 'src/facultad/facultad.service';
import { CarreraService } from 'src/carrera/carrera.service';

@Module({
  controllers: [CaseStudyManagementController],
  providers: [CaseStudyManagementService,JwtStrategy,PrismaService,FacultadService,CarreraService]
  
})
export class CaseStudyManagementModule {}
