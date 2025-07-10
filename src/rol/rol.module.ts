import { Module } from '@nestjs/common';
import { RolService } from './rol.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [RolService,PrismaService]
})
export class RolModule {}
