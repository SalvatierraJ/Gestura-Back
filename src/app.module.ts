import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
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
import { StudentManagamentModule } from './student-managament/student-managament.module';
import { EstudianteModule } from './estudiante/estudiante.module';
import { DefensaModule } from './defensa/defensa.module';
import { DefensasmanagamentModule } from './defensasmanagament/defensasmanagament.module';
import { JuradosModule } from './jurados/jurados.module';
import { RolModule } from './rol/rol.module';
import { ControlaccesomanagamentModule } from './controlaccesomanagament/controlaccesomanagament.module';
import { PermisosModule } from './permisos/permisos.module';
import { ModulosModule } from './modulos/modulos.module';
import { NotificacionModule } from './notificacion/notificacion.module';
import { BullModule } from '@nestjs/bull';
import { MateriaModule } from './materia/materia.module';
import { RegistroMateriaModule } from './registro-materia/registro-materia.module';
import { ProfileCheckMiddleware } from './common/middleware/profile-check.middleware';
import { PlantillaModule } from './plantilla/plantilla.module';
import { JwtModule } from '@nestjs/jwt';
import { JWT_KEY } from '../constants/jwt-key';
import { RedisService } from './redis/redis.service';
import { ChatbotService } from './chatbot/chatbot.service';
import { ChatbotModule } from './chatbot/chatbot.module';
import { RedisModule } from './redis/redis.module';
import { GeminiService } from './gemini/gemini.service';
import { IaService } from './ia/ia.service';
import { IaModule } from './ia/ia.module';
import { ModuloPeriodoService } from './modulo-periodo/modulo-periodo.service';
import { ModuloPeriodoModule } from './modulo-periodo/modulo-periodo.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.HOST_REDIS,
        port: Number(process.env.PORT_REDIS),
      },
    }),
    BullModule.registerQueue({ name: "whatsappQueue" }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`,
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env`,
    }),
    JwtModule.register({
      secret: JWT_KEY,
      signOptions: { expiresIn: '8hrs' },
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
    DocentesmanagementModule,
    StudentManagamentModule,
    EstudianteModule,
    DefensaModule,
    DefensasmanagamentModule,
    JuradosModule,
    RolModule,
    ControlaccesomanagamentModule,
    PermisosModule,
    ModulosModule,
    MateriaModule,
    RegistroMateriaModule,
    PlantillaModule,
    ChatbotModule,
    RedisModule,
    IaModule,
    ModuloPeriodoModule
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService, CasosEstudioService, RedisService, ChatbotService, GeminiService, IaService, ModuloPeriodoService],
})
export class AppModule { }
