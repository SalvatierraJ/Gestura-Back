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
    AreaModule
    
  ],
  controllers: [AppController],
  providers: [AppService,PrismaService],
})
export class AppModule {}
