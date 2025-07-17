import { UserService } from './../user/user.service';
import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
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
    @Put('/actualizar-usuario/:id')
    async updateUser(@Body() body: any, @Request() req) {
        const id = Number(req.params.id)
        return this.userService.updateUser(id, body)
    }

    @UseGuards(JwtAuthGuard)
    @Put("/actualizar-perfil")
    async updatePerfil(@Body() body: any, @Request() req) {
        const user = req.user;
        return this.userService.updateUserProfile(Number(user.userId), body)
    }


    @Get('/usuarios/:page/:pageSize')
    async getAllUsers(@Request() req) {

        const page = Number(req.params.page);
        const pageSize = Number(req.params.pageSize);
        return this.userService.findAllUsuariosConRoles({ page, pageSize });
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
