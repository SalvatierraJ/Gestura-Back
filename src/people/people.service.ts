import { Injectable, Body } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { CreatePeopleDto } from './dto/create-people';

@Injectable()
export class PeopleService {

    constructor(private prisma: PrismaService) {}

    async createPerson(body : CreatePeopleDto) {
        try {
            const newPerson = await this.prisma.persona.create({
                data: {
                    Nombre: body.Nombre,
                    Apellido1: body.Apellido1,
                    Apellido2: body.Apellido2,
                    Correo: body.Correo,
                    CI: body.CI,
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            return newPerson;
        } catch (error) {
            throw new Error(`Error creating person: ${error.message}`);
        }
    }
    async createEmptyPerson() {
        try {
            const newPerson = await this.prisma.persona.create({
                data: {
                    Nombre: '',
                    Apellido1: '',
                    Apellido2: '',
                    Correo: '',
                    CI: '',
                    created_at: new Date(),
                    updated_at: new Date(),
                }
            });
            return newPerson;
        } catch (error) {
            throw new Error(`Error creating empty person: ${error.message}`);
        }
    }
}
