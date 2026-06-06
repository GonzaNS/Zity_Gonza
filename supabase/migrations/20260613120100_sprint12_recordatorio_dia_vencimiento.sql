-- ============================================================
-- Sprint 12 · Buffer PBI-S9-E02 · Recordatorio el día del vencimiento
-- Migración 014 (nominal)
-- ============================================================
-- Cierra una deuda pequeña del S9: además del recordatorio 3 días antes,
-- se envía uno MÁS el mismo día del vencimiento (última llamada antes de que
-- el job marque la factura como 'vencida' al día siguiente).
--   • Idempotencia independiente: columna recordatorio_vencimiento_enviado
--     (no reusa recordatorio_enviado, que es del aviso de 3 días) — R1.
--   • Reusa el fixture de tiempo determinista (Retro S11 · Acción 2) en su E2E.
--   • El email pasa 'dias_restantes' para que la Edge Function ajuste el texto
--     ("vence hoy" vs "vence en 3 días").
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Marca de idempotencia del recordatorio del día 0
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS recordatorio_vencimiento_enviado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.facturas.recordatorio_vencimiento_enviado IS
  'Sprint 12 · PBI-S9-E02 — Evita duplicar el recordatorio del día del vencimiento si el cron corre dos veces (R1).';

-- ────────────────────────────────────────────────────────────
-- PARTE B: Job diario — añade la Pasada 2b (recordatorio el día del vencimiento)
-- ────────────────────────────────────────────────────────────
-- Pasada 1: vencidas (vencimiento < hoy). Pasada 2: recordatorio 3 días antes.
-- Pasada 2b (NUEVA): recordatorio el día del vencimiento (vencimiento = hoy).
-- Mantiene vault/soles/best-effort del S9; solo añade la pasada y 'dias_restantes'.
CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas_y_recordatorios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy              date := (now() AT TIME ZONE 'America/Lima')::date;
  v_vencidas         integer := 0;
  v_recordatorios    integer := 0;
  v_recordatorios_hoy integer := 0;
  v_factura          record;
  v_tipo_label       text;
  v_url              text;
  v_key              text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Pasada 1: marcar 'vencida' las pendientes cuyo vencimiento ya pasó.
  UPDATE public.facturas SET estado = 'vencida'
    WHERE estado = 'pendiente' AND vencimiento < v_hoy;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

  -- Pasada 2: recordatorio 3 días antes del vencimiento (una sola vez).
  FOR v_factura IN
    SELECT * FROM public.facturas
    WHERE estado = 'pendiente' AND vencimiento = v_hoy + 3 AND recordatorio_enviado = false
  LOOP
    v_tipo_label := CASE v_factura.tipo
      WHEN 'luz' THEN 'Electricidad' WHEN 'agua' THEN 'Agua'
      WHEN 'pension' THEN 'Pensión' WHEN 'multa' THEN 'Multa'
      WHEN 'tienda' THEN 'Tienda' ELSE v_factura.tipo::text END;
    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (v_factura.residente_id, NULL, 'factura_por_vencer',
       'Tu factura de ' || v_tipo_label || ' vence en 3 días',
       'Tu factura de ' || v_tipo_label || ' (S/ ' || to_char(v_factura.monto, 'FM999,999,990.00')
         || ') vence el ' || to_char(v_factura.vencimiento, 'DD/MM/YYYY') || '.',
       false, jsonb_build_object('factura_id', v_factura.id));
    UPDATE public.facturas SET recordatorio_enviado = true WHERE id = v_factura.id;
    v_recordatorios := v_recordatorios + 1;
    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_url || '/functions/v1/recordatorios-facturas',
          headers := jsonb_build_object('Content-Type','application/json',
            'Authorization', 'Bearer ' || v_key),
          body    := jsonb_build_object('factura_id', v_factura.id, 'residente_id', v_factura.residente_id,
            'tipo', v_factura.tipo, 'monto', v_factura.monto, 'periodo', v_factura.periodo,
            'vencimiento', to_char(v_factura.vencimiento, 'YYYY-MM-DD'), 'dias_restantes', 3)
        );
      EXCEPTION WHEN others THEN
        RAISE WARNING 'recordatorios-facturas email falló (best-effort): %', SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Pasada 2b: recordatorio el DÍA del vencimiento (PBI-S9-E02).
  FOR v_factura IN
    SELECT * FROM public.facturas
    WHERE estado = 'pendiente' AND vencimiento = v_hoy AND recordatorio_vencimiento_enviado = false
  LOOP
    v_tipo_label := CASE v_factura.tipo
      WHEN 'luz' THEN 'Electricidad' WHEN 'agua' THEN 'Agua'
      WHEN 'pension' THEN 'Pensión' WHEN 'multa' THEN 'Multa'
      WHEN 'tienda' THEN 'Tienda' ELSE v_factura.tipo::text END;
    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (v_factura.residente_id, NULL, 'factura_por_vencer',
       'Tu factura de ' || v_tipo_label || ' vence hoy',
       'Tu factura de ' || v_tipo_label || ' (S/ ' || to_char(v_factura.monto, 'FM999,999,990.00')
         || ') vence hoy ' || to_char(v_factura.vencimiento, 'DD/MM/YYYY') || '. Es el último día para pagar a tiempo.',
       false, jsonb_build_object('factura_id', v_factura.id));
    UPDATE public.facturas SET recordatorio_vencimiento_enviado = true WHERE id = v_factura.id;
    v_recordatorios_hoy := v_recordatorios_hoy + 1;
    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_url || '/functions/v1/recordatorios-facturas',
          headers := jsonb_build_object('Content-Type','application/json',
            'Authorization', 'Bearer ' || v_key),
          body    := jsonb_build_object('factura_id', v_factura.id, 'residente_id', v_factura.residente_id,
            'tipo', v_factura.tipo, 'monto', v_factura.monto, 'periodo', v_factura.periodo,
            'vencimiento', to_char(v_factura.vencimiento, 'YYYY-MM-DD'), 'dias_restantes', 0)
        );
      EXCEPTION WHEN others THEN
        RAISE WARNING 'recordatorios-facturas (día 0) email falló (best-effort): %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'vencidas', v_vencidas,
    'recordatorios', v_recordatorios,
    'recordatorios_hoy', v_recordatorios_hoy,
    'fecha', v_hoy
  );
END;
$function$;

COMMENT ON FUNCTION public.marcar_facturas_vencidas_y_recordatorios() IS
  'Sprint 9/12 · Job diario (pg_cron 06:00 America/Lima). Pasada 1: vencidas. '
  'Pasada 2: recordatorio 3 días antes. Pasada 2b (S12 · PBI-S9-E02): recordatorio el día del vencimiento.';
