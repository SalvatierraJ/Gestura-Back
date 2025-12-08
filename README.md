<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## API Documentation (Swagger)

La aplicación incluye documentación interactiva de la API usando Swagger/OpenAPI.

### Acceder a la documentación

Una vez que la aplicación esté ejecutándose, puedes acceder a la documentación de Swagger en:

```
http://localhost:3000/api
```

### Características

- **Documentación interactiva**: Prueba los endpoints directamente desde el navegador
- **Autenticación JWT**: Usa el botón "Authorize" para autenticarte y probar endpoints protegidos
- **Ejemplos de requests y responses**: Cada endpoint incluye ejemplos de cómo usar la API
- **Descripciones detalladas**: Información sobre parámetros, tipos de datos y códigos de respuesta

### Endpoints documentados

La documentación incluye todos los controladores de la aplicación:

- **auth** - Autenticación, registro, login, perfiles
- **control-acceso** - Gestión de roles, permisos y módulos
- **docentes** - Gestión de docentes del tribunal
- **estudiantes** - Gestión de estudiantes
- **defensas** - Gestión de defensas, jurados, notificaciones
- **plantillas** - Gestión de plantillas de documentos
- **casos-estudio** - Gestión de carreras, áreas y casos de estudio
- **registro-materia** - Registro de materias, inscripciones, pensum
- **modulo-periodo** - Períodos académicos
- **whatsapp-admin** - Administración de WhatsApp

### Autenticación en Swagger

Para probar endpoints protegidos:

1. Haz clic en el botón **"Authorize"** en la parte superior de la página
2. Ingresa tu token JWT (obtenido del endpoint `/auth/login`)
3. Haz clic en **"Authorize"** y luego en **"Close"**
4. Ahora puedes probar los endpoints protegidos directamente desde Swagger

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).


# Guía de Commits y Changelog Profesional con Git Flow

Esta guía te muestra cómo estructurar los mensajes de commit y cómo identificar y documentar los cambios en tu changelog profesional. Se enfoca en el uso de ramas `release` en Git Flow para generar automáticamente un changelog (`CHANGELOG.md`) solo a partir de los commits relevantes.

---

## 1. Tipos de Commits y Ejemplos

| Tipo     | Icono / Color | ¿Cuándo usarlo?                                   | Ejemplo de commit                       |
| -------- | ------------- | ------------------------------------------------- | --------------------------------------- |
| feat     | 🟢 Verde      | Cuando agregas una nueva funcionalidad            | feat(api): agrega endpoint de usuarios  |
| fix      | 🔴 Rojo       | Cuando corriges un error o bug                    | fix(auth): corrige bug de login         |
| chore    | 🟡 Amarillo   | Cambios menores, tareas de mantenimiento          | chore: actualiza dependencias           |
| refactor | 🔵 Azul claro | Reestructura el código, sin cambiar funcionalidad | refactor(core): reorganiza validaciones |

**Regla de oro:**

* Cada commit debe comenzar con el tipo en minúscula, seguido de dos puntos y un breve resumen.
* Si el cambio afecta un módulo específico, ponlo entre paréntesis: `tipo(módulo): mensaje`.

### Más ejemplos

* feat(dashboard): agrega gráfico de ventas mensual
* fix(ventas): soluciona error de cálculo de impuestos
* chore(ci): configura action de deploy automático
* refactor(utils): simplifica función de formateo de fechas

---

## 2. ¿Cómo identificar el tipo de commit?

| Escenario                                                    | Tipo           | Ejemplo                                               |
| ------------------------------------------------------------ | -------------- | ----------------------------------------------------- |
| Agregas un nuevo módulo, endpoint o funcionalidad importante | feat           | feat(reporte): agrega exportación PDF                 |
| Corriges un error reportado por usuarios                     | fix            | fix(notificaciones): corrige duplicidad de avisos     |
| Solo actualizas librerías, dependencias, o cambias configs   | chore          | chore: actualiza ESLint                               |
| Mejoras el código sin modificar lo que hace                  | refactor       | refactor(api): unifica validación de datos            |
| Modificas estilos visuales o layout en frontend              | feat o chore\* | feat(ui): añade dark mode / chore(ui): ajusta padding |

\* Usa feat si es una mejora visible para el usuario, chore si es solo técnico.

---

## 3. Generar el Changelog en el Release

El changelog se genera **solo al fusionar una rama `release`** a main. Se puede automatizar con \[`standard-version`] y convenciones de commit:

### Pasos sugeridos:

1. Realiza tus commits siguiendo la guía de arriba.
2. Cuando estés listo para lanzar una versión:

   * `git flow release start 1.2.0`
3. Si usas `standard-version`, ejecuta:

   * `npm run release`
   * Esto crea o actualiza `CHANGELOG.md` solo con los commits desde la última versión/tag.
4. Finaliza el release:

   * `git flow release finish 1.2.0`
   * Esto hace merge a main y develop, y agrega el tag.
5. Sube los cambios:

   * `git push --all && git push --tags`

### Ejemplo de entrada en CHANGELOG.md

```markdown
## [1.2.0] - 2025-07-16
### 🟢 Features
- feat(api): agrega endpoint para generar reportes PDF
- feat(ui): nuevo selector de rango de fechas

### 🔴 Fixes
- fix(ventas): corrige cálculo erróneo de descuento

### 🟡 Chores
- chore: actualiza dependencias y scripts npm

### 🔵 Refactors
- refactor(core): reorganiza estructura de servicios
```

---

## 4. Consejos prácticos

* Haz commits pequeños y enfocados (un cambio, un commit).
* Usa inglés si el proyecto es colaborativo internacional; español si es interno.
* No mezcles tipos en un solo commit. Si hiciste un fix y un refactor, haz dos commits.
* Antes de hacer el release, revisa el historial con `git log --oneline` y asegúrate de que los mensajes sean claros.

---

## 5. Recursos útiles

* [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/)
* [standard-version](https://github.com/conventional-changelog/standard-version)
* [Git Flow cheatsheet](https://danielkummer.github.io/git-flow-cheatsheet/)

---

**¡Esta guía puede ser parte de tu repositorio como `COMMIT_GUIDELINES.md`!**

Cualquier duda, sugerencia o ajuste, ¡avísame y la personalizo más aún para tu equipo.

