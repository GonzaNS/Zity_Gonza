-- ============================================================
-- Sprint 12 · HU-ANUNCIO-01 · Modelado BD del Tablón de anuncios
-- Migración 013 (nominal): anuncios / anuncio_lecturas + RLS + bucket
-- ============================================================
-- Diseño (ADR-016 modelo + ADR-017 sanitización/aviso):
--   • anuncios: tablón oficial del edificio. La baja es LÓGICA (archivado=true),
--     nunca DELETE — sale del tablón pero queda en el histórico (R7).
--   • anuncio_lecturas: PK compuesta (anuncio_id, residente_id). Es la ÚNICA
--     fuente de verdad del badge 'no leído'; el contador se recalcula desde BD (R3).
--   • RLS por rol: SELECT para cualquier autenticado (residente y técnico leen),
--     pero residente/técnico solo ven los VIGENTES y no archivados; el admin ve
--     todo. INSERT/UPDATE solo admin (A01 del chore OWASP). Sin DELETE.
--   • Sanitización en servidor (A03): el cuerpo/título pasan por
--     sanitizar_texto_publicado() en un trigger BEFORE — se neutraliza HTML/script
--     antes de guardar, por ser contenido publicado que ven todos (R1).
--   • Aviso Realtime: solo 'importante'/'urgente' insertan notificación por
--     residente (reusa el canal del S6); los 'normal' no notifican (R5).
--   • Bucket anuncios-adjuntos (privado, JPEG/PNG/PDF, 2 MB): admin escribe,
--     lectura autenticada. Reusa el patrón de productos-fotos (S10) / solicitudes (S3).
--   • auth.uid() / get_user_rol() envueltos en (select …) por el initPlan (docs/db/rls.md §5).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Tipos Enum
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.anuncio_categoria AS ENUM ('aviso','mantenimiento','asamblea','seguridad','general');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.anuncio_prioridad AS ENUM ('normal','importante','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────
-- PARTE B: Función de sanitización de contenido publicado (A03)
-- ────────────────────────────────────────────────────────────
-- Patrón reutilizable (Retro S12 · Acción 2 — docs/security/sanitizacion.md):
-- toda entrada que se publique y se renderice a otros usuarios pasa por aquí.
-- Neutraliza HTML/script antes de persistir; el front además renderiza con
-- react-markdown sin HTML crudo (defensa en profundidad).
CREATE OR REPLACE FUNCTION public.sanitizar_texto_publicado(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_texto IS NULL THEN NULL ELSE
    btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(p_texto, '(?is)<(script|style|iframe|object|embed)[^>]*>.*?</\1>', '', 'g'),
          '<[^>]*>', '', 'g'
        ),
        '(?i)(javascript|vbscript|data)\s*:', '', 'g'
      )
    )
  END;
$$;

COMMENT ON FUNCTION public.sanitizar_texto_publicado(text) IS
  'Sprint 12 · Chore OWASP A03 — Neutraliza HTML/script y esquemas peligrosos de texto '
  'publicado (anuncios, comentarios futuros). Patrón Retro S12 · Acción 2.';

