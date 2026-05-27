-- ============================================================
-- Sprint 8 · HU-FACT-05 · Notificación Realtime factura_nueva
-- ============================================================
-- Parte A: columna metadata jsonb en notificaciones.
--   Permite adjuntar referencias a entidades no-solicitud (ej: factura_id)
--   sin romper el schema base del Sprint 6.
--
-- Parte B: actualiza after_factura_inserted para incluir factura_id en metadata
--   y dispara una Edge Function de email fire-and-forget.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: metadata jsonb en notificaciones
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.notificaciones
  ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.notificaciones.metadata IS
  'Sprint 8 · HU-FACT-05 — Datos adicionales por tipo de notificación. '
  'Ejemplo: {"factura_id": "uuid"} para tipo=factura_nueva. '
  'Null para notificaciones de solicitudes (retrocompatibilidad).';

-- ────────────────────────────────────────────────────────────
-- PARTE B: actualizar trigger after_factura_inserted
-- ────────────────────────────────────────────────────────────
-- Ahora incluye:
--   • metadata = {"factura_id": "<uuid>"}  → para el deep link del frontend.
--   • Llamada fire-and-forget a la Edge Function notificar-factura-nueva
--     via pg_net (net.http_post). Si falla, la factura igual se crea (EXCEPTION).

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

    v_titulo  := 'Nueva factura: ' || v_tipo_label;
    v_mensaje := 'Factura nueva: ' || v_tipo_label
              || ' — $' || NEW.monto::text
              || ', vence ' || to_char(NEW.vencimiento, 'DD/MM');

    -- Insertar notificación con metadata que incluye factura_id para deep link
    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (NEW.residente_id, NULL, 'factura_nueva', v_titulo, v_mensaje, false,
       jsonb_build_object('factura_id', NEW.id));

    -- Fire-and-forget: invocar Edge Function de email si pg_net está disponible.
    -- Si la extensión no está habilitada o el RESEND_API_KEY no está configurado,
    -- el EXCEPTION interno lo absorbe silenciosamente (la factura no se revierte).
    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/notificar-factura-nueva',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'factura_id',   NEW.id,
          'residente_id', NEW.residente_id,
          'tipo',         NEW.tipo,
          'monto',        NEW.monto,
          'periodo',      NEW.periodo,
          'vencimiento',  to_char(NEW.vencimiento, 'YYYY-MM-DD')
        )
      );
    EXCEPTION WHEN others THEN
      -- pg_net no disponible o settings no configurados → silencio.
      RAISE WARNING 'after_factura_inserted: email fire-and-forget falló: %', SQLERRM;
    END;

  EXCEPTION WHEN others THEN
    -- Best-effort: la notificación no debe revertir el INSERT de la factura.
    RAISE WARNING 'after_factura_inserted falló: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- El trigger ya existe (HU-FACT-01) — solo se reemplaza la función.
-- DROP TRIGGER IF EXISTS after_factura_inserted ON public.facturas;
-- CREATE TRIGGER after_factura_inserted ...
-- → No es necesario recrear el trigger porque la función es CREATE OR REPLACE.

REVOKE ALL ON FUNCTION public.after_factura_inserted()
  FROM anon, authenticated, public;

COMMENT ON FUNCTION public.after_factura_inserted() IS
  'Sprint 8 · HU-FACT-05 — Trigger AFTER INSERT en facturas (actualización). '
  'Inserta notificación con metadata.factura_id para deep link en la campana. '
  'Dispara email fire-and-forget via Edge Function notificar-factura-nueva + pg_net.';
