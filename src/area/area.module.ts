import { Module } from '@nestjs/common';
import { AreaService } from './area.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [AreaService,PrismaService]
})
export class AreaModule {}
