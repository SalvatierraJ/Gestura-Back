import { Module } from '@nestjs/common';
import { ControlaccesomanagamentService } from './controlaccesomanagament.service';
import { ControlaccesomanagamentController } from './controlaccesomanagament.controller';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { RolService } from 'src/rol/rol.service';
import { ModulosService } from 'src/modulos/modulos.service';
import { PermisosService } from 'src/permisos/permisos.service';

@Module({
  providers: [
    ControlaccesomanagamentService, 
    JwtStrategy,
    PrismaService, 
    RolService,
    ModulosService,
    PermisosService
  ],
  controllers: [ControlaccesomanagamentController]
})
export class ControlaccesomanagamentModule { }