-- ────────────────────────────────────────────────────────────
-- PARTE C: Tabla anuncios
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anuncios (
  id            uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text                       NOT NULL CHECK (length(trim(titulo)) > 0),
  cuerpo        text                       NOT NULL CHECK (length(trim(cuerpo)) > 0),
  categoria     public.anuncio_categoria   NOT NULL DEFAULT 'general',
  prioridad     public.anuncio_prioridad   NOT NULL DEFAULT 'normal',
  imagen_url    text,
  fijado        boolean                    NOT NULL DEFAULT false,
  vigente_hasta date,
  archivado     boolean                    NOT NULL DEFAULT false,
  publicado_por uuid                       REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at    timestamptz                NOT NULL DEFAULT now(),
  updated_at    timestamptz                NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.anuncios IS
  'Sprint 12 · HU-ANUNCIO-01 — Tablón de anuncios del edificio. Baja lógica (archivado=true), '
  'nunca DELETE. El cuerpo admite markdown limitado, sanitizado en servidor (A03).';
COMMENT ON COLUMN public.anuncios.imagen_url IS
  'Path dentro del bucket anuncios-adjuntos (no URL pública). Imagen o PDF; se firma al mostrar.';
COMMENT ON COLUMN public.anuncios.vigente_hasta IS
  'Fecha (America/Lima) tras la cual el anuncio sale del tablón. NULL = sin caducidad.';
COMMENT ON COLUMN public.anuncios.archivado IS
  'Baja lógica: lo retira del tablón pero lo conserva en el histórico (R7).';

-- ────────────────────────────────────────────────────────────
-- PARTE D: Tabla anuncio_lecturas (fuente de verdad del 'no leído')
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.anuncio_lecturas (
  anuncio_id   uuid        NOT NULL REFERENCES public.anuncios(id) ON DELETE CASCADE,
  residente_id uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  leido_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (anuncio_id, residente_id)
);

COMMENT ON TABLE public.anuncio_lecturas IS
  'Sprint 12 · HU-ANUNCIO-03 — Estado de lectura por residente. PK compuesta; '
  'fuente de verdad del badge no leído (el contador se recalcula desde BD, R3).';

-- ────────────────────────────────────────────────────────────
-- PARTE E: Índices (FKs indexadas + orden del feed)
-- ────────────────────────────────────────────────────────────
-- Feed del residente: vigentes y no archivados.
CREATE INDEX IF NOT EXISTS anuncios_feed_idx
  ON public.anuncios (archivado, vigente_hasta);
-- Orden del tablón: fijados arriba, luego por fecha.
CREATE INDEX IF NOT EXISTS anuncios_orden_idx
  ON public.anuncios (fijado DESC, created_at DESC);
-- FK publicado_por (evita el advisor unindexed_foreign_keys).
CREATE INDEX IF NOT EXISTS anuncios_publicado_por_idx
  ON public.anuncios (publicado_por);
-- anuncio_lecturas por residente (badge de no leídos + RLS).
CREATE INDEX IF NOT EXISTS anuncio_lecturas_residente_idx
  ON public.anuncio_lecturas (residente_id);

-- ────────────────────────────────────────────────────────────
-- PARTE F: Triggers
-- ────────────────────────────────────────────────────────────
-- F.1 — updated_at (reusa public.set_updated_at del S8)
DROP TRIGGER IF EXISTS anuncios_set_updated_at ON public.anuncios;
CREATE TRIGGER anuncios_set_updated_at
  BEFORE UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- F.2 — Sanitización del contenido publicado (A03), antes de guardar.
CREATE OR REPLACE FUNCTION public.before_anuncio_sanitizar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- El título queda en una sola línea; el cuerpo conserva los saltos (markdown).
  NEW.titulo := btrim(regexp_replace(public.sanitizar_texto_publicado(NEW.titulo), '\s+', ' ', 'g'));
  NEW.cuerpo := public.sanitizar_texto_publicado(NEW.cuerpo);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_anuncio_sanitizar ON public.anuncios;
CREATE TRIGGER before_anuncio_sanitizar
  BEFORE INSERT OR UPDATE OF titulo, cuerpo ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.before_anuncio_sanitizar();

REVOKE ALL ON FUNCTION public.before_anuncio_sanitizar() FROM anon, authenticated, public;

-- F.3 — Aviso Realtime al publicar: notificación por residente (reusa S6).
-- Solo 'importante'/'urgente' notifican (R5: evita spam). Best-effort.
CREATE OR REPLACE FUNCTION public.after_anuncio_publicado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archivado OR NEW.prioridad NOT IN ('importante','urgente') THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notificaciones (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    SELECT u.id, NULL, 'anuncio_nuevo',
           CASE WHEN NEW.prioridad = 'urgente' THEN 'Anuncio urgente: ' ELSE 'Nuevo anuncio: ' END || NEW.titulo,
           'La administración publicó un comunicado de ' || lower(NEW.categoria::text) || '. Toca para leerlo.',
           false,
           jsonb_build_object('anuncio_id', NEW.id, 'categoria', NEW.categoria::text, 'prioridad', NEW.prioridad::text)
    FROM public.usuarios u
    WHERE u.rol = 'residente' AND u.estado_cuenta = 'activo';
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_anuncio_publicado falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_anuncio_publicado ON public.anuncios;
CREATE TRIGGER after_anuncio_publicado
  AFTER INSERT ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.after_anuncio_publicado();

REVOKE ALL ON FUNCTION public.after_anuncio_publicado() FROM anon, authenticated, public;

-- F.4 — Auditoría de alta/edición/archivado (patrón log_producto_cambio del S10).
CREATE OR REPLACE FUNCTION public.log_anuncio_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_accion   text;
  v_detalles jsonb;
BEGIN
  IF v_actor IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  IF TG_OP = 'INSERT' THEN
    v_accion   := 'crear_anuncio';
    v_detalles := jsonb_build_object('categoria', NEW.categoria::text, 'prioridad', NEW.prioridad::text, 'fijado', NEW.fijado);
  ELSE
    IF OLD.archivado = false AND NEW.archivado = true THEN
      v_accion := 'archivar_anuncio';
    ELSE
      v_accion := 'editar_anuncio';
    END IF;
    v_detalles := jsonb_build_object(
      'categoria', NEW.categoria::text, 'prioridad', NEW.prioridad::text,
      'fijado', NEW.fijado, 'archivado', NEW.archivado);
  END IF;

  BEGIN
    INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
    VALUES (v_actor, v_accion, 'anuncios', NEW.id, v_detalles, 'exitoso');
  EXCEPTION WHEN others THEN
    RAISE WARNING 'log_anuncio_cambio falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_anuncio_cambio ON public.anuncios;
CREATE TRIGGER after_anuncio_cambio
  AFTER INSERT OR UPDATE ON public.anuncios
  FOR EACH ROW EXECUTE FUNCTION public.log_anuncio_cambio();

REVOKE ALL ON FUNCTION public.log_anuncio_cambio() FROM anon, authenticated, public;

-- ────────────────────────────────────────────────────────────
-- PARTE G: Catálogo de auditoría + dominio de notificaciones
-- ────────────────────────────────────────────────────────────
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle) VALUES
  ('crear_anuncio',    'Publicación de un comunicado en el tablón', true),
  ('editar_anuncio',   'Edición de un comunicado del tablón',       true),
  ('archivar_anuncio', 'Archivado (baja lógica) de un comunicado',  false)
ON CONFLICT (codigo) DO NOTHING;

-- Ampliar el CHECK de notificaciones.tipo con 'anuncio_nuevo' (patrón S9 · Parte D).
DO $$
DECLARE cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public' AND rel.relname = 'notificaciones'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%tipo%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.notificaciones DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'estado_cambio',
    'asignacion',
    'nueva_solicitud',
    'sistema',
    'alerta_rechazo',
    'factura_nueva',
    'factura_pagada',
    'factura_por_vencer',
    'anuncio_nuevo'        -- Sprint 12 · HU-ANUNCIO-04
  ]));

