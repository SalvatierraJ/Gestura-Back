import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
    // =========================
    // FACULTADES
    // =========================
    await prisma.facultad.createMany({
        data: [
            { nombre_facultad: "Ciencias Empresariales" },
            { nombre_facultad: "Ciencias y Tecnología" },
            { nombre_facultad: "Ciencias Jurídicas, Sociales y Humanísticas" },
        ],
        skipDuplicates: true,
    })

    const [cienciasEmp, cienciasTec, cienciasJur] = await Promise.all([
        prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias Empresariales" } }),
        prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias y Tecnología" } }),
        prisma.facultad.findUnique({ where: { nombre_facultad: "Ciencias Jurídicas, Sociales y Humanísticas" } }),
    ])
    if (!cienciasEmp || !cienciasTec || !cienciasJur) {
        throw new Error('Alguna facultad no existe. Revisa la unicidad de nombre_facultad.')
    }

    // =========================
    // CARRERAS
    // =========================
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
    })

    // =========================
    // MÓDULOS / PERMISOS / ROLES
    // =========================
    await prisma.modulos.createMany({
        data: [
            { Nombre: "Casos de Estudio" },
            { Nombre: "Gestion de Docentes" },
            { Nombre: "Gestion de Estudiantes" },
            { Nombre: "Defensas Programadas" },
            { Nombre: "Control de Acceso" },
            { Nombre: "Mis Defensas" },
            { Nombre: "Programar Materias" },
            { Nombre: "Plantillas" },
        ],
        skipDuplicates: true,
    })

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
    })

    await prisma.rol.createMany({
        data: [
            { Nombre: "Admin" },
            { Nombre: "Estudiante" },
            { Nombre: "Visitante" },
        ],
        skipDuplicates: true,
    })

    const adminRol = await prisma.rol.findFirst({ where: { Nombre: "Admin" } })
    if (!adminRol) throw new Error('No existe el rol Admin')

    const modulos = await prisma.modulos.findMany({
        where: { NOT: { Nombre: { equals: "Mis Defensas", mode: "insensitive" } } }
    })
    const permisos = await prisma.permisos.findMany()

    // Asegura permisos para Admin en todos los módulos (excepto Mis Defensas)
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
            })
        }
    }

    // =========================
    // PERSONA + USUARIO ADMIN (IDEMPOTENTE)
    // =========================
    const salt = await bcrypt.genSalt()
    const hashedPassword = await bcrypt.hash('admin123', salt)

    // Persona única por CI (busca primero por CI, luego upsert por Id_Persona)
    let personaAdmin = await prisma.persona.findFirst({ where: { CI: "12345678" } });
    if (personaAdmin) {
        personaAdmin = await prisma.persona.upsert({
            where: { Id_Persona: personaAdmin.Id_Persona },
            update: {
                Nombre: "Admin",
                Apellido1: "Principal",
                Apellido2: "Sistema",
                Correo: "admin@utepsa.edu.bo",
                telefono: 123456789,
            },
            create: {
                Nombre: "Admin",
                Apellido1: "Principal",
                Apellido2: "Sistema",
                Correo: "admin@utepsa.edu.bo",
                CI: "12345678",
                telefono: 123456789,
            }
        });
    } else {
        personaAdmin = await prisma.persona.create({
            data: {
                Nombre: "Admin",
                Apellido1: "Principal",
                Apellido2: "Sistema",
                Correo: "admin@utepsa.edu.bo",
                CI: "12345678",
                telefono: 123456789,
            }
        });
    }

    // Usuario único por Nombre_Usuario (evita P2002)
    const usuarioAdmin = await prisma.usuario.upsert({
        where: { Nombre_Usuario: 'admin' }, // <- Nombre_Usuario debe ser @unique
        update: {
            Password: hashedPassword,
            Id_Persona: personaAdmin.Id_Persona,
        },
        create: {
            Nombre_Usuario: 'admin',
            Password: hashedPassword,
            Id_Persona: personaAdmin.Id_Persona,
        },
    })

    // Rol Admin asignado al usuario (idempotente)
    await prisma.usuario_Rol.upsert({
        where: {
            Id_Usuario_Id_Rol: { Id_Usuario: usuarioAdmin.Id_Usuario, Id_Rol: adminRol.id_Rol }
        },
        update: {},
        create: { Id_Usuario: usuarioAdmin.Id_Usuario, Id_Rol: adminRol.id_Rol }
    })

    // Usuario Admin en todas las carreras (ya lo tenías idempotente)
    const carreras = await prisma.carrera.findMany()
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
        })
    }

    // =========================
    // TIPOS (idempotente)
    // =========================
    await prisma.tipo_Defensa.createMany({
        data: [
            { Nombre: "Examen de grado Interna", created_at: new Date(), updated_at: new Date() },
            { Nombre: "Examen de grado Externa", created_at: new Date(), updated_at: new Date() },
        ],
        skipDuplicates: true,
    })

    // Si Nombre de tipo_Tribunal no es único, busca el registro primero y luego usa upsert con el id:
    const tipoTribunalInterno = await prisma.tipo_Tribunal.findFirst({ where: { Nombre: "Interno" } });
    if (tipoTribunalInterno) {
        await prisma.tipo_Tribunal.upsert({
            where: { id_TipoTribunal: tipoTribunalInterno.id_TipoTribunal },
            update: { updated_at: new Date() },
            create: { Nombre: "Interno", created_at: new Date(), updated_at: new Date() },
        });
    } else {
        await prisma.tipo_Tribunal.create({
            data: { Nombre: "Interno", created_at: new Date(), updated_at: new Date() }
        });
    }



    const moduloPlantillas = await prisma.modulos.findFirst({
        where: { Nombre: "Plantillas" }
    })

    if (!moduloPlantillas) {
        throw new Error("No existe el módulo 'Plantillas'. Crea ese registro primero.")
    }

    await prisma.plantilla.createMany({
        data: [
            {
                nombre_archivo: "sorteo caso.docx",
                ruta_archivo: "uploads/plantillas/3f754e1b-1b4a-4455-a094-42b42b8c955d.docx",
                id_usuario: 1,
                id_modulo: moduloPlantillas.Id_Modulo,
            },
            {
                nombre_archivo: "FACULTAD CIENCIAS TECNOLÓGICAS GENERACION DOCUMENTO NOTAS EXAMEN.xlsx",
                ruta_archivo: "uploads/plantillas/e8329ed1-062f-44e2-bf2d-b3e435fa365e.xlsx",
                id_usuario: 1,
                id_modulo: moduloPlantillas.Id_Modulo,
            },
            {
                nombre_archivo: "FACULTAD CIENCIAS EMPRESARIALES GENERACION DOCUMENTO NOTAS EXAMEN.xlsx",
                ruta_archivo: "uploads/plantillas/4eded7a2-4ebb-473c-8b10-dcfbe8e9ad6b.xlsx",
                id_usuario: 1,
                id_modulo: moduloPlantillas.Id_Modulo,
            },
            {
                nombre_archivo: "FACULTAD CIENCIAS JURÍDICAS Y SOCIALES GENERACION DOCUMENTO NOTAS EXAMEN.xlsx",
                ruta_archivo: "uploads/plantillas/71b8970c-61f7-453e-b3f9-ae4ee75d3c97.xlsx",
                id_usuario: 1,
                id_modulo: moduloPlantillas.Id_Modulo,
            },
        ],
        skipDuplicates: true,
    })

}

main()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(async () => { await prisma.$disconnect() })
