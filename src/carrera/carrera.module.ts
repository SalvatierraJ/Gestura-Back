import { Module } from '@nestjs/common';
import { CarreraService } from './carrera.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [CarreraService,PrismaService]
})
export class CarreraModule {}
