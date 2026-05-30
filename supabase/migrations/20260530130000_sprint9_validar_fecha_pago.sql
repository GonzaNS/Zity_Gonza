-- ============================================================
-- Sprint 9 · Validación de coherencia de fecha_pago (hardening)
-- ============================================================
-- registrar_pago_factura aceptaba cualquier p_fecha (incluso futura o anterior
-- a la emisión), lo que produciría comprobantes con fechas absurdas. Añadimos
-- validación: la fecha de pago no puede ser futura (zona America/Lima) ni
-- anterior a la fecha de emisión de la factura. El input del drawer también
-- aplica min/max.
-- ============================================================

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
  v_hoy     date := (now() AT TIME ZONE 'America/Lima')::date;
  v_fecha   date;
BEGIN
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin' USING ERRCODE = '42501';
  END IF;

  IF p_metodo IS NULL OR p_metodo NOT IN ('efectivo','transferencia','otro') THEN
    RAISE EXCEPTION 'Método de pago inválido. Use efectivo, transferencia u otro';
  END IF;

  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Idempotencia (R3): si ya está pagada, no reescribe nada.
  IF v_factura.estado = 'pagada' THEN
    RETURN jsonb_build_object(
      'ok', true, 'ya_pagada', true, 'numero', v_factura.numero,
      'mensaje', 'La factura ya estaba pagada'
    );
  END IF;

  -- Coherencia de la fecha de pago: ni futura ni anterior a la emisión.
  v_fecha := COALESCE(p_fecha, v_hoy);
  IF v_fecha > v_hoy THEN
    RAISE EXCEPTION 'La fecha de pago no puede ser futura';
  END IF;
  IF v_fecha < v_factura.fecha_emision THEN
    RAISE EXCEPTION 'La fecha de pago no puede ser anterior a la emisión de la factura';
  END IF;

  UPDATE public.facturas
    SET estado         = 'pagada',
        fecha_pago     = v_fecha,
        metodo_pago    = p_metodo,
        registrado_por = v_actor
    WHERE id = p_factura_id;

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
