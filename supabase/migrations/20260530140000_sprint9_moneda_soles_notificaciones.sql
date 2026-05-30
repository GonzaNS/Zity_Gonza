-- ============================================================
-- Sprint 9 · Consistencia de moneda (soles S/) en notificaciones in-app
-- ============================================================
-- Los triggers/cron armaban el monto del mensaje con '$' hardcodeado y sin
-- separador de miles. Se alinea con el frontend (es-PE/PEN): símbolo 'S/' y
-- formato con separador de miles vía to_char(monto, 'FM999,999,990.00').
-- Afecta el TEXTO de las notificaciones in-app de: factura nueva, factura
-- pagada y recordatorio de vencimiento. No cambia ninguna otra lógica.
-- ============================================================

-- 1) after_factura_inserted (factura nueva)
CREATE OR REPLACE FUNCTION public.after_factura_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
              || ' — S/ ' || to_char(NEW.monto, 'FM999,999,990.00')
              || ', vence ' || to_char(NEW.vencimiento, 'DD/MM');

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (NEW.residente_id, NULL, 'factura_nueva', v_titulo, v_mensaje, false,
       jsonb_build_object('factura_id', NEW.id));

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
      RAISE WARNING 'after_factura_inserted: email fire-and-forget falló: %', SQLERRM;
    END;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_factura_inserted falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.after_factura_inserted() FROM anon, authenticated, public;

-- 2) after_factura_paid (factura pagada)
CREATE OR REPLACE FUNCTION public.after_factura_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
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
       'Tu factura de ' || v_tipo_label || ' (S/ ' || to_char(NEW.monto, 'FM999,999,990.00')
         || ') fue registrada como pagada.',
       false, jsonb_build_object('factura_id', NEW.id));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_factura_paid falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.after_factura_paid() FROM anon, authenticated, public;

-- 3) marcar_facturas_vencidas_y_recordatorios (recordatorio de vencimiento)
CREATE OR REPLACE FUNCTION public.marcar_facturas_vencidas_y_recordatorios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_hoy           date := (now() AT TIME ZONE 'America/Lima')::date;
  v_vencidas      integer := 0;
  v_recordatorios integer := 0;
  v_factura       record;
  v_tipo_label    text;
  v_url           text;
  v_key           text;
BEGIN
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'project_url';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';

  UPDATE public.facturas
    SET estado = 'vencida'
    WHERE estado = 'pendiente'
      AND vencimiento < v_hoy;
  GET DIAGNOSTICS v_vencidas = ROW_COUNT;

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
       'Tu factura de ' || v_tipo_label || ' (S/ ' || to_char(v_factura.monto, 'FM999,999,990.00')
         || ') vence el ' || to_char(v_factura.vencimiento, 'DD/MM/YYYY') || '.',
       false, jsonb_build_object('factura_id', v_factura.id));

    UPDATE public.facturas SET recordatorio_enviado = true WHERE id = v_factura.id;
    v_recordatorios := v_recordatorios + 1;

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
$function$;

REVOKE ALL ON FUNCTION public.marcar_facturas_vencidas_y_recordatorios() FROM anon, authenticated, public;
