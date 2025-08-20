-- CreateTable
CREATE TABLE "public"."Bitacora" (
    "id_bitacora" BIGSERIAL NOT NULL,
    "Tabla_Afectada" VARCHAR(500),
    "id_registros_afectados" BIGINT,
    "operacion" BIGINT,
    "Usuario_Responsable" BIGINT,
    "fecha_Hora" TIMESTAMP(6),
    "detalles" JSON,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "Bitacora_pkey" PRIMARY KEY ("id_bitacora")
);

-- CreateTable
CREATE TABLE "public"."Contrato_Docente" (
    "Id_Contrato_Docente" BIGSERIAL NOT NULL,
    "Id_Tribunal_Docente" BIGINT,
    "Id_Tipo_Contrato" BIGINT,
    "Fecha_Inicio" DATE,
    "Fecha_Fin" DATE,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "Contrato_Docente_pkey" PRIMARY KEY ("Id_Contrato_Docente")
);

-- CreateTable
CREATE TABLE "public"."Persona" (
    "Id_Persona" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR(500) NOT NULL,
    "Apellido1" VARCHAR(500) NOT NULL,
    "Apellido2" VARCHAR(500),
    "Correo" VARCHAR(500),
    "CI" VARCHAR(255),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "telefono" BIGINT,
    "delete_at" TIMESTAMPTZ(6),
    "delete_state" BOOLEAN DEFAULT false,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("Id_Persona")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "id_Rol" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR(500),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "delete_at" TIMESTAMPTZ(6),
    "delete_state" BOOLEAN DEFAULT false,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id_Rol")
);

-- CreateTable
CREATE TABLE "public"."Tipo_Contrato" (
    "Id_Tipo_Contrato" BIGSERIAL NOT NULL,
    "Nombre" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "Tipo_Contrato_pkey" PRIMARY KEY ("Id_Tipo_Contrato")
);

-- CreateTable
CREATE TABLE "public"."Tipo_Defensa" (
    "id_TipoDefensa" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR(500),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "Tipo_Defensa_pkey" PRIMARY KEY ("id_TipoDefensa")
);

-- CreateTable
CREATE TABLE "public"."Tipo_Tribunal" (
    "id_TipoTribunal" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "Tipo_Tribunal_pkey" PRIMARY KEY ("id_TipoTribunal")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "Id_Usuario" BIGSERIAL NOT NULL,
    "Nombre_Usuario" VARCHAR(500) NOT NULL,
    "Password" VARCHAR(500) NOT NULL,
    "Id_Persona" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "delete_at" TIMESTAMPTZ(6),
    "delete_state" BOOLEAN DEFAULT false,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("Id_Usuario")
);

-- CreateTable
CREATE TABLE "public"."archivos_defensa" (
    "id_archivo_defensa" BIGSERIAL NOT NULL,
    "id_defensa" BIGINT,
    "nombre_Archivo" VARCHAR(500),
    "tipo_archivo" BIGINT,
    "ruta_archivo" TEXT,
    "fecha_subida" TIMESTAMP(6),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "archivos_defensa_pkey" PRIMARY KEY ("id_archivo_defensa")
);

-- CreateTable
CREATE TABLE "public"."area" (
    "id_area" BIGSERIAL NOT NULL,
    "nombre_area" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "estado" BOOLEAN,
    "delete_at" TIMESTAMPTZ(6),
    "delete_status" BOOLEAN DEFAULT false,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id_area")
);

-- CreateTable
CREATE TABLE "public"."area_Tribunal" (
    "id_areaTribunal" BIGSERIAL NOT NULL,
    "id_Tribunal" BIGINT,
    "id_area" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "area_Tribunal_pkey" PRIMARY KEY ("id_areaTribunal")
);

-- CreateTable
CREATE TABLE "public"."carrera" (
    "id_carrera" BIGSERIAL NOT NULL,
    "nombre_carrera" VARCHAR(100) NOT NULL,
    "id_facultad" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "estado" BOOLEAN,
    "delete_at" TIMESTAMP(6),
    "delete_status" BOOLEAN DEFAULT false,

    CONSTRAINT "carrera_pkey" PRIMARY KEY ("id_carrera")
);

-- CreateTable
CREATE TABLE "public"."casos_de_estudio" (
    "id_casoEstudio" BIGSERIAL NOT NULL,
    "Nombre_Archivo" TEXT,
    "id_area" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "url" TEXT,
    "estado" BOOLEAN,
    "fecha_Subida" DATE,
    "delete_at" TIMETZ(6),
    "delete_status" BOOLEAN DEFAULT false,

    CONSTRAINT "casos_de_estudio_pkey" PRIMARY KEY ("id_casoEstudio")
);

