import { UserService } from './../user/user.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { CreateUserDto } from 'src/user/dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PeopleService } from 'src/people/people.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AuthorizationGuard } from './guards/authorization.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private personService: PeopleService,
  ) { }

  @Post('/register')
  async register(@Body() body: CreateUserDto) {
    const people = this.personService.createEmptyPerson();
    return this.userService.createUser({
      ...body,
      Id_Persona: (await people).Id_Persona,
    });
  }

  @Put('/actualizar-usuario/:id')
  async updateUser(@Body() body: any, @Request() req) {
    const id = Number(req.params.id);
    return this.userService.updateUser(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/actualizar-perfil')
  async updatePerfil(@Body() body: any, @Request() req) {
    const user = req.user;
    return this.userService.updateUserProfile(Number(user.userId), body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usuarios/:page/:pageSize')
  async getAllUsers(@Request() req) {
    const user = req.user;
    const page = Number(req.params.page);
    const pageSize = Number(req.params.pageSize);
    return this.userService.findAllUsuariosConRoles(
      page,
      pageSize,
      Number(user.userId),
    );
  }

  @Delete('/eliminar/:id')
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.softDeleteUsuario(id);
  }

  @Patch('/:id/restaurar')
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.userService.restoreUsuario(id);
  }

  @Get('/search-people/:q')
  async searchPeople(@Request() req) {
    if (!req.params.q || req.params.q.length < 2) {
      return [];
    }
    return this.personService.searchPeople(req.params.q);
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

  // Nuevos endpoints para verificar y completar perfil
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Get('/verificar-perfil')
  async verificarPerfil(@Request() req) {
    const userId = req.user.userId;
    return this.authService.verificarPerfilCompleto(BigInt(userId));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Post('/completar-perfil')
  async completarPerfil(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user.userId;
    return this.authService.completarPerfil(BigInt(userId), updateProfileDto);
  }

  @UseGuards(AuthorizationGuard)
  @Post('/login-oauth')
  async loginOauth(@Body() body: any) {
    return this.authService.loginOrRegisterOauthUser(body.id_token);
  }
}
