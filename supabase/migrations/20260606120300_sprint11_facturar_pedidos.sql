-- ============================================================
-- Sprint 11 · HU-TIENDA-04 · Migración 012 (nominal) — parte 4/4
-- Cierre de mes: consolida los pedidos 'confirmado' del período en una factura
-- de tipo 'tienda' por residente, idempotente. + job pg_cron mensual.  ADR-015.
-- ============================================================
-- Reusa la estructura de facturas del S8/S9: el INSERT dispara
-- after_factura_inserted (notificación Realtime + email f&f) y before_factura_numero
-- (numeración F-YYYY-MM-NNN). El UNIQUE(residente_id,tipo,periodo) garantiza una
-- sola factura de tienda por residente y período.
-- ============================================================

CREATE OR REPLACE FUNCTION public.facturar_pedidos_periodo(p_periodo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_hoy   date := (now() AT TIME ZONE 'America/Lima')::date;
  v_venc  date := (now() AT TIME ZONE 'America/Lima')::date + 15;  -- 15 días para pagar
  v_res   record;
  v_factura_id uuid;
  v_estado public.factura_estado;
  v_n      integer;
  v_facturas_creadas   integer := 0;
  v_pedidos_facturados integer := 0;
BEGIN
  -- Admin (UI) o cron (sin sesión). Un residente no puede cerrar el período.
  IF v_actor IS NOT NULL AND public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin' USING ERRCODE = '42501';
  END IF;
  IF p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Formato de período inválido. Use YYYY-MM';
  END IF;

  -- Un residente a la vez: suma sus pedidos 'confirmado' del período.
  FOR v_res IN
    SELECT residente_id,
           SUM(total)::numeric(10,2) AS monto,
           COUNT(*)                  AS n
    FROM public.pedidos
    WHERE estado = 'confirmado' AND periodo = p_periodo
    GROUP BY residente_id
  LOOP
    SELECT id, estado INTO v_factura_id, v_estado
    FROM public.facturas
    WHERE residente_id = v_res.residente_id AND tipo = 'tienda' AND periodo = p_periodo;

    IF v_factura_id IS NULL THEN
      -- Crear con el monto real (la notificación sale con el importe correcto).
      INSERT INTO public.facturas
        (residente_id, tipo, monto, periodo, fecha_emision, vencimiento, estado, descripcion)
      VALUES
        (v_res.residente_id, 'tienda', v_res.monto, p_periodo, v_hoy, v_venc, 'pendiente',
         'Compras en la tienda — ' || v_res.n || ' pedido(s)')
      RETURNING id INTO v_factura_id;
      v_facturas_creadas := v_facturas_creadas + 1;
    ELSIF v_estado = 'pendiente' THEN
      -- Re-ejecución con pedidos nuevos del mismo período: acumula al pendiente.
      UPDATE public.facturas
        SET monto = monto + v_res.monto,
            descripcion = 'Compras en la tienda (actualizada)'
        WHERE id = v_factura_id;
    END IF;
    -- (Si la factura ya está pagada/vencida no se altera su monto; los pedidos
    --  igual se enlazan y marcan facturado abajo — caso borde improbable.)

    UPDATE public.pedidos
      SET estado = 'facturado', factura_id = v_factura_id
      WHERE residente_id = v_res.residente_id
        AND periodo = p_periodo
        AND estado = 'confirmado';
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_pedidos_facturados := v_pedidos_facturados + v_n;
  END LOOP;

  -- Auditoría del cierre (solo IDs/contadores). usuario_id NULL si lo corre el cron.
  INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
  VALUES (v_actor, 'facturar_pedidos', 'facturas', NULL,
          jsonb_build_object('periodo', p_periodo,
                             'facturas_creadas', v_facturas_creadas,
                             'pedidos_facturados', v_pedidos_facturados),
          'exitoso');

  RETURN jsonb_build_object(
    'periodo', p_periodo,
    'facturas_creadas', v_facturas_creadas,
    'pedidos_facturados', v_pedidos_facturados
  );
END;
$$;

REVOKE ALL ON FUNCTION public.facturar_pedidos_periodo(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.facturar_pedidos_periodo(text) TO authenticated;

COMMENT ON FUNCTION public.facturar_pedidos_periodo(text) IS
  'Sprint 11 · HU-TIENDA-04 — Cierre de mes: consolida pedidos confirmados del período '
  'en una factura tipo tienda por residente (idempotente). Admin (UI) o pg_cron. ADR-015.';

-- ── pg_cron mensual: día 1, 06:00 America/Lima (11:00 UTC), factura el mes anterior ──
DO $$ BEGIN
  PERFORM cron.unschedule('facturar-pedidos-mensual');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- aún no existe; ignorar.
END $$;

SELECT cron.schedule(
  'facturar-pedidos-mensual',
  '0 11 1 * *',  -- día 1 de cada mes, 11:00 UTC = 06:00 America/Lima
  $cron$ SELECT public.facturar_pedidos_periodo(
           to_char((now() AT TIME ZONE 'America/Lima') - interval '1 day', 'YYYY-MM')); $cron$
);
