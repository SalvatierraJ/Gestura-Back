import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient()

async function main() {
    await prisma.facultad.createMany({
        data: [
            { nombre_facultad: "Ciencias Empresariales" },
            { nombre_facultad: "Ciencias y Tecnología" },
            { nombre_facultad: "Ciencias Jurídicas, Sociales y Humanísticas" },
        ],
        skipDuplicates: true,
    });

    const cienciasEmp = await prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias Empresariales" } });
    const cienciasTec = await prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias y Tecnología" } });
    const cienciasJur = await prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias Jurídicas, Sociales y Humanísticas" } });

    if (!cienciasEmp || !cienciasTec || !cienciasJur) {
        throw new Error('Alguna facultad no existe, corre primero el seed de facultad');
    }

    await prisma.carrera.createMany({
        data: [
            // CIENCIAS EMPRESARIALES
            { nombre_carrera: "Administración General", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Administración de Turismo", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Ingeniería Comercial", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Comercio Internacional", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Ingeniería en Marketing y Publicidad", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Contaduría Pública", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Ingeniería Financiera", id_facultad: cienciasEmp.id_facultad },
            { nombre_carrera: "Comunicación Estratégica y Digital", id_facultad: cienciasEmp.id_facultad },

            // CIENCIAS Y TECNOLOGÍA
            { nombre_carrera: "Ingeniería Industrial y Comercial", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería Electrónica y Sistemas", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería Mecánica Automotriz y Agroindustrial", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería de Sistemas", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería en Redes y Telecomunicaciones", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería Eléctrica", id_facultad: cienciasTec.id_facultad },
            { nombre_carrera: "Ingeniería de Alimentos y Negocios", id_facultad: cienciasTec.id_facultad },

            // CIENCIAS JURÍDICAS, SOCIALES Y HUMANÍSTICAS
            { nombre_carrera: "Derecho", id_facultad: cienciasJur.id_facultad },
            { nombre_carrera: "Relaciones Internacionales", id_facultad: cienciasJur.id_facultad },
            { nombre_carrera: "Psicología", id_facultad: cienciasJur.id_facultad },
        ],
        skipDuplicates: true,
    });

    await prisma.modulos.createMany({
        data: [
            { Nombre: "Casos de Estudio" },
            { Nombre: "Gestion de Docentes" },
            { Nombre: "Gestion de Estudiantes" },
            { Nombre: "Defensas Programadas" },
            { Nombre: "Control de Acceso" },
            { Nombre: "Mis Defensas" },
            { Nombre: "Programar Materias" },
        ],
        skipDuplicates: true,
    });
    await prisma.permisos.createMany({
        data: [
            { Nombre: "VIEW", Descripcion: "Permite visualizar información del módulo." },
            { Nombre: "CREATE", Descripcion: "Permite crear nuevos registros en el módulo." },
            { Nombre: "UPDATE", Descripcion: "Permite modificar registros existentes." },
            { Nombre: "DELETE", Descripcion: "Permite eliminar registros del módulo." },
            { Nombre: "EXPORT", Descripcion: "Permite exportar información del módulo a formatos como PDF o Excel." },
            { Nombre: "REPORT_VIEW", Descripcion: "Permite visualizar reportes relacionados al módulo." },
            { Nombre: "ASSIGN", Descripcion: "Permite asignar recursos, como estudiantes o docentes, a entidades específicas." },
        ],
        skipDuplicates: true,
    });
    await prisma.rol.createMany({
        data: [
            { Nombre: "Admin" },
            { Nombre: "Estudiante" },
            { Nombre: "Visitante" },
        ],
        skipDuplicates: true,
    });


    const adminRol = await prisma.rol.findFirst({
        where: { Nombre: "Admin" },
    });
    if (!adminRol) throw new Error('No existe el rol Admin');
    const modulos = await prisma.modulos.findMany({
        where: {
            NOT: { Nombre: { equals: "Mis Defensas", mode: "insensitive" } }
        }
    });
    const permisos = await prisma.permisos.findMany();
    for (const modulo of modulos) {
        for (const permiso of permisos) {
            await prisma.rol_Modulo_Permiso.upsert({
                where: {
                    rol_modulo_permiso_unique: {
                        Id_Rol: adminRol.id_Rol,
                        Id_Modulo: modulo.Id_Modulo,
                        Id_Permiso: permiso.Id_Permiso,
                    }
                },
                update: {},
                create: {
                    Id_Rol: adminRol.id_Rol,
                    Id_Modulo: modulo.Id_Modulo,
                    Id_Permiso: permiso.Id_Permiso,
                }
            });
        }
    }




    if (!adminRol) throw new Error('No existe el rol Admin');




    const personaAdmin = await prisma.persona.create({
        data: {
            Nombre: "Admin",
            Apellido1: "Principal",
            Apellido2: "Sistema",
            Correo: "admin@utepsa.edu.bo",
            CI: "12345678",
            telefono: 123456789,
        }
    });

    const salts = await bcrypt.genSalt()
    const hashedPassword = await bcrypt.hash("admin123", salts)
    // 2. Crea el usuario y le asigna el id de persona
    const usuarioAdmin = await prisma.usuario.create({
        data: {
            Nombre_Usuario: "admin",
            Password: hashedPassword, 
            Id_Persona: personaAdmin.Id_Persona,
        }
    });

    // 3. Busca el rol Admin
    const rolAdmin = await prisma.rol.findFirst({
        where: { Nombre: "Admin" }
    });
    if (!rolAdmin) throw new Error('Rol Admin no existe');

    // 4. Asigna el rol Admin al usuario creado
    await prisma.usuario_Rol.create({
        data: {
            Id_Usuario: usuarioAdmin.Id_Usuario,
            Id_Rol: rolAdmin.id_Rol,
        }
    });



    const carreras = await prisma.carrera.findMany();

    for (const carrera of carreras) {
        await prisma.usuario_Carrera.upsert({
            where: {
                Id_usuario_Id_carrera: {
                    Id_usuario: usuarioAdmin.Id_Usuario,
                    Id_carrera: carrera.id_carrera,
                }
            },
            update: {},
            create: {
                Id_usuario: usuarioAdmin.Id_Usuario,
                Id_carrera: carrera.id_carrera,
            }
        });
    }


    await prisma.tipo_Defensa.createMany({
        data: [
            {
                Nombre: "Examen de grado Interna",
                created_at: new Date(),
                updated_at: new Date(),
            },
            {
                Nombre: "Examen de grado Externa",
                created_at: new Date(),
                updated_at: new Date(),
            },
        ]
    });


    await prisma.tipo_Tribunal.create({
        data: {
            Nombre: "Interno",
            created_at: new Date(),
            updated_at: new Date(),
        }
    });


}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(async () => { await prisma.$disconnect() })
