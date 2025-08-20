import {Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { PrismaService } from '../database/prisma.services';
import { PlantillaService } from './plantilla.service';
import { PlantillaController } from './plantilla.controller';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'fileQueue',
        }),
        CloudinaryModule,
    ],
    providers: [PlantillaService, PrismaService],
    controllers: [PlantillaController],
})
export class PlantillaModule{}