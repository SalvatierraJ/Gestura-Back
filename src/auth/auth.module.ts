import { JWT_KEY } from './../../constants/jwt-key';
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from 'src/user/user.service';
import { LocalStrategy } from './strategy/local.strategy';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategy/jwt.strategy';
import { PrismaService } from 'src/database/prisma.services';
import { PeopleService } from 'src/people/people.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: JWT_KEY,
      signOptions: { expiresIn: '8hrs' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserService, LocalStrategy,JwtStrategy,PrismaService,PeopleService]
})
export class AuthModule { }
