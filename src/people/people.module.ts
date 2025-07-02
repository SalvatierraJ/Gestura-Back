import { Module } from '@nestjs/common';
import { PeopleService } from './people.service';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  providers: [PeopleService,PrismaService]
})
export class PeopleModule {}
