import { Module } from '@nestjs/common';
import { DefensasmanagamentService } from './defensasmanagament.service';
import { DefensasmanagamentController } from './defensasmanagament.controller';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { DefensaService } from 'src/defensa/defensa.service';
import { JuradosService } from 'src/jurados/jurados.service';

@Module({
  providers: [DefensasmanagamentService, JwtStrategy,
    PrismaService, DefensaService, JuradosService],
  controllers: [DefensasmanagamentController]
})
export class DefensasmanagamentModule { }
