import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { BigIntInterceptor } from './common/interceptors/bigint.interceptors';
import * as bodyParser from 'body-parser';
import { PrismaService } from './database/prisma.services';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
  });
  app.useGlobalInterceptors(new BigIntInterceptor());
  app.useGlobalPipes(new ValidationPipe());
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Gestura API')
    .setDescription('API documentation for Gestura Backend')
    .setVersion('0.0.6')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const prisma = app.get(PrismaService);
  const shutdown = async () => {
    await prisma.$disconnect();
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