-- CreateTable
CREATE TABLE "public"."defensa" (
    "id_defensa" BIGSERIAL NOT NULL,
    "fecha_defensa" TIMESTAMPTZ(6),
    "fecha_sorteo_area" TIMESTAMPTZ(6),
    "estado" VARCHAR NOT NULL,
    "nota" DECIMAL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "id_tipo_defensa" BIGINT NOT NULL,
    "id_estudiante" BIGINT NOT NULL,
    "id_casoEstudio" BIGINT,
    "fecha_sorteo_caso" TIMESTAMPTZ(6),
    "id_area" BIGINT,
    "aula" VARCHAR,
    "id_usuario" BIGINT,

    CONSTRAINT "defensa_pkey" PRIMARY KEY ("id_defensa")
);

-- CreateTable
CREATE TABLE "public"."documentos_generados" (
    "id_documento" BIGSERIAL NOT NULL,
    "datos" JSON,
    "id_usuario" BIGINT,
    "id_plantilla" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "documentos_generados_pkey" PRIMARY KEY ("id_documento")
);

-- CreateTable
CREATE TABLE "public"."estudiante" (
    "id_estudiante" BIGSERIAL NOT NULL,
    "nroRegistro" VARCHAR(255) DEFAULT 'SIN REGISTRO',
    "id_Persona" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "estado" VARCHAR,
    "turno_inscripcion" VARCHAR,
    "turno_moda" VARCHAR,
    "semestre_ingreso" VARCHAR,
    "semestre_ultimo" VARCHAR,
    "delete_at" TIMESTAMPTZ(6),
    "delete_state" BOOLEAN DEFAULT false,

    CONSTRAINT "estudiante_pkey" PRIMARY KEY ("id_estudiante")
);

-- CreateTable
CREATE TABLE "public"."estudiantes_materia" (
    "id_estudiante_materia" BIGSERIAL NOT NULL,
    "id_materia" BIGINT,
    "id_estudiante" BIGINT,
    "calificacion" DECIMAL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "estado" VARCHAR,
    "Gestion" VARCHAR,
    "id_horario_materia" BIGINT,

    CONSTRAINT "estudiantes_materia_pkey" PRIMARY KEY ("id_estudiante_materia")
);

-- CreateTable
CREATE TABLE "public"."facultad" (
    "id_facultad" BIGSERIAL NOT NULL,
    "nombre_facultad" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "facultad_pkey" PRIMARY KEY ("id_facultad")
);

-- CreateTable
CREATE TABLE "public"."horario_materia" (
    "id_horario" BIGSERIAL NOT NULL,
    "Modalidad" VARCHAR,
    "id_materia" BIGINT,
    "id_docente" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "turno" VARCHAR,
    "gestion" VARCHAR,
    "modulo_inicio" INTEGER,
    "grupo" VARCHAR,
    "BiModular" BOOLEAN,
    "inscritos" INTEGER,
    "confirmados" INTEGER,
    "estado" BOOLEAN,
    "modulo_fin" INTEGER,
    "horario" VARCHAR,

    CONSTRAINT "horario_materia_pkey" PRIMARY KEY ("id_horario")
);

-- CreateTable
CREATE TABLE "public"."materia" (
    "id_materia" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "cod_materia" BIGINT,
    "siglas_materia" VARCHAR,
    "creditos" INTEGER,
    "horas_totales" INTEGER,
    "id_tipo" BIGINT,
    "nombre" VARCHAR,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id_materia")
);

-- CreateTable
CREATE TABLE "public"."metadatos" (
    "id_Metadatos" BIGSERIAL NOT NULL,
    "Titulo" VARCHAR(500),
    "Autor" TEXT,
    "Tema" VARCHAR(500),
    "Fecha_Creacion" DATE,
    "Fecha_Actualizacion" DATE,
    "Typo_Archivo" VARCHAR,
    "modelo_Origen" VARCHAR,
    "Id_Origen" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "metadatos_pkey" PRIMARY KEY ("id_Metadatos")
);

-- CreateTable
CREATE TABLE "public"."plantilla_Interna" (
    "id_plantilla" BIGSERIAL NOT NULL,
    "nombre" VARCHAR,
    "contenido" TEXT,
    "version" BIGINT,
    "estado" VARCHAR(255),
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "plantilla_Interna_pkey" PRIMARY KEY ("id_plantilla")
);