-- ────────────────────────────────────────────────────────────
-- PARTE H: Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.anuncios        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anuncio_lecturas ENABLE ROW LEVEL SECURITY;

-- anuncios ───────────────────────────────────────────────────
-- SELECT: admin ve todo; residente/técnico solo vigentes y no archivados (A01 + R7).
DROP POLICY IF EXISTS anuncios_select ON public.anuncios;
CREATE POLICY anuncios_select
  ON public.anuncios FOR SELECT TO authenticated
  USING (
    (select public.get_user_rol()) = 'admin'
    OR (
      archivado = false
      AND (vigente_hasta IS NULL OR vigente_hasta >= (now() AT TIME ZONE 'America/Lima')::date)
    )
  );

-- INSERT / UPDATE: solo admin (A01). Sin DELETE → baja lógica (archivado).
DROP POLICY IF EXISTS anuncios_admin_insert ON public.anuncios;
CREATE POLICY anuncios_admin_insert
  ON public.anuncios FOR INSERT TO authenticated
  WITH CHECK ((select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS anuncios_admin_update ON public.anuncios;
CREATE POLICY anuncios_admin_update
  ON public.anuncios FOR UPDATE TO authenticated
  USING  ((select public.get_user_rol()) = 'admin')
  WITH CHECK ((select public.get_user_rol()) = 'admin');

-- anuncio_lecturas ───────────────────────────────────────────
-- Cada residente solo la suya (lee y registra). Sin UPDATE/DELETE.
DROP POLICY IF EXISTS anuncio_lecturas_select ON public.anuncio_lecturas;
CREATE POLICY anuncio_lecturas_select
  ON public.anuncio_lecturas FOR SELECT TO authenticated
  USING (residente_id = (select auth.uid()));

DROP POLICY IF EXISTS anuncio_lecturas_insert ON public.anuncio_lecturas;
CREATE POLICY anuncio_lecturas_insert
  ON public.anuncio_lecturas FOR INSERT TO authenticated
  WITH CHECK (residente_id = (select auth.uid()));

-- ────────────────────────────────────────────────────────────
-- PARTE I: Realtime — feed y badge en vivo
-- ────────────────────────────────────────────────────────────
-- El cliente se suscribe a postgres_changes sobre anuncios; la RLS filtra por
-- usuario (residente/técnico solo reciben vigentes/no archivados). Reusa el
-- websocket multiplexado del S6 (una sola conexión por usuario, ADR-009).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.anuncios;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- anuncio_lecturas también: el badge de 'no leídos' del residente baja en vivo
-- cuando registra una lectura (la RLS/filtro entrega solo las propias).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.anuncio_lecturas;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────
-- PARTE J: Bucket anuncios-adjuntos + políticas de Storage
-- ────────────────────────────────────────────────────────────
-- Privado (JPEG/PNG/PDF, 2 MB). Admin escribe; lectura para cualquier autenticado
-- (control efectivo por URLs firmadas, igual que productos-fotos / solicitudes-fotos).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('anuncios-adjuntos', 'anuncios-adjuntos', false, 2097152,
        ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = EXCLUDED.public;

DROP POLICY IF EXISTS anuncios_adjuntos_admin_insert ON storage.objects;
CREATE POLICY anuncios_adjuntos_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anuncios-adjuntos' AND (select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS anuncios_adjuntos_select_authenticated ON storage.objects;
CREATE POLICY anuncios_adjuntos_select_authenticated
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'anuncios-adjuntos');

DROP POLICY IF EXISTS anuncios_adjuntos_admin_update ON storage.objects;
CREATE POLICY anuncios_adjuntos_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'anuncios-adjuntos' AND (select public.get_user_rol()) = 'admin')
  WITH CHECK (bucket_id = 'anuncios-adjuntos' AND (select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS anuncios_adjuntos_admin_delete ON storage.objects;
CREATE POLICY anuncios_adjuntos_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'anuncios-adjuntos' AND (select public.get_user_rol()) = 'admin');
