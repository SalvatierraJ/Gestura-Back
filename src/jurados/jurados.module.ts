import { Module } from '@nestjs/common';
import { JuradosService } from './jurados.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [JuradosService,PrismaService]
})
export class JuradosModule {}
