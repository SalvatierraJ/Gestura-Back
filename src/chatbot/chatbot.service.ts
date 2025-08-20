import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.services';
import { RedisService } from 'src/redis/redis.service';

@Injectable()
export class ChatbotService {
    constructor(
        private readonly redisService: RedisService,
        private readonly prisma: PrismaService,
    ) { }

    // --------- Búsqueda de avance dentro del mismo ChatbotService
    async avancePensum({ registro, nombre, numeroPensum }: { registro?: string, nombre?: string, numeroPensum: number }) {
        console.log('avancePensum: buscando por', { registro, nombre, numeroPensum });

        const orConditions = [
            registro ? { nroRegistro: { equals: registro } } : undefined,
            nombre ? { Persona: { Nombre: { contains: nombre, mode: 'insensitive' } } } : undefined,
        ].filter(Boolean) as any[];

        console.log('Condiciones de búsqueda:', orConditions);

        const estudiante = await this.prisma.estudiante.findFirst({
            where: { OR: orConditions },
            include: {
                Persona: true,
                estudiante_Carrera: { include: { carrera: true } },
                estudiantes_materia: { include: { materia: true } },
            },
        });

        console.log('Estudiante encontrado:', estudiante);

        if (!estudiante) {
            console.log('No se encontró estudiante');
            throw new Error('Estudiante no encontrado');
        }

        const materiasPensum = await this.prisma.materia_carrera.findMany({
            where: {
                id_carrera: estudiante.estudiante_Carrera[0]?.Id_Carrera,
                numero_pensum: numeroPensum,
            },
            include: { materia: true },
        });

        console.log('Materias del pensum:', materiasPensum.length);

        const avance = materiasPensum.map((mc) => {
            const cursada = estudiante.estudiantes_materia.find(
                (em) => em.id_materia === mc.id_materia,
            );
            return {
                materia: mc.materia?.nombre,
                sigla: mc.materia?.siglas_materia,
                estado: cursada?.estado || 'pendiente',
            };
        });

        console.log('Avance:', avance);

        const respuesta = {
            estudiante: {
                nombre: `${estudiante.Persona?.Nombre || ''} ${estudiante.Persona?.Apellido1 || ''} ${estudiante.Persona?.Apellido2 || ''}`,
                registro: estudiante.nroRegistro,
                carrera: estudiante.estudiante_Carrera[0]?.carrera?.nombre_carrera,
                pensum: numeroPensum,
                estado: estudiante.estado,
            },
            avance,
        };

        console.log('Respuesta final avancePensum:', respuesta);

        return respuesta;
    }

    // ----------------- Conversar mejorado: consulta directa y flexible
    // async conversar(userId: string, mensajeUsuario: string) {
    //     console.log('Conversar: userId=', userId, 'mensajeUsuario=', mensajeUsuario);

    //     const history = await this.redisService.getChatHistory(userId);
    //     let contexto = await this.redisService.getChatContext(userId) || {};
    //     let promptExtra = '';
    //     let dataAvance: any = null;
    //     let esConsultaAvance = false;

    //     // --------- SIEMPRE: Captura datos aunque no pregunte por avance
    //     // Detecta número de registro
    //     const regMatch = mensajeUsuario.match(/registro\s*:?[\s#-]*(\d+)/i);
    //     if (regMatch) {
    //         contexto.registro = regMatch[1];
    //         await this.redisService.setChatContext(userId, contexto);
    //     }
    //     // Detecta pensum
    //     const pensumMatch = mensajeUsuario.match(/pensum\s*:?[\s#-]*(\d+)/i);
    //     if (pensumMatch) {
    //         contexto.numeroPensum = Number(pensumMatch[1]);
    //         await this.redisService.setChatContext(userId, contexto);
    //     }
    //     // Detecta nombre (mejorar regex si quieres nombres más largos)
    //     const nombreMatch = mensajeUsuario.match(/estudiante\s+([A-ZÁÉÍÓÚÑ\s]+)/i);
    //     if (nombreMatch) {
    //         contexto.nombre = nombreMatch[1].trim();
    //         await this.redisService.setChatContext(userId, contexto);
    //     }
    //     // ---

    //     // --------- Intención: Consulta avance académico
    //     if (/materias.*falta|faltan.*materias|materias.*aprobar|avance academico/i.test(mensajeUsuario)) {
    //         if (!contexto.registro && !contexto.nombre) {
    //             contexto.ultima_intencion = 'avance_pensum';
    //             await this.redisService.setChatContext(userId, contexto);

