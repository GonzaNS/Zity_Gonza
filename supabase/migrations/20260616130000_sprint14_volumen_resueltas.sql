-- ============================================================
-- Sprint 14 · HU-EJEC-02 · Sección 'Mantenimiento' del dashboard
-- Migración 016 — volumen de resueltas en vw_metricas_solicitudes + RPCs para observador
-- ============================================================

-- 1. Dropear la vista materializada existente de forma cascada
-- (Esto removerá temporalmente los índices asociados)
DROP MATERIALIZED VIEW IF EXISTS public.vw_metricas_solicitudes CASCADE;

-- 2. Volver a crear la vista materializada incluyendo el COUNT de resueltas por mes
CREATE MATERIALIZED VIEW public.vw_metricas_solicitudes AS
WITH tiempos AS (
  SELECT
    EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0 AS diff_horas
  FROM solicitudes s
  JOIN LATERAL (
    SELECT MIN(created_at) AS primera_resolucion
    FROM historial_estados
    WHERE solicitud_id = s.id
      AND estado_nuevo IN ('resuelta', 'cerrada')
  ) he ON he.primera_resolucion IS NOT NULL
  WHERE EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) >= 0
),
estadisticos AS (
  SELECT
    AVG(diff_horas)                                           AS avg_horas,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY diff_horas)  AS mediana_horas,
    CASE WHEN COUNT(*) >= 2
      THEN percentile_cont(0.95) WITHIN GROUP (ORDER BY diff_horas)
      ELSE NULL
    END                                                       AS p95_horas
  FROM tiempos
),
por_tipo AS (
  SELECT jsonb_agg(
    jsonb_build_object('tipo', tipo, 'total', total)
    ORDER BY total DESC
  ) AS datos
  FROM (
    SELECT t.tipo, COUNT(s.id) AS total
    FROM (VALUES ('mantenimiento'),('reparacion'),('queja'),('sugerencia'),('otro')) AS t(tipo)
    LEFT JOIN solicitudes s ON s.tipo = t.tipo
    GROUP BY t.tipo
  ) sub
),
top_cats AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'categoria',  categoria,
      'total',      total,
      'porcentaje', ROUND(
        CASE WHEN grand_total > 0 THEN (total::numeric / grand_total) * 100 ELSE 0 END, 1
      )
    )
  ) AS datos
  FROM (
    SELECT categoria, total,
           SUM(total) OVER () AS grand_total,
           ROW_NUMBER() OVER (ORDER BY total DESC) AS rn
    FROM (SELECT categoria, COUNT(*) AS total FROM solicitudes GROUP BY categoria) c
  ) ranked
  WHERE rn <= 5
),
tendencia AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'mes',            mes,
      'avg_horas',      ROUND(avg_h::numeric, 2),
      'mediana_horas',  ROUND(med_h::numeric, 2),
      'resueltas',      resueltas
    ) ORDER BY mes
  ) AS datos
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM') AS mes,
      AVG(EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0)    AS avg_h,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0
      ) AS med_h,
      COUNT(s.id) AS resueltas
    FROM solicitudes s
    JOIN LATERAL (
      SELECT MIN(created_at) AS primera_resolucion
      FROM historial_estados
      WHERE solicitud_id = s.id AND estado_nuevo IN ('resuelta', 'cerrada')
    ) he ON he.primera_resolucion IS NOT NULL
    WHERE s.created_at >= NOW() - INTERVAL '6 months'
      AND EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) >= 0
    GROUP BY DATE_TRUNC('month', s.created_at)
  ) m
)
SELECT
  jsonb_build_object(
    'avg_horas',     ROUND(e.avg_horas::numeric, 2),
    'mediana_horas', ROUND(e.mediana_horas::numeric, 2),
    'p95_horas',     ROUND(e.p95_horas::numeric, 2)
  )                             AS tiempos_resolucion,
  COALESCE(pt.datos, '[]'::jsonb)  AS por_tipo,
  COALESCE(tc.datos, '[]'::jsonb)  AS top_categorias,
  COALESCE(t.datos,  '[]'::jsonb)  AS tendencia_mensual,
  NOW()                            AS refreshed_at
FROM estadisticos e, por_tipo pt, top_cats tc, tendencia t;

-- 3. Volver a crear el índice UNIQUE para REFRESH CONCURRENTLY
CREATE UNIQUE INDEX vw_metricas_solicitudes_refreshed_at_idx
  ON public.vw_metricas_solicitudes (refreshed_at);

-- Permisos sobre la vista
GRANT SELECT ON public.vw_metricas_solicitudes TO authenticated;

-- 4. Actualizar get_metricas_mantenimiento() para permitir rol 'observador'
CREATE OR REPLACE FUNCTION public.get_metricas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total          integer;
  v_pendientes     integer;
  v_en_proceso     integer;
  v_resueltas_hoy  integer;
  v_hoy            date := CURRENT_DATE;
  v_tiempos        jsonb;
  v_refreshed_at   timestamptz;
BEGIN
  -- Validación de rol: permite admin y observador
  IF NOT public.puede_ver_metricas() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin u observador'
      USING ERRCODE = '42501';
  END IF;

  -- Contadores en vivo (rápidos)
  SELECT COUNT(*) INTO v_total FROM solicitudes;
  SELECT COUNT(*) INTO v_pendientes FROM solicitudes WHERE estado = 'pendiente';
  SELECT COUNT(*) INTO v_en_proceso  FROM solicitudes WHERE estado IN ('asignada','en_progreso');
  SELECT COUNT(*) INTO v_resueltas_hoy
  FROM solicitudes
  WHERE estado IN ('resuelta','cerrada') AND updated_at::date = v_hoy;

  -- Tiempos de resolución desde la vista materializada
  SELECT tiempos_resolucion, refreshed_at
  INTO v_tiempos, v_refreshed_at
  FROM vw_metricas_solicitudes
  LIMIT 1;

  IF v_tiempos IS NULL THEN
    v_tiempos := jsonb_build_object('avg_horas', NULL, 'mediana_horas', NULL, 'p95_horas', NULL);
  END IF;

  RETURN jsonb_build_object(
    'total_acumulado',   v_total,
    'pendientes',        v_pendientes,
    'en_proceso',        v_en_proceso,
    'resueltas_hoy',     v_resueltas_hoy,
    'tiempos_resolucion', v_tiempos,
    'vista_refreshed_at', v_refreshed_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_metricas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_metricas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION public.get_metricas_mantenimiento() IS
  'Sprint 14 · HU-EJEC-02 — KPIs en vivo + tiempos de resolución desde vista materializada. Valida rol admin/observador.';

-- 5. Actualizar get_graficas_mantenimiento() para permitir rol 'observador'
CREATE OR REPLACE FUNCTION public.get_graficas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row vw_metricas_solicitudes%ROWTYPE;
BEGIN
  -- Validación de rol: permite admin y observador
  IF NOT public.puede_ver_metricas() THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin u observador'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM vw_metricas_solicitudes LIMIT 1;

  RETURN jsonb_build_object(
    'por_tipo',          COALESCE(v_row.por_tipo,           '[]'::jsonb),
    'tendencia_mensual', COALESCE(v_row.tendencia_mensual,  '[]'::jsonb),
    'top_categorias',    COALESCE(v_row.top_categorias,     '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_graficas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_graficas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION public.get_graficas_mantenimiento() IS
  'Sprint 14 · HU-EJEC-02 — Gráficas Recharts desde vista materializada. Valida rol admin/observador.';