-- CreateTable
CREATE TABLE "public"."tribunal_Docente" (
    "id_tribunal" BIGSERIAL NOT NULL,
    "Id_TipoTribunal" BIGINT,
    "id_Persona" BIGINT,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),
    "estado" BOOLEAN,
    "nroAgenda" VARCHAR,
    "delete_at" TIMESTAMP(6),
    "delete_state" BOOLEAN DEFAULT false,

    CONSTRAINT "tribunal_Docente_pkey" PRIMARY KEY ("id_tribunal")
);

-- CreateTable
CREATE TABLE "public"."tribunal_defensa" (
    "id_tribunalDefensa" BIGSERIAL NOT NULL,
    "fecha_Asignacion" BIGINT NOT NULL,
    "id_tribunal" BIGINT,
    "id_defensa" BIGINT NOT NULL,
    "created_at" TIMESTAMP(6),
    "updated_at" TIMESTAMP(6),

    CONSTRAINT "tribunal_defensa_pkey" PRIMARY KEY ("id_tribunalDefensa")
);

-- CreateTable
CREATE TABLE "public"."estudiante_Carrera" (
    "Id_CarreraEstudiante" BIGSERIAL NOT NULL,
    "Id_Estudiante" BIGINT,
    "Id_Carrera" BIGINT,

    CONSTRAINT "Id_CarreraEstudiante" PRIMARY KEY ("Id_CarreraEstudiante")
);

-- CreateTable
CREATE TABLE "public"."Modulos" (
    "Id_Modulo" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR,

    CONSTRAINT "Modulos_pkey" PRIMARY KEY ("Id_Modulo")
);

-- CreateTable
CREATE TABLE "public"."Permisos" (
    "Id_Permiso" BIGSERIAL NOT NULL,
    "Nombre" VARCHAR,
    "Descripcion" VARCHAR,

    CONSTRAINT "Permisos_pkey" PRIMARY KEY ("Id_Permiso")
);

-- CreateTable
CREATE TABLE "public"."Usuario_Rol" (
    "Id_Usuario_Rol" BIGSERIAL NOT NULL,
    "Id_Usuario" BIGINT,
    "Id_Rol" BIGINT,

    CONSTRAINT "Id_Usuario_Rol" PRIMARY KEY ("Id_Usuario_Rol")
);

-- CreateTable
CREATE TABLE "public"."rol_Modulo_Permiso" (
    "Id_Permiso_Modulo" BIGSERIAL NOT NULL,
    "Id_Modulo" BIGINT,
    "Id_Permiso" BIGINT,
    "Id_Rol" BIGINT,

    CONSTRAINT " Id_Permiso_Modulo" PRIMARY KEY ("Id_Permiso_Modulo")
);

-- CreateTable
CREATE TABLE "public"."carrera_Area" (
    "Id_CarreraArea" BIGSERIAL NOT NULL,
    "Id_Carrera" BIGINT,
    "Id_Area" BIGINT,

    CONSTRAINT " Id_CarreraArea" PRIMARY KEY ("Id_CarreraArea")
);

-- CreateTable
CREATE TABLE "public"."materia_carrera" (
    "id_materiaCarrera" BIGSERIAL NOT NULL,
    "id_materia" BIGINT,
    "id_carrera" BIGINT,
    "semestre" VARCHAR,
    "numero_pensum" BIGINT,

    CONSTRAINT "materia_carrera_pkey" PRIMARY KEY ("id_materiaCarrera")
);

-- CreateTable
CREATE TABLE "public"."materia_preRequisito" (
    "id_materiaPrerequisito" BIGSERIAL NOT NULL,
    "id_materia" BIGINT,
    "id_materia_preRequisito" BIGINT,
    "total_materia" INTEGER,

    CONSTRAINT "materia_preRequisito_pkey" PRIMARY KEY ("id_materiaPrerequisito")
);

-- CreateTable
CREATE TABLE "public"."tipo_materia" (
    "id_tipo" BIGSERIAL NOT NULL,
    "nombre" VARCHAR,

    CONSTRAINT "tipo_materia_pkey" PRIMARY KEY ("id_tipo")
);

-- CreateTable
CREATE TABLE "public"."equivalencias_materia" (
    "id_equivalencia" BIGSERIAL NOT NULL,
    "id_materia_Origen" BIGSERIAL NOT NULL,
    "id_materia_equivalente" BIGSERIAL NOT NULL,

    CONSTRAINT "equivalencias_materia_pkey" PRIMARY KEY ("id_equivalencia")
);

-- CreateTable
CREATE TABLE "public"."usuario_Carrera" (
    "Id_usuario_carrera" BIGSERIAL NOT NULL,
    "Id_usuario" BIGINT,
    "Id_carrera" BIGINT,

    CONSTRAINT "rol_Carrera_pkey" PRIMARY KEY ("Id_usuario_carrera")
);

