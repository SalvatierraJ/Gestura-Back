import { Module } from '@nestjs/common';
import { ModuloPeriodoController } from './modulo-periodo.controller';
import { ModuloPeriodoService } from './modulo-periodo.service';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers:[ModuloPeriodoService,JwtStrategy,
      PrismaService],
  controllers: [ModuloPeriodoController]
})
export class ModuloPeriodoModule {}
