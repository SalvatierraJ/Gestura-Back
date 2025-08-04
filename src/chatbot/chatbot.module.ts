import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { MateriaModule } from 'src/materia/materia.module';
import { RedisModule } from 'src/redis/redis.module';
import { PrismaService } from 'src/database/prisma.services';

@Module({
  imports: [
    MateriaModule,
    RedisModule
  ],
  providers: [
    ChatbotService,
    PrismaService
  ],
  exports: [ChatbotService]
})
export class ChatbotModule {

}
