-- ============================================================
-- Sprint 9 · Facturación v2 · Migración 010
-- ============================================================
-- Cierra el ciclo de cobro:
--   • Marcar factura como pagada (RPC idempotente + audit + trigger notif).
--   • Job diario (pg_cron 06:00 America/Lima) en dos pasadas:
--       1) marca 'vencida' las pendientes con vencimiento pasado;
--       2) recordatorio 'factura_por_vencer' 3 días antes (idempotente).
--   • RPC de totales del periodo (suma 100% en servidor, numeric(10,2)).
--
-- Convenciones (docs/conventions.md):
--   • Todo cálculo de fecha del job usa America/Lima, no UTC.
--   • Los montos se suman en servidor (numeric), nunca en JS.
--   • RPCs SECURITY DEFINER con verificación de rol admin (patrón S8).
--   • Notificaciones/email best-effort (EXCEPTION) — nunca revierten la operación.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Extensión pg_net (email fire-and-forget del cron)
-- ────────────────────────────────────────────────────────────
-- El recordatorio in-app (Realtime) NO depende de pg_net; el email sí.
-- Si la extensión falla al instalarse, la migración no debe abortar.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'No se pudo habilitar pg_net (el email del cron correrá en best-effort): %', SQLERRM;
END $$;

-- ────────────────────────────────────────────────────────────
-- PARTE B: Columnas de pago + idempotencia del recordatorio
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS fecha_pago           date,
  ADD COLUMN IF NOT EXISTS metodo_pago          text,
  ADD COLUMN IF NOT EXISTS registrado_por       uuid
    REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recordatorio_enviado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.facturas.fecha_pago     IS 'Sprint 9 · HU-FACT-04 — Fecha en que el admin registró el pago.';
COMMENT ON COLUMN public.facturas.metodo_pago    IS 'Sprint 9 · HU-FACT-04 — efectivo | transferencia | otro.';
COMMENT ON COLUMN public.facturas.registrado_por IS 'Sprint 9 · HU-FACT-04 — Admin que registró el pago (auth.uid()).';
COMMENT ON COLUMN public.facturas.recordatorio_enviado IS 'Sprint 9 · HU-FACT-08 — Evita recordatorios duplicados si el cron corre dos veces (R1).';

-- CHECK de método de pago (idempotente)
DO $$ BEGIN
  ALTER TABLE public.facturas
    ADD CONSTRAINT facturas_metodo_pago_check
    CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo','transferencia','otro'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Índice por (estado, vencimiento) — soporta la pasada 1 del cron y el filtro 'Vencidas'.
CREATE INDEX IF NOT EXISTS facturas_estado_vencimiento_idx
  ON public.facturas (estado, vencimiento);

-- ────────────────────────────────────────────────────────────
-- PARTE C: Catálogo de auditoría — nueva acción
-- ────────────────────────────────────────────────────────────
-- audit_log.accion tiene FK a audit_acciones; registramos la acción
-- antes de que la RPC inserte en audit_log.
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle)
VALUES ('registrar_pago_factura', 'Registro de pago de una factura', true)
ON CONFLICT (codigo) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- PARTE D: Ampliar dominio de notificaciones.tipo
-- ────────────────────────────────────────────────────────────
-- Patrón idempotente del S8: localizar el CHECK actual, eliminarlo y recrearlo
-- con los dos nuevos tipos del Sprint 9.
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
    'factura_pagada',     -- Sprint 9 · HU-FACT-04
    'factura_por_vencer'  -- Sprint 9 · HU-FACT-08
  ]));

