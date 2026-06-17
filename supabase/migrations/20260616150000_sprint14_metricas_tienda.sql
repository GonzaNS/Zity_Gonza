-- ============================================================
-- Sprint 14 · HU-EJEC-04 · Sección 'Tienda' del dashboard
-- Migración 018 — RPC get_metricas_tienda
-- ============================================================

-- Crea la función RPC get_metricas_tienda() que devuelve
-- los ingresos del mes, top 5 productos y tendencia de ventas.
-- Consumida por el panel ejecutivo del administrador / observador.

CREATE OR REPLACE FUNCTION public.get_metricas_tienda(p_periodo text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'))
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ingresos_mes numeric := 0;
  v_top_productos json;
  v_tendencia json;
BEGIN
  -- Permisos: solo admin u observador
  IF NOT public.puede_ver_metricas() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin u observador'
      USING ERRCODE = '42501';
  END IF;

  -- 1. Calcular los ingresos de la tienda del mes (pedidos confirmados o facturados)
  SELECT COALESCE(SUM(total), 0)
  INTO v_ingresos_mes
  FROM public.pedidos
  WHERE periodo = p_periodo AND estado IN ('confirmado', 'facturado');

  -- 2. Top 5 productos más vendidos del mes
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_top_productos
  FROM (
    SELECT
      prod.nombre as name,
      SUM(item.cantidad)::integer as cantidad,
      SUM(item.cantidad * item.precio_unitario)::numeric(10,2) as value
    FROM public.pedido_items item
    JOIN public.pedidos ped ON item.pedido_id = ped.id
    JOIN public.productos prod ON item.producto_id = prod.id
    WHERE ped.periodo = p_periodo AND ped.estado IN ('confirmado', 'facturado')
    GROUP BY prod.id, prod.nombre
    ORDER BY cantidad DESC, value DESC
    LIMIT 5
  ) t;

  -- 3. Tendencia de ventas de los últimos 6 meses (incluyendo el actual)
  SELECT COALESCE(json_agg(row_to_json(trend)), '[]'::json)
  INTO v_tendencia
  FROM (
    WITH meses AS (
      SELECT to_char(g, 'YYYY-MM') AS mes
      FROM generate_series(
        (to_date(p_periodo, 'YYYY-MM') - INTERVAL '5 months')::date,
        to_date(p_periodo, 'YYYY-MM')::date,
        '1 month'::interval
      ) g
    )
    SELECT
      m.mes,
      COALESCE(SUM(p.total), 0)::numeric(10,2) AS total_ventas,
      COUNT(p.id)::integer AS total_pedidos
    FROM meses m
    LEFT JOIN public.pedidos p ON p.periodo = m.mes AND p.estado IN ('confirmado', 'facturado')
    GROUP BY m.mes
    ORDER BY m.mes ASC
  ) trend;

  -- Retornar el objeto JSON estructurado
  RETURN json_build_object(
    'periodo', p_periodo,
    'ingresos_mes', v_ingresos_mes,
    'top_productos', v_top_productos,
    'tendencia', v_tendencia
  );
END;
$$;

-- Seguridad: denegar por defecto, permitir solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.get_metricas_tienda(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_metricas_tienda(text) TO authenticated;

COMMENT ON FUNCTION public.get_metricas_tienda(text) IS
  'Sprint 14 · HU-EJEC-04 — Devuelve los ingresos de la tienda del mes, top 5 productos más vendidos y la tendencia de ventas. Requiere rol admin u observador.';
