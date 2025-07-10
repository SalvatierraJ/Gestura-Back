import { Module } from '@nestjs/common';
import { StudentManagamentService } from './student-managament.service';
import { StudentManagamentController } from './student-managament.controller';
import { EstudianteService } from 'src/estudiante/estudiante.service';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { DefensaService } from 'src/defensa/defensa.service';

@Module({
  providers: [StudentManagamentService, EstudianteService, JwtStrategy,
    PrismaService,DefensaService],
  controllers: [StudentManagamentController]
})
export class StudentManagamentModule { }