-- ────────────────────────────────────────────────────────────
-- PARTE E: RPC registrar_pago_factura — transición idempotente + audit
-- ────────────────────────────────────────────────────────────
-- Centraliza TODA la transición a 'pagada' (HU-FACT-04). Idempotente (R3):
-- si ya está pagada, no reescribe fecha_pago y devuelve aviso. Solo admin.
-- El UPDATE dispara el trigger after_factura_paid (notificación Realtime).
CREATE OR REPLACE FUNCTION public.registrar_pago_factura(
  p_factura_id uuid,
  p_metodo     text,
  p_fecha      date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas;
  v_actor   uuid := auth.uid();
  -- Convención del proyecto: las fechas se calculan en America/Lima, no UTC (R2).
  v_hoy     date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  -- 1. Solo admin (helper estándar Zity).
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin' USING ERRCODE = '42501';
  END IF;

  -- 2. Validar método de pago.
  IF p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','otro') THEN
    RAISE EXCEPTION 'Método de pago inválido. Use efectivo, transferencia u otro';
  END IF;

  -- 3. Bloquear la fila para evitar carreras (R3: doble click / dos admins).
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- 4. Idempotencia: si ya está pagada, no reescribe nada.
  IF v_factura.estado = 'pagada' THEN
    RETURN jsonb_build_object(
      'ok', true, 'ya_pagada', true, 'numero', v_factura.numero,
      'mensaje', 'La factura ya estaba pagada'
    );
  END IF;

  -- 5. Transición permitida: pendiente | vencida → pagada.
  UPDATE public.facturas
    SET estado         = 'pagada',
        fecha_pago     = COALESCE(p_fecha, v_hoy),
        metodo_pago    = p_metodo,
        registrado_por = v_actor
    WHERE id = p_factura_id;

  -- 6. Auditoría (acción crítica auditada en SQL, patrón triggers del proyecto).
  INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
  VALUES (v_actor, 'registrar_pago_factura', 'facturas', p_factura_id,
    jsonb_build_object('metodo_pago', p_metodo, 'estado_anterior', v_factura.estado::text),
    'exitoso');

  RETURN jsonb_build_object(
    'ok', true, 'ya_pagada', false, 'numero', v_factura.numero,
    'mensaje', 'Factura registrada como pagada'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_pago_factura(uuid, text, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_factura(uuid, text, date) TO authenticated;

COMMENT ON FUNCTION public.registrar_pago_factura(uuid, text, date) IS
  'Sprint 9 · HU-FACT-04 — Marca una factura como pagada (idempotente, solo admin). '
  'Audita en audit_log; el trigger after_factura_paid emite la notificación Realtime.';

-- ────────────────────────────────────────────────────────────
-- PARTE F: Trigger after_factura_paid — notificación Realtime
-- ────────────────────────────────────────────────────────────
-- AFTER UPDATE cuando el estado pasa a 'pagada'. Reusa el canal Realtime del S6.
-- Best-effort: un fallo de notificación nunca revierte el pago.
CREATE OR REPLACE FUNCTION public.after_factura_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tipo_label text;
BEGIN
  BEGIN
    v_tipo_label := CASE NEW.tipo
      WHEN 'luz'     THEN 'Electricidad'
      WHEN 'agua'    THEN 'Agua'
      WHEN 'pension' THEN 'Pensión'
      WHEN 'multa'   THEN 'Multa'
      ELSE NEW.tipo::text
    END;

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (NEW.residente_id, NULL, 'factura_pagada',
       'Pago registrado: ' || v_tipo_label,
       'Tu factura de ' || v_tipo_label || ' ($' || NEW.monto::text
         || ') fue registrada como pagada.',
       false, jsonb_build_object('factura_id', NEW.id));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_factura_paid falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_factura_paid ON public.facturas;
CREATE TRIGGER after_factura_paid
  AFTER UPDATE ON public.facturas
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado AND NEW.estado = 'pagada')
  EXECUTE FUNCTION public.after_factura_paid();

REVOKE ALL ON FUNCTION public.after_factura_paid() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.after_factura_paid() IS
  'Sprint 9 · HU-FACT-04 — Trigger AFTER UPDATE→pagada. Notificación factura_pagada (Realtime S6).';

-- ────────────────────────────────────────────────────────────
-- PARTE G: Job diario — vencidas + recordatorios (dos pasadas)
-- ────────────────────────────────────────────────────────────
-- Zona America/Lima (no UTC) para no adelantar/atrasar el vencimiento un día (R2).
-- Idempotente (R1): la pasada 2 filtra recordatorio_enviado=false.
CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas_y_recordatorios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoy           date := (now() AT TIME ZONE 'America/Lima')::date;
  v_vencidas      integer := 0;
  v_recordatorios integer := 0;
  v_factura       record;
  v_tipo_label    text;
BEGIN
  -- Pasada 1: marcar como 'vencida' las pendientes cuyo vencimiento ya pasó.
  UPDATE public.facturas
    SET estado = 'vencida'
    WHERE estado = 'pendiente'
      AND vencimiento < v_hoy;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

  -- Pasada 2: recordatorio 3 días antes del vencimiento (una sola vez por factura).
  FOR v_factura IN
    SELECT * FROM public.facturas
    WHERE estado = 'pendiente'
      AND vencimiento = v_hoy + 3
      AND recordatorio_enviado = false
  LOOP
    v_tipo_label := CASE v_factura.tipo
      WHEN 'luz'     THEN 'Electricidad'
      WHEN 'agua'    THEN 'Agua'
      WHEN 'pension' THEN 'Pensión'
      WHEN 'multa'   THEN 'Multa'
      ELSE v_factura.tipo::text
    END;

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (v_factura.residente_id, NULL, 'factura_por_vencer',
       'Tu factura de ' || v_tipo_label || ' vence en 3 días',
       'Tu factura de ' || v_tipo_label || ' ($' || v_factura.monto::text
         || ') vence el ' || to_char(v_factura.vencimiento, 'DD/MM/YYYY') || '.',
       false, jsonb_build_object('factura_id', v_factura.id));

    UPDATE public.facturas SET recordatorio_enviado = true WHERE id = v_factura.id;
    v_recordatorios := v_recordatorios + 1;

    -- Email fire-and-forget (best-effort; requiere pg_net + settings app.*).
    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/recordatorios-facturas',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'factura_id',   v_factura.id,
          'residente_id', v_factura.residente_id,
          'tipo',         v_factura.tipo,
          'monto',        v_factura.monto,
          'periodo',      v_factura.periodo,
          'vencimiento',  to_char(v_factura.vencimiento, 'YYYY-MM-DD')
        )
      );
    EXCEPTION WHEN others THEN
      RAISE WARNING 'recordatorios-facturas email falló (best-effort): %', SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'vencidas', v_vencidas,
    'recordatorios', v_recordatorios,
    'fecha', v_hoy
  );
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas_y_recordatorios() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.marcar_facturas_vencidas_y_recordatorios() IS
  'Sprint 9 · HU-FACT-06/08 — Job diario (pg_cron 06:00 America/Lima). '
  'Pasada 1: marca vencidas. Pasada 2: recordatorio 3 días antes (idempotente).';

