import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthorizationModule } from './authorization/authorization.module';
import {ConfigModule} from '@nestjs/config';
import { PrismaService } from './database/prisma.services';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PeopleModule } from './people/people.module';
import { CaseStudyManagementModule } from './case-study-management/case-study-management.module';
import { CarreraModule } from './carrera/carrera.module';
import { FacultadModule } from './facultad/facultad.module';
import { AreaModule } from './area/area.module';
import { CasosEstudioService } from './casos-estudio/casos-estudio.service';
import { CasosEstudioModule } from './casos-estudio/casos-estudio.module';
import { TribunalDocenteModule } from './tribunal-docente/tribunal-docente.module';
import { DocentesmanagementModule } from './docentesmanagement/docentesmanagement.module';

@Module({
  imports: [
    AuthorizationModule,
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: `.env`, 
    }),
    AuthModule,
    UserModule,
    PeopleModule,
    CaseStudyManagementModule,
    CarreraModule,
    FacultadModule,
    AreaModule,
    CasosEstudioModule,
    TribunalDocenteModule,
    DocentesmanagementModule
    
  ],
  controllers: [AppController],
  providers: [AppService,PrismaService, CasosEstudioService],
})
export class AppModule {}
