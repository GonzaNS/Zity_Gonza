-- ============================================================
-- Sprint 7 · HU-KPI-01 · Datos para gráficas Recharts
-- ============================================================
-- Crea la función RPC get_graficas_mantenimiento() que devuelve
-- en una sola llamada todos los datasets necesarios para las
-- tres gráficas del panel /admin/metricas:
--
--   por_tipo        → array [{tipo, total}] para BarChart horizontal
--   tendencia_mensual → array [{mes, avg_horas, mediana_horas}]
--                      para LineChart de los últimos 6 meses
--   top_categorias  → array [{categoria, total, porcentaje}]
--                      top 5 por volumen para barras de proporción
--
-- Protegida con SECURITY DEFINER + verificación de rol admin
-- (mismo patrón que get_metricas_mantenimiento del PBI-22).
-- ============================================================

CREATE OR REPLACE FUNCTION get_graficas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_por_tipo          jsonb;
  v_tendencia         jsonb;
  v_top_categorias    jsonb;
BEGIN
  -- ── 1. Verificación de rol ──────────────────────────────────────────────────
  -- get_user_rol() lee public.usuarios.rol via auth.uid() — patrón estándar Zity.
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Conteo por tipo de solicitud ────────────────────────────────────────
  -- Devuelve todos los tipos con su conteo, incluyendo tipos con 0 solicitudes
  -- (para que la gráfica siempre tenga las 5 barras visibles).
  SELECT jsonb_agg(
    jsonb_build_object(
      'tipo',  tipo,
      'total', total
    ) ORDER BY total DESC
  )
  INTO v_por_tipo
  FROM (
    SELECT
      t.tipo,
      COUNT(s.id) AS total
    FROM (
      VALUES
        ('mantenimiento'),('reparacion'),('queja'),('sugerencia'),('otro')
    ) AS t(tipo)
    LEFT JOIN solicitudes s ON s.tipo = t.tipo
    GROUP BY t.tipo
  ) sub;

  -- ── 3. Tendencia mensual de tiempos de resolución (últimos 6 meses) ────────
  -- Para cada mes, calcula el promedio y la mediana de horas de resolución.
  -- Solo incluye meses que tengan al menos 1 solicitud resuelta.
  -- El "mes" se formatea como 'YYYY-MM' para que el cliente pueda ordenarlo y
  -- formatearlo según el locale del usuario.
  SELECT jsonb_agg(
    jsonb_build_object(
      'mes',         mes,
      'avg_horas',   ROUND(avg_horas::numeric, 2),
      'mediana_horas', ROUND(mediana_horas::numeric, 2)
    ) ORDER BY mes
  )
  INTO v_tendencia
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM') AS mes,
      AVG(
        EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0
      ) AS avg_horas,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0
      ) AS mediana_horas
    FROM solicitudes s
    JOIN LATERAL (
      SELECT MIN(created_at) AS primera_resolucion
      FROM historial_estados
      WHERE solicitud_id = s.id
        AND estado_nuevo IN ('resuelta', 'cerrada')
    ) he ON he.primera_resolucion IS NOT NULL
    WHERE s.created_at >= NOW() - INTERVAL '6 months'
      AND EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) >= 0
    GROUP BY DATE_TRUNC('month', s.created_at)
  ) mensual;

  -- ── 4. Top 5 categorías por volumen ────────────────────────────────────────
  -- Calcula el porcentaje de cada categoría sobre el total de solicitudes.
  -- Si no hay solicitudes, devuelve array vacío (jsonb null → [] en el cliente).
  SELECT jsonb_agg(
    jsonb_build_object(
      'categoria',  categoria,
      'total',      total,
      'porcentaje', ROUND(
        CASE WHEN grand_total > 0
          THEN (total::numeric / grand_total) * 100
          ELSE 0
        END, 1
      )
    )
  )
  INTO v_top_categorias
  FROM (
    SELECT
      categoria,
      total,
      SUM(total) OVER () AS grand_total,
      ROW_NUMBER() OVER (ORDER BY total DESC) AS rn
    FROM (
      SELECT categoria, COUNT(*) AS total
      FROM solicitudes
      GROUP BY categoria
    ) conteos
  ) ranked
  WHERE rn <= 5;

  -- ── 5. Resultado final ─────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'por_tipo',          COALESCE(v_por_tipo, '[]'::jsonb),
    'tendencia_mensual', COALESCE(v_tendencia, '[]'::jsonb),
    'top_categorias',    COALESCE(v_top_categorias, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_graficas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_graficas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_graficas_mantenimiento() IS
  'Sprint 7 · HU-KPI-01 — Datos para las gráficas Recharts del panel /admin/metricas. '
  'Solo ejecutable por usuarios con rol=admin. '
  'Devuelve: conteo por tipo, tendencia mensual de tiempos (avg+mediana), top 5 categorías.';
