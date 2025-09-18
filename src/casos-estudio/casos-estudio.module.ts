import { Module } from '@nestjs/common';
import { CasosEstudioService } from './casos-estudio.service';
import { PrismaService } from 'src/database/prisma.services';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CloudinaryModule } from 'src/cloudinary/cloudinary.module';

@Module({
  imports: [BitacoraModule, CloudinaryModule],
  providers: [CasosEstudioService, PrismaService],
  exports: [CasosEstudioService],
})
export class CasosEstudioModule {}