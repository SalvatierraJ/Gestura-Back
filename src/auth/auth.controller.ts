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
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private personService: PeopleService,
  ) { }

  @Post('/register')
  @ApiOperation({ 
    summary: 'Registrar nuevo usuario', 
    description: 'Crea un nuevo usuario en el sistema. Se crea automáticamente una persona vacía asociada al usuario.' 
  })
  @ApiBody({ 
    type: CreateUserDto,
    description: 'Datos del nuevo usuario',
    examples: {
      ejemplo1: {
        value: {
          Nombre_Usuario: 'juan.perez',
          Password: 'password123',
          Id_Rol: [1, 2],
          Id_Persona: null
        },
        summary: 'Ejemplo de registro de usuario'
      }
    }
  })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async register(@Body() body: CreateUserDto) {
    const people = this.personService.createEmptyPerson();
    return this.userService.createUser({
      ...body,
      Id_Persona: (await people).Id_Persona,
    });
  }

  @Put('/actualizar-usuario/:id')
  @ApiOperation({ 
    summary: 'Actualizar usuario', 
    description: 'Actualiza la información de un usuario existente por su ID' 
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a actualizar', type: Number, example: 1 })
  @ApiBody({ 
    description: 'Datos a actualizar del usuario',
    examples: {
      ejemplo1: {
        value: {
          Nombre_Usuario: 'juan.perez.actualizado',
          Id_Rol: [1]
        },
        summary: 'Ejemplo de actualización'
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async updateUser(@Body() body: any, @Request() req) {
    const id = Number(req.params.id);
    return this.userService.updateUser(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('/actualizar-perfil')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Actualizar perfil del usuario autenticado', 
    description: 'Permite al usuario autenticado actualizar su propio perfil' 
  })
  @ApiBody({ 
    description: 'Datos del perfil a actualizar',
    examples: {
      ejemplo1: {
        value: {
          Nombre_Usuario: 'nuevo.nombre',
          Password: 'nuevaPassword123'
        },
        summary: 'Ejemplo de actualización de perfil'
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updatePerfil(@Body() body: any, @Request() req) {
    const user = req.user;
    return this.userService.updateUserProfile(Number(user.userId), body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/usuarios/:page/:pageSize')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Obtener lista de usuarios paginada', 
    description: 'Obtiene una lista paginada de todos los usuarios con sus roles asociados. Requiere autenticación JWT.' 
  })
  @ApiParam({ name: 'page', description: 'Número de página', type: Number, example: 1 })
  @ApiParam({ name: 'pageSize', description: 'Cantidad de elementos por página', type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
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
  @ApiOperation({ 
    summary: 'Eliminar usuario (soft delete)', 
    description: 'Realiza un borrado lógico de un usuario por su ID. El usuario no se elimina físicamente de la base de datos.' 
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a eliminar', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async softDelete(@Param('id', ParseIntPipe) id: number) {
    return this.userService.softDeleteUsuario(id);
  }

  @Patch('/:id/restaurar')
  @ApiOperation({ 
    summary: 'Restaurar usuario eliminado', 
    description: 'Restaura un usuario que fue eliminado mediante soft delete' 
  })
  @ApiParam({ name: 'id', description: 'ID del usuario a restaurar', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Usuario restaurado exitosamente' })
  @ApiResponse({ status: 404, description: 'Usuario no encontrado' })
  async restore(@Param('id', ParseIntPipe) id: number) {
    return this.userService.restoreUsuario(id);
  }

  @Get('/search-people/:q')
  @ApiOperation({ 
    summary: 'Buscar personas', 
    description: 'Busca personas en el sistema por término de búsqueda. Requiere al menos 2 caracteres.' 
  })
  @ApiParam({ name: 'q', description: 'Término de búsqueda (mínimo 2 caracteres)', type: String, example: 'Juan' })
  @ApiResponse({ status: 200, description: 'Lista de personas encontradas', example: [] })
  async searchPeople(@Request() req) {
    if (!req.params.q || req.params.q.length < 2) {
      return [];
    }
    return this.personService.searchPeople(req.params.q);
  }

  @UseGuards(LocalAuthGuard)
  @Post('/login')
  @ApiOperation({ 
    summary: 'Iniciar sesión', 
    description: 'Autentica un usuario con nombre de usuario y contraseña. Devuelve un token JWT para usar en endpoints protegidos.' 
  })
  @ApiBody({ 
    description: 'Credenciales de acceso',
    examples: {
      ejemplo1: {
        value: {
          Nombre_Usuario: 'juan.perez',
          Password: 'password123'
        },
        summary: 'Ejemplo de login'
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Login exitoso, devuelve token JWT', example: { access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' } })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Obtener perfil del usuario autenticado', 
    description: 'Obtiene la información completa del perfil del usuario autenticado' 
  })
  @ApiResponse({ status: 200, description: 'Perfil del usuario obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getProfile(@Request() req) {
    return await this.userService.getUserById(req.user.userId);
  }

  // Nuevos endpoints para verificar y completar perfil
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Get('/verificar-perfil')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Verificar si el perfil está completo', 
    description: 'Verifica si el perfil del usuario autenticado tiene todos los datos requeridos completos' 
  })
  @ApiResponse({ status: 200, description: 'Estado de verificación del perfil', example: { completo: true, camposFaltantes: [] } })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async verificarPerfil(@Request() req) {
    const userId = req.user.userId;
    return this.authService.verificarPerfilCompleto(BigInt(userId));
  }

  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @Post('/completar-perfil')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Completar perfil del usuario', 
    description: 'Completa o actualiza los datos del perfil del usuario autenticado con información personal' 
  })
  @ApiBody({ 
    type: UpdateProfileDto,
    description: 'Datos del perfil a completar',
    examples: {
      ejemplo1: {
        value: {
          nombre: 'Juan',
          apellido1: 'Pérez',
          apellido2: 'García',
          correo: 'juan.perez@example.com',
          ci: '12345678',
          telefono: '70012345',
          nuevaPassword: 'nuevaPassword123',
          cambiarPassword: true
        },
        summary: 'Ejemplo de completar perfil'
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Perfil completado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async completarPerfil(
    @Request() req,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const userId = req.user.userId;
    return this.authService.completarPerfil(BigInt(userId), updateProfileDto);
  }

  @UseGuards(AuthorizationGuard)
  @Post('/login-oauth')
  @ApiOperation({ 
    summary: 'Login con OAuth', 
    description: 'Autentica o registra un usuario mediante OAuth usando un token de ID' 
  })
  @ApiBody({ 
    description: 'Token de OAuth',
    examples: {
      ejemplo1: {
        value: {
          id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEyMzQ1NiJ9...'
        },
        summary: 'Ejemplo de login OAuth'
      }
    }
  })
  @ApiResponse({ status: 200, description: 'Login OAuth exitoso, devuelve token JWT' })
  @ApiResponse({ status: 401, description: 'Token OAuth inválido' })
  async loginOauth(@Body() body: any) {
    return this.authService.loginOrRegisterOauthUser(body.id_token);
  }
}