-- ────────────────────────────────────────────────────────────
-- PARTE H: Programar el job diario con pg_cron (06:00 America/Lima = 11:00 UTC)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  PERFORM cron.unschedule('facturas-vencidas-recordatorios');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- aún no existe; ignorar.
END $$;

SELECT cron.schedule(
  'facturas-vencidas-recordatorios',
  '0 11 * * *',  -- 11:00 UTC = 06:00 America/Lima (UTC-5)
  $cron$ SELECT public.marcar_facturas_vencidas_y_recordatorios(); $cron$
);

-- ────────────────────────────────────────────────────────────
-- PARTE I: RPC totales_facturacion — suma 100% en servidor
-- ────────────────────────────────────────────────────────────
-- emitido = cobrado + pendiente + vencido (los 3 estados son exhaustivos).
CREATE OR REPLACE FUNCTION public.totales_facturacion(p_periodo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emitido   numeric(10,2);
  v_cobrado   numeric(10,2);
  v_pendiente numeric(10,2);
  v_vencido   numeric(10,2);
BEGIN
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin' USING ERRCODE = '42501';
  END IF;
  IF p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Formato de período inválido. Use YYYY-MM';
  END IF;

  SELECT
    COALESCE(SUM(monto), 0),
    COALESCE(SUM(monto) FILTER (WHERE estado = 'pagada'), 0),
    COALESCE(SUM(monto) FILTER (WHERE estado = 'pendiente'), 0),
    COALESCE(SUM(monto) FILTER (WHERE estado = 'vencida'), 0)
  INTO v_emitido, v_cobrado, v_pendiente, v_vencido
  FROM public.facturas
  WHERE periodo = p_periodo;

  RETURN jsonb_build_object(
    'emitido',   v_emitido,
    'cobrado',   v_cobrado,
    'pendiente', v_pendiente,
    'vencido',   v_vencido
  );
END;
$$;

REVOKE ALL ON FUNCTION public.totales_facturacion(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.totales_facturacion(text) TO authenticated;

COMMENT ON FUNCTION public.totales_facturacion(text) IS
  'Sprint 9 · PBI-S8-E02 — Totales del periodo por estado (emitido/cobrado/pendiente/vencido). '
  'Suma en servidor numeric(10,2); solo admin.';

-- ────────────────────────────────────────────────────────────
-- PARTE J: Higiene de seguridad (database linter / DoD v2)
-- ────────────────────────────────────────────────────────────
-- facturas_secuencia (S8) solo la usa el trigger before_factura_numero
-- (SECURITY DEFINER). Habilitar RLS sin políticas la cierra a la API REST
-- (anon/authenticated) sin afectar al trigger. Cierra el lint 0013 (ERROR).
ALTER TABLE public.facturas_secuencia ENABLE ROW LEVEL SECURITY;

-- set_updated_at (S8) es un trigger genérico; fijar search_path evita el
-- lint 0011 (search_path mutable) sin cambiar su comportamiento (solo asigna now()).
ALTER FUNCTION public.set_updated_at() SET search_path = '';
