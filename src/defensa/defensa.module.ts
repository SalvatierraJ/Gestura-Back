import { Module } from '@nestjs/common';
import { DefensaService } from './defensa.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [DefensaService,PrismaService]
})
export class DefensaModule {}
