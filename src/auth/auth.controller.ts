import { UserService } from './../user/user.service';
import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PeopleService } from 'src/people/people.service';

@Controller('auth')
export class AuthController {

    constructor(
        private authService: AuthService,
        private userService: UserService,
        private personService: PeopleService
    ) { }

    @Post('/register')
    async register(@Body() body: CreateUserDto) {
        const people = this.personService.createEmptyPerson();
        return this.userService.createUser({ ...body, Id_Persona: (await people).Id_Persona });

    }
    @UseGuards(LocalAuthGuard)
    @Post('/login')
    async login(@Request() req) {
        return this.authService.login(req.user);
    }
    @UseGuards(JwtAuthGuard)
    @Get('/profile')
    async getProfile(@Request() req) {
        return await this.userService.getUserById(req.user.userId);
    }
}
