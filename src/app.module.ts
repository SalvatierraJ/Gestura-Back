import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthorizationModule } from './authorization/authorization.module';
import {ConfigModule} from '@nestjs/config';
import { PrismaService } from './database/prisma.services';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { PeopleModule } from './people/people.module';

@Module({
  imports: [
    AuthorizationModule,
    ConfigModule.forRoot({
      isGlobal: true, 
      envFilePath: `.env`, 
    }),
    AuthModule,
    UserModule,
    PeopleModule
    
  ],
  controllers: [AppController],
  providers: [AppService,PrismaService],
})
export class AppModule {}