    //             const respuesta = 'Por favor, dime tu número de registro o tu nombre completo para mostrarte tu avance.';
    //             history.push({ usuario: mensajeUsuario, bot: respuesta });
    //             await this.redisService.setChatHistory(userId, history);
    //             console.log('Se pide registro/nombre al usuario');
    //             return { respuesta, history };
    //         }

    //         // Ya hay registro/nombre/pensum: consulta avance
    //         dataAvance = await this.avancePensum({
    //             registro: contexto.registro,
    //             nombre: contexto.nombre,
    //             numeroPensum: contexto.numeroPensum || 1,
    //         });
    //         promptExtra = this.construirPromptAvance(dataAvance);
    //         esConsultaAvance = true;
    //         console.log('Consulta de avance realizada:', dataAvance);
    //     }

    //     // ---- Si el usuario responde con contexto pendiente (por registro o nombre)
    //     if (contexto.ultima_intencion === 'avance_pensum' && (!contexto.registro && !contexto.nombre)) {
    //         // Registro numérico
    //         if (/^\d+$/.test(mensajeUsuario.trim())) {
    //             contexto.registro = mensajeUsuario.trim();
    //             await this.redisService.setChatContext(userId, contexto);

    //             dataAvance = await this.avancePensum({
    //                 registro: contexto.registro,
    //                 nombre: undefined,
    //                 numeroPensum: contexto.numeroPensum || 1,
    //             });
    //             promptExtra = this.construirPromptAvance(dataAvance);
    //             contexto.ultima_intencion = null;
    //             await this.redisService.setChatContext(userId, contexto);
    //             esConsultaAvance = true;
    //             console.log('Consulta avance por registro:', contexto.registro, dataAvance);
    //         } else {
    //             // Nombre de persona
    //             contexto.nombre = mensajeUsuario.trim();
    //             await this.redisService.setChatContext(userId, contexto);

    //             dataAvance = await this.avancePensum({
    //                 registro: undefined,
    //                 nombre: contexto.nombre,
    //                 numeroPensum: contexto.numeroPensum || 1,
    //             });
    //             promptExtra = this.construirPromptAvance(dataAvance);
    //             contexto.ultima_intencion = null;
    //             await this.redisService.setChatContext(userId, contexto);
    //             esConsultaAvance = true;
    //             console.log('Consulta avance por nombre:', contexto.nombre, dataAvance);
    //         }
    //     }

    //     // --- Prepara el prompt del LLM (igual que antes)
    //     let prompt = `Eres un asistente académico universitario. Sé claro y breve.\n`;
    //     history.forEach(entry => {
    //         prompt += `Usuario: ${entry.usuario}\nBot: ${entry.bot}\n`;
    //     });
    //     prompt += `Usuario: ${mensajeUsuario}\n`;
    //     if (promptExtra) prompt += promptExtra + '\n';
    //     prompt += `Bot:`;

    //     console.log('Prompt enviado al LLM:', prompt);

    //     const respuesta = await this.llamaService.consultarLlama(prompt);

    //     history.push({ usuario: mensajeUsuario, bot: respuesta });
    //     await this.redisService.setChatHistory(userId, history);

    //     if (esConsultaAvance && dataAvance) {
    //         console.log('Respuesta enviada al frontend:', {
    //             respuesta,
    //             history,
    //             infoEstudiante: dataAvance,
    //             sugerenciaLLM: respuesta,
    //         });
    //         return {
    //             respuesta,
    //             history,
    //             infoEstudiante: dataAvance,
    //             sugerenciaLLM: respuesta,
    //         };
    //     }

    //     return { respuesta, history };
    // }


    construirPromptAvance(data: any) {
        let prompt = `Tengo el siguiente avance académico de un estudiante:\n`;
        prompt += `Nombre: ${data.estudiante.nombre}\n`;
        prompt += `Registro: ${data.estudiante.registro}\n`;
        prompt += `Carrera: ${data.estudiante.carrera}\n`;
        prompt += `Pensum: ${data.estudiante.pensum}\n`;
        prompt += `Estado general: ${data.estudiante.estado}\n`;
        prompt += `Materias:\n`;
        data.avance.forEach((mat: any) => {
            prompt += `- ${mat.materia} (${mat.sigla}): ${mat.estado}\n`;
        });
        return prompt;
    }
}