-- CreateTable
CREATE TABLE "public"."modulo_periodo" (
    "id_modulo_Periodo" BIGSERIAL NOT NULL,
    "gestion" VARCHAR,
    "modulo" VARCHAR,
    "fecha_Inicio" DATE,
    "fecha_Fin" DATE,
    "modalidad" VARCHAR,
    "created_at " TIMESTAMP(6),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "modulo_periodo_pkey" PRIMARY KEY ("id_modulo_Periodo")
);

-- CreateTable
CREATE TABLE "public"."whatsapp_sessions" (
    "id" BIGSERIAL NOT NULL,
    "session_id" VARCHAR(100) NOT NULL,
    "zip_data" BYTEA NOT NULL,
    "data" JSON NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6),

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_Nombre_Usuario_key" ON "public"."Usuario"("Nombre_Usuario");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_est_mat_gestion" ON "public"."estudiantes_materia"("id_estudiante", "id_materia", "Gestion");

-- CreateIndex
CREATE UNIQUE INDEX "facultad_nombre_facultad_key" ON "public"."facultad"("nombre_facultad");

-- CreateIndex
CREATE UNIQUE INDEX "unique_cod_materia" ON "public"."materia"("cod_materia");

-- CreateIndex
CREATE UNIQUE INDEX "rol_Modulo_Permiso_Id_Rol_Id_Modulo_Id_Permiso_key" ON "public"."rol_Modulo_Permiso"("Id_Rol", "Id_Modulo", "Id_Permiso");

-- CreateIndex
CREATE UNIQUE INDEX "rol_Carrera_Id_rol_Id_carrera_key" ON "public"."usuario_Carrera"("Id_usuario", "Id_carrera");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_session_id_key" ON "public"."whatsapp_sessions"("session_id");

