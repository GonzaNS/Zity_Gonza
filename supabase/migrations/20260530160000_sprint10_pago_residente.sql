-- ============================================================
-- Sprint 10 · MP-02 / HU-FACT-09 · Pago en línea (simulado) del residente
-- ============================================================
-- El residente paga sus facturas pendientes/vencidas desde la app con un pago
-- SIMULADO (sin proveedor real). Se amplía el CHECK de metodo_pago para 'tarjeta'
-- y se añade la RPC pagar_factura_residente (SECURITY DEFINER) que valida que la
-- factura pertenece a quien la paga (auth.uid() = residente_id). Reusa el trigger
-- after_factura_paid (S9): emite la notificación 'factura_pagada' y el admin ve
-- el pago en sus totales (cobrado), igual que un pago registrado manualmente.
--
-- Migrar a una pasarela real (Culqi/Izipay/MercadoPago Perú) solo requiere
-- reemplazar la confirmación simulada por el webhook del proveedor; el resto del
-- flujo (estado, notificación, totales) no cambia.
-- ============================================================

-- ── PARTE A: Ampliar el CHECK de metodo_pago para admitir 'tarjeta' ───────────
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_metodo_pago_check;
ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_metodo_pago_check
  CHECK (metodo_pago IS NULL OR metodo_pago IN ('efectivo','transferencia','otro','tarjeta'));

-- ── PARTE B: Catálogo de auditoría (FK audit_log.accion) ──────────────────────
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle) VALUES
  ('pagar_factura_residente', 'Pago en linea (simulado) de una factura por el residente', true)
ON CONFLICT (codigo) DO NOTHING;

-- ── PARTE C: RPC pagar_factura_residente ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pagar_factura_residente(p_factura_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factura public.facturas;
  v_actor   uuid := auth.uid();
  v_hoy     date := (now() AT TIME ZONE 'America/Lima')::date;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere sesión' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada' USING ERRCODE = 'P0002';
  END IF;

  -- Seguridad (R4): el residente solo puede pagar SUS propias facturas.
  IF v_factura.residente_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Acceso denegado: solo puedes pagar tus propias facturas' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia (R3): si ya está pagada, no reescribe nada.
  IF v_factura.estado = 'pagada' THEN
    RETURN jsonb_build_object(
      'ok', true, 'ya_pagada', true, 'numero', v_factura.numero,
      'mensaje', 'La factura ya estaba pagada'
    );
  END IF;

  -- Pago simulado: marca 'pagada' con método 'tarjeta' y fecha de hoy (Lima).
  -- registrado_por = el propio residente. El trigger after_factura_paid emite
  -- la notificación 'factura_pagada' (Realtime) automáticamente.
  UPDATE public.facturas
    SET estado         = 'pagada',
        fecha_pago     = v_hoy,
        metodo_pago    = 'tarjeta',
        registrado_por = v_actor
    WHERE id = p_factura_id;

  INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
  VALUES (v_actor, 'pagar_factura_residente', 'facturas', p_factura_id,
    jsonb_build_object('metodo_pago', 'tarjeta', 'estado_anterior', v_factura.estado::text),
    'exitoso');

  RETURN jsonb_build_object(
    'ok', true, 'ya_pagada', false, 'numero', v_factura.numero,
    'mensaje', 'Pago realizado correctamente'
  );
END;
$$;

-- Solo usuarios autenticados (la RPC valida internamente el dueño).
REVOKE ALL ON FUNCTION public.pagar_factura_residente(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.pagar_factura_residente(uuid) TO authenticated;

COMMENT ON FUNCTION public.pagar_factura_residente(uuid) IS
  'Sprint 10 · HU-FACT-09 — Pago simulado de una factura por su residente. '
  'Valida auth.uid() = residente_id, idempotente, método=tarjeta. Reusa after_factura_paid.';
