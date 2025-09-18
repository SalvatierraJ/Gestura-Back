import { Module } from '@nestjs/common';
import { EstudianteService } from './estudiante.service';
import { PrismaService } from 'src/database/prisma.services';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Module({
  imports: [CloudinaryModule],
  providers: [EstudianteService, PrismaService]
})
export class EstudianteModule {}