-- AddForeignKey
ALTER TABLE "public"."Contrato_Docente" ADD CONSTRAINT "Contrato_Docente_Id_Tipo_Contrato_fkey" FOREIGN KEY ("Id_Tipo_Contrato") REFERENCES "public"."Tipo_Contrato"("Id_Tipo_Contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Contrato_Docente" ADD CONSTRAINT "Contrato_Docente_Id_Tribunal_Docente_fkey" FOREIGN KEY ("Id_Tribunal_Docente") REFERENCES "public"."tribunal_Docente"("id_tribunal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_Id_Persona_fkey" FOREIGN KEY ("Id_Persona") REFERENCES "public"."Persona"("Id_Persona") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."archivos_defensa" ADD CONSTRAINT "archivos_defensa_id_defensa_fkey" FOREIGN KEY ("id_defensa") REFERENCES "public"."defensa"("id_defensa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."area_Tribunal" ADD CONSTRAINT "area_Tribunal_id_Tribunal_fkey" FOREIGN KEY ("id_Tribunal") REFERENCES "public"."tribunal_Docente"("id_tribunal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."area_Tribunal" ADD CONSTRAINT "area_Tribunal_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."area"("id_area") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."carrera" ADD CONSTRAINT "carrera_id_facultad_fkey" FOREIGN KEY ("id_facultad") REFERENCES "public"."facultad"("id_facultad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."casos_de_estudio" ADD CONSTRAINT "casos_de_estudio_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."area"("id_area") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."defensa" ADD CONSTRAINT "defensa_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."area"("id_area") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."defensa" ADD CONSTRAINT "defensa_id_casoEstudio_fkey" FOREIGN KEY ("id_casoEstudio") REFERENCES "public"."casos_de_estudio"("id_casoEstudio") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."defensa" ADD CONSTRAINT "defensa_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "public"."estudiante"("id_estudiante") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."defensa" ADD CONSTRAINT "defensa_id_tipo_defensa_fkey" FOREIGN KEY ("id_tipo_defensa") REFERENCES "public"."Tipo_Defensa"("id_TipoDefensa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."defensa" ADD CONSTRAINT "id_usuario_fk" FOREIGN KEY ("id_usuario") REFERENCES "public"."Usuario"("Id_Usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."documentos_generados" ADD CONSTRAINT "documentos_generados_id_plantilla_fkey" FOREIGN KEY ("id_plantilla") REFERENCES "public"."plantilla_Interna"("id_plantilla") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."documentos_generados" ADD CONSTRAINT "documentos_generados_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."Usuario"("Id_Usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiante" ADD CONSTRAINT "estudiante_id_Persona_fkey" FOREIGN KEY ("id_Persona") REFERENCES "public"."Persona"("Id_Persona") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiantes_materia" ADD CONSTRAINT "estudiante_materia_id_horario_materia_fkey" FOREIGN KEY ("id_horario_materia") REFERENCES "public"."horario_materia"("id_horario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiantes_materia" ADD CONSTRAINT "estudiantes_materia_id_estudiante_fkey" FOREIGN KEY ("id_estudiante") REFERENCES "public"."estudiante"("id_estudiante") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiantes_materia" ADD CONSTRAINT "estudiantes_materia_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."horario_materia" ADD CONSTRAINT "horario_materia_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "public"."tribunal_Docente"("id_tribunal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."horario_materia" ADD CONSTRAINT "horario_materia_id_materia_fkey" FOREIGN KEY ("id_materia") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."materia" ADD CONSTRAINT "id_tipoMateria" FOREIGN KEY ("id_tipo") REFERENCES "public"."tipo_materia"("id_tipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tribunal_Docente" ADD CONSTRAINT "tribunal_Docente_Id_TipoTribunal_fkey" FOREIGN KEY ("Id_TipoTribunal") REFERENCES "public"."Tipo_Tribunal"("id_TipoTribunal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tribunal_Docente" ADD CONSTRAINT "tribunal_Docente_id_Persona_fkey" FOREIGN KEY ("id_Persona") REFERENCES "public"."Persona"("Id_Persona") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tribunal_defensa" ADD CONSTRAINT "tribunal_defensa_id_defensa_fkey" FOREIGN KEY ("id_defensa") REFERENCES "public"."defensa"("id_defensa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."tribunal_defensa" ADD CONSTRAINT "tribunal_defensa_id_tribunal_fkey" FOREIGN KEY ("id_tribunal") REFERENCES "public"."tribunal_Docente"("id_tribunal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiante_Carrera" ADD CONSTRAINT "Id_Carrera" FOREIGN KEY ("Id_Carrera") REFERENCES "public"."carrera"("id_carrera") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."estudiante_Carrera" ADD CONSTRAINT "Id_Estudiante" FOREIGN KEY ("Id_Estudiante") REFERENCES "public"."estudiante"("id_estudiante") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Id_Rol" FOREIGN KEY ("Id_Rol") REFERENCES "public"."Rol"("id_Rol") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."Usuario_Rol" ADD CONSTRAINT "Id_Usuario" FOREIGN KEY ("Id_Usuario") REFERENCES "public"."Usuario"("Id_Usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol_Modulo_Permiso" ADD CONSTRAINT "Id_Modulo" FOREIGN KEY ("Id_Modulo") REFERENCES "public"."Modulos"("Id_Modulo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol_Modulo_Permiso" ADD CONSTRAINT "Id_Permiso" FOREIGN KEY ("Id_Permiso") REFERENCES "public"."Permisos"("Id_Permiso") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."rol_Modulo_Permiso" ADD CONSTRAINT "Id_Rol" FOREIGN KEY ("Id_Rol") REFERENCES "public"."Rol"("id_Rol") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."carrera_Area" ADD CONSTRAINT "Id_Area" FOREIGN KEY ("Id_Area") REFERENCES "public"."area"("id_area") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."carrera_Area" ADD CONSTRAINT "Id_Carrera" FOREIGN KEY ("Id_Carrera") REFERENCES "public"."carrera"("id_carrera") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."materia_carrera" ADD CONSTRAINT "id_carrera" FOREIGN KEY ("id_carrera") REFERENCES "public"."carrera"("id_carrera") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."materia_carrera" ADD CONSTRAINT "id_materia" FOREIGN KEY ("id_materia") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."materia_preRequisito" ADD CONSTRAINT "id_materia" FOREIGN KEY ("id_materia") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."materia_preRequisito" ADD CONSTRAINT "id_materia_preRequisito" FOREIGN KEY ("id_materia_preRequisito") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."equivalencias_materia" ADD CONSTRAINT "id_materia_equivalente" FOREIGN KEY ("id_materia_equivalente") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."equivalencias_materia" ADD CONSTRAINT "id_materia_origen" FOREIGN KEY ("id_materia_Origen") REFERENCES "public"."materia"("id_materia") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."usuario_Carrera" ADD CONSTRAINT "id_carrera" FOREIGN KEY ("Id_carrera") REFERENCES "public"."carrera"("id_carrera") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."usuario_Carrera" ADD CONSTRAINT "id_usaurioCarrera" FOREIGN KEY ("Id_usuario") REFERENCES "public"."Usuario"("Id_Usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;
