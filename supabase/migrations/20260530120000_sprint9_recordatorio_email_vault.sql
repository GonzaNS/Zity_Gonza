-- ============================================================
-- Sprint 9 · Activación del email del recordatorio vía Supabase Vault
-- ============================================================
-- La función del cron ahora lee la URL del proyecto y la service role key desde
-- Vault (secretos 'project_url' y 'service_role_key') en lugar de
-- current_setting('app.*'), que requería privilegios de superusuario para
-- configurarse (ALTER DATABASE SET) y no era posible vía el MCP.
--
-- Los secretos se crean fuera de esta migración (no se versionan en git):
--   select vault.create_secret('<url>', 'project_url');
--   select vault.create_secret('<service_role_key>', 'service_role_key');
--
-- Best-effort: si los secretos faltan, el email no se envía pero la notificación
-- in-app (Realtime) — fuente de verdad — se entrega igual.
-- ============================================================

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
  v_url           text;
  v_key           text;
BEGIN
  -- Secretos para invocar la Edge Function (desde Vault).
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  -- Pasada 1: marcar como 'vencida' las pendientes cuyo vencimiento ya pasó.
  UPDATE public.facturas
    SET estado = 'vencida'
    WHERE estado = 'pendiente'
      AND vencimiento < v_hoy;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

  -- Pasada 2: recordatorio 3 días antes (una sola vez por factura).
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

    -- Email fire-and-forget vía Edge Function (best-effort; requiere los secretos).
    IF v_url IS NOT NULL AND v_key IS NOT NULL THEN
      BEGIN
        PERFORM net.http_post(
          url     := v_url || '/functions/v1/recordatorios-facturas',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_key
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
    END IF;
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
  'Pasada 1: marca vencidas. Pasada 2: recordatorio 3 días antes (idempotente). '
  'Email vía Edge Function usando secretos de Vault (project_url, service_role_key).';
