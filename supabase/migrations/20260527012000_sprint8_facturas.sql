-- ============================================================
-- Sprint 8 · HU-FACT-01 · Modelado BD de Facturas
-- Migración 009: tabla facturas + enums + RLS + trigger
-- ============================================================
-- Diseño:
--   • Enums PostgreSQL nativos para tipo y estado (validan en BD,
--     evitan magic strings y permiten exhaustive checks en TS).
--   • UNIQUE(residente_id, tipo, periodo) impide duplicar el
--     mismo concepto en el mismo mes (ej: dos facturas de luz en 2026-05).
--   • RLS granular por rol: residente solo lee las suyas;
--     admin lee/escribe todas; técnico sin acceso (sin política → denied).
--   • Trigger after_factura_inserted emite notificación tipo='factura_nueva'
--     reutilizando el canal Realtime del Sprint 6. SECURITY DEFINER para
--     poder escribir en notificaciones de otros usuarios (igual que S6).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Tipos Enum
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.factura_tipo AS ENUM ('luz','agua','pension','multa');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.factura_estado AS ENUM ('pendiente','pagada','vencida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────
-- PARTE B: Tabla facturas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.facturas (
  id            uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id  uuid                    NOT NULL
                  REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo          public.factura_tipo     NOT NULL,
  monto         numeric(10,2)          NOT NULL CHECK (monto >= 0),
  periodo       text                   NOT NULL
                  CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),  -- 'YYYY-MM'
  fecha_emision date                   NOT NULL DEFAULT CURRENT_DATE,
  vencimiento   date                   NOT NULL,
  estado        public.factura_estado  NOT NULL DEFAULT 'pendiente',
  descripcion   text,
  created_at    timestamptz            NOT NULL DEFAULT now(),
  updated_at    timestamptz            NOT NULL DEFAULT now(),

  -- Garantiza que no se emita dos veces el mismo concepto en el mismo mes
  CONSTRAINT facturas_residente_tipo_periodo_key
    UNIQUE (residente_id, tipo, periodo),

  -- La fecha de vencimiento no puede ser anterior a la emisión
  CONSTRAINT facturas_vencimiento_check
    CHECK (vencimiento >= fecha_emision)
);

COMMENT ON TABLE public.facturas IS
  'Sprint 8 · HU-FACT-01 — Facturas emitidas por el administrador. '
  'Soporte futuro: Tienda S11, Dashboard ejecutivo S14.';

COMMENT ON COLUMN public.facturas.periodo IS 'Mes facturado en formato YYYY-MM, ej: 2026-05';
COMMENT ON COLUMN public.facturas.monto   IS 'Monto en moneda local, máximo 99,999,999.99';

-- ────────────────────────────────────────────────────────────
-- PARTE C: Índices
-- ────────────────────────────────────────────────────────────
-- Soporta el filtro principal del residente: "mis facturas pendientes/vencidas"
CREATE INDEX IF NOT EXISTS facturas_residente_vencimiento_idx
  ON public.facturas (residente_id, vencimiento);

-- Soporta el filtro del admin: "todas las facturas vencidas"
CREATE INDEX IF NOT EXISTS facturas_estado_idx
  ON public.facturas (estado);

-- Trigger updated_at automático (patrón del proyecto)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS facturas_set_updated_at ON public.facturas;
CREATE TRIGGER facturas_set_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PARTE D: Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;

-- RESIDENTE: solo puede ver sus propias facturas (no INSERT/UPDATE)
CREATE POLICY facturas_residente_select
  ON public.facturas
  FOR SELECT
  TO authenticated
  USING (
    residente_id = auth.uid()
    AND (auth.jwt() -> 'app_metadata' ->> 'rol') = 'residente'
  );

-- ADMIN: acceso completo (SELECT + INSERT + UPDATE; no DELETE por auditoría)
CREATE POLICY facturas_admin_select
  ON public.facturas
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

CREATE POLICY facturas_admin_insert
  ON public.facturas
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

CREATE POLICY facturas_admin_update
  ON public.facturas
  FOR UPDATE
  TO authenticated
  USING  ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'rol') = 'admin');

-- TÉCNICO: sin política → RLS deniega automáticamente (sin acceso a facturas)

-- ────────────────────────────────────────────────────────────
-- PARTE E: Ampliar CHECK de notificaciones.tipo
-- ────────────────────────────────────────────────────────────
-- Añadimos 'factura_nueva' al dominio de tipos de notificación,
-- siguiendo el mismo patrón idempotente del Sprint 6.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'notificaciones'
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
    'factura_nueva'    -- Sprint 8 · HU-FACT-01
  ]));

-- ────────────────────────────────────────────────────────────
-- PARTE F: Trigger after_factura_inserted
-- ────────────────────────────────────────────────────────────
-- Inserta una notificación al residente cada vez que el admin emite
-- una nueva factura. Reutiliza el canal Realtime del Sprint 6.
-- SECURITY DEFINER → corre como el owner (postgres), lo que le
-- permite insertar en notificaciones de otro usuario sin violar RLS.
-- El bloque EXCEPTION garantiza que un error en la notificación
-- nunca revierta el INSERT de la factura (best-effort, igual que S6).

CREATE OR REPLACE FUNCTION public.after_factura_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo_label text;
  v_titulo     text;
  v_mensaje    text;
BEGIN
  BEGIN
    v_tipo_label := CASE NEW.tipo
      WHEN 'luz'      THEN 'Electricidad'
      WHEN 'agua'     THEN 'Agua'
      WHEN 'pension'  THEN 'Pensión'
      WHEN 'multa'    THEN 'Multa'
      ELSE NEW.tipo::text
    END;

    v_titulo  := 'Nueva factura emitida: ' || v_tipo_label;
    v_mensaje := 'Se emitió una factura de ' || v_tipo_label
              || ' por $' || NEW.monto::text
              || ' correspondiente al período ' || NEW.periodo
              || '. Vence el ' || to_char(NEW.vencimiento, 'DD/MM/YYYY') || '.';

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida)
    VALUES
      (NEW.residente_id, NULL, 'factura_nueva', v_titulo, v_mensaje, false);

  EXCEPTION WHEN others THEN
    -- Best-effort: la notificación no debe revertir el INSERT de la factura.
    RAISE WARNING 'after_factura_inserted falló: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_factura_inserted ON public.facturas;

CREATE TRIGGER after_factura_inserted
  AFTER INSERT ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.after_factura_inserted();

-- Seguridad: función de trigger — no exponer como RPC invocable.
REVOKE ALL ON FUNCTION public.after_factura_inserted()
  FROM anon, authenticated, public;

-- ────────────────────────────────────────────────────────────
-- Comentarios de referencia para integraciones futuras
-- ────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.after_factura_inserted() IS
  'Sprint 8 · HU-FACT-01 — Trigger AFTER INSERT en facturas. '
  'Inserta notificación tipo=factura_nueva para el residente via canal Realtime S6. '
  'Integración futura: Tienda S11 podrá leer facturas con estado=pendiente; '
  'Dashboard ejecutivo S14 puede agregar montos por tipo/período.';
