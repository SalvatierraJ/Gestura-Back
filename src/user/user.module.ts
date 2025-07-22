import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from 'src/database/prisma.services';
import { JwtStrategy } from 'src/auth/strategy/jwt.strategy';
import { JwtService } from '@nestjs/jwt';

@Module({
  providers: [
    UserService,
    PrismaService,
    JwtStrategy,
    JwtService
  ]
})
export class UserModule {}
