-- ============================================================
-- Sprint 14 · HU-EJEC-03 · Sección 'Finanzas' del dashboard
-- Migración 017 — RPC get_metricas_finanzas
-- ============================================================

-- Crea la función RPC get_metricas_finanzas() que devuelve
-- los KPIs financieros para un periodo específico (por defecto, el mes actual).
-- Consumida por el panel ejecutivo del administrador / observador.

CREATE OR REPLACE FUNCTION public.get_metricas_finanzas(p_periodo text DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'))
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_cobrado numeric := 0;
  v_total_pendiente numeric := 0;
  v_ingresos_por_tipo json;
BEGIN
  -- Permisos: solo admin u observador
  IF NOT (public.get_user_rol() IN ('admin', 'observador')) THEN
    RAISE EXCEPTION 'Acceso denegado. Se requiere rol admin u observador.';
  END IF;

  -- 1. Calcular el ratio de cobranza (totales emitidos vs cobrados del periodo)
  SELECT
    COALESCE(SUM(monto) FILTER (WHERE estado = 'pagada'), 0),
    COALESCE(SUM(monto) FILTER (WHERE estado IN ('pendiente', 'vencida')), 0)
  INTO v_total_cobrado, v_total_pendiente
  FROM public.facturas
  WHERE periodo = p_periodo;

  -- 2. Calcular los ingresos por tipo (solo de las facturas pagadas del periodo)
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  INTO v_ingresos_por_tipo
  FROM (
    SELECT tipo::text as name, SUM(monto) as value
    FROM public.facturas
    WHERE periodo = p_periodo AND estado = 'pagada'
    GROUP BY tipo
    ORDER BY SUM(monto) DESC
  ) t;

  -- Retornar el objeto JSON estructurado
  RETURN json_build_object(
    'periodo', p_periodo,
    'ratio', json_build_object(
      'cobrado', v_total_cobrado,
      'pendiente', v_total_pendiente
    ),
    'ingresos_por_tipo', v_ingresos_por_tipo
  );
END;
$$;

-- Seguridad: denegar por defecto, permitir solo a usuarios autenticados
REVOKE ALL ON FUNCTION public.get_metricas_finanzas(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_metricas_finanzas(text) TO authenticated;

COMMENT ON FUNCTION public.get_metricas_finanzas(text) IS
  'Sprint 14 · HU-EJEC-03 — Devuelve el ratio de cobranza y los ingresos por tipo para un periodo (YYYY-MM). Requiere rol admin u observador.';
