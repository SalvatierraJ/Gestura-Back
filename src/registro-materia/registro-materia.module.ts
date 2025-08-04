import { Module } from '@nestjs/common';
import { RegistroMateriaService } from './registro-materia.service';
import { RegistroMateriaController } from './registro-materia.controller';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { MateriaService } from 'src/materia/materia.service';
import { ChatbotService } from 'src/chatbot/chatbot.service';
import { RedisService } from 'src/redis/redis.service';
import { GeminiService } from 'src/gemini/gemini.service';

@Module({
  providers: [RegistroMateriaService, JwtStrategy,
    PrismaService,MateriaService,GeminiService,ChatbotService,RedisService],
  controllers: [RegistroMateriaController]
})
export class RegistroMateriaModule { }
