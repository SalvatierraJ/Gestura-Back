import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) { }

  @Get()
  @ApiOperation({ summary: 'Obtener mensaje de bienvenida', description: 'Endpoint raíz que devuelve un mensaje de bienvenida de la API' })
  @ApiResponse({ status: 200, description: 'Mensaje de bienvenida obtenido exitosamente', example: 'Hello World!' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/public')
  @ApiOperation({ summary: 'Endpoint público', description: 'Endpoint público que no requiere autenticación' })
  @ApiResponse({ status: 200, description: 'Respuesta pública exitosa', example: 'Public endpoint' })
  getPublic(): string {
    return this.appService.getPublic();
  }
  
  @Get('/protected')
  @ApiOperation({ summary: 'Endpoint protegido', description: 'Endpoint protegido que requiere autenticación' })
  @ApiResponse({ status: 200, description: 'Respuesta protegida exitosa', example: 'Protected endpoint' })
  getProtected(): string {
    return this.appService.getPrivate();
  }
}
