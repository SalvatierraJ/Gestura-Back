import { Module } from '@nestjs/common';
import { CaseStudyManagementController } from './case-study-management.controller';
import { CaseStudyManagementService } from './case-study-management.service';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { FacultadService } from 'src/facultad/facultad.service';
import { CarreraService } from 'src/carrera/carrera.service';
import { AreaService } from 'src/area/area.service';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { CasosEstudioService } from 'src/casos-estudio/casos-estudio.service';


@Module({
  controllers: [CaseStudyManagementController],
  imports: [CloudinaryModule],
  providers: [
    CaseStudyManagementService,
    JwtStrategy,
    PrismaService,
    FacultadService,
    CarreraService,
    AreaService,
    CasosEstudioService
    
  ]
  
})
export class CaseStudyManagementModule {}
