-- ============================================================
-- Sprint 7 · Refactor · Vista Materializada + pg_cron
-- Migración: 20260527010000_sprint7_vw_metricas_solicitudes.sql
-- ============================================================
-- Estrategia de performance:
--   • Los contadores básicos (pendientes, en_proceso, resueltas_hoy)
--     son baratos (3x COUNT simple) → siguen calculándose en vivo
--     para garantizar exactitud al segundo.
--   • Los agregados pesados (tiempos de resolución AVG/mediana/P95,
--     gráficas por tipo / top categorías / tendencia mensual) se
--     materializan en vw_metricas_solicitudes y se refrescan cada
--     hora con pg_cron.
--   • Fallback on-demand: si la vista tiene >1h de antigüedad al
--     abrir /admin/metricas, el hook dispara un refresh inmediato.
--
-- Performance esperada: ~600 ms → ~20 ms en lecturas del panel.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Vista Materializada
-- ────────────────────────────────────────────────────────────
-- Almacena en una sola fila todos los agregados costosos:
--   tiempos_resolucion  (JSONB)  ← AVG, mediana, P95
--   por_tipo            (JSONB)  ← conteo por tipo
--   top_categorias      (JSONB)  ← top 5 categorías
--   tendencia_mensual   (JSONB)  ← avg + mediana por mes (6 meses)
--   refreshed_at        (TIMESTAMPTZ) ← marca del último REFRESH

CREATE MATERIALIZED VIEW IF NOT EXISTS vw_metricas_solicitudes AS
WITH tiempos AS (
  -- Calcula horas desde creación hasta primera transición a resuelta/cerrada
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
      'mediana_horas',  ROUND(med_h::numeric, 2)
    ) ORDER BY mes
  ) AS datos
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.created_at), 'YYYY-MM') AS mes,
      AVG(EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0)    AS avg_h,
      percentile_cont(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (he.primera_resolucion - s.created_at)) / 3600.0
      ) AS med_h
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
  -- Tiempos de resolución (agregados costosos)
  jsonb_build_object(
    'avg_horas',     ROUND(e.avg_horas::numeric, 2),
    'mediana_horas', ROUND(e.mediana_horas::numeric, 2),
    'p95_horas',     ROUND(e.p95_horas::numeric, 2)
  )                             AS tiempos_resolucion,
  -- Gráficas (costosas)
  COALESCE(pt.datos, '[]'::jsonb)  AS por_tipo,
  COALESCE(tc.datos, '[]'::jsonb)  AS top_categorias,
  COALESCE(t.datos,  '[]'::jsonb)  AS tendencia_mensual,
  -- Marca de tiempo del último refresh
  NOW()                            AS refreshed_at
FROM estadisticos e, por_tipo pt, top_cats tc, tendencia t;

-- ────────────────────────────────────────────────────────────
-- PARTE B: Índice UNIQUE — requerido para REFRESH CONCURRENTLY
-- ────────────────────────────────────────────────────────────
-- REFRESH MATERIALIZED VIEW CONCURRENTLY necesita al menos un
-- índice UNIQUE para poder intercambiar filas sin bloquear lecturas.
-- Usamos refreshed_at (única fila en la vista, siempre distinta).
CREATE UNIQUE INDEX IF NOT EXISTS vw_metricas_solicitudes_refreshed_at_idx
  ON vw_metricas_solicitudes (refreshed_at);

-- ────────────────────────────────────────────────────────────
-- PARTE C: RPC refresh_metricas_on_demand()
-- ────────────────────────────────────────────────────────────
-- Refresca la vista SI tiene más de 1 hora de antigüedad.
-- Lo llama el cron job y también el hook del frontend como fallback.
-- Devuelve si se refrescó (true) o si ya estaba fresca (false).

CREATE OR REPLACE FUNCTION refresh_metricas_on_demand()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_refreshed_at timestamptz;
  v_necesita_refresh boolean;
BEGIN
  -- Leer la marca del último refresh
  SELECT refreshed_at INTO v_refreshed_at
  FROM vw_metricas_solicitudes
  LIMIT 1;

  -- Si la vista está vacía o tiene >1h de antigüedad, refrescar
  v_necesita_refresh := (v_refreshed_at IS NULL OR v_refreshed_at < NOW() - INTERVAL '1 hour');

  IF v_necesita_refresh THEN
    -- CONCURRENTLY: no bloquea lecturas concurrentes durante el refresh
    REFRESH MATERIALIZED VIEW CONCURRENTLY vw_metricas_solicitudes;
  END IF;

  RETURN v_necesita_refresh;
END;
$$;

REVOKE ALL ON FUNCTION refresh_metricas_on_demand() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_metricas_on_demand() TO authenticated;

COMMENT ON FUNCTION refresh_metricas_on_demand() IS
  'Sprint 7 Refactor — Refresca vw_metricas_solicitudes si tiene >1h de antigüedad. '
  'Usado por pg_cron y como fallback on-demand desde el hook useMetricasMantenimiento.';

-- ────────────────────────────────────────────────────────────
-- PARTE D: pg_cron — INSTRUCCIONES MANUALES
-- ────────────────────────────────────────────────────────────
-- pg_cron NO se puede habilitar con una migración SQL estándar.
-- Pasos para activar el refresh automático cada hora:
--
-- 1. En el panel de Supabase → Database → Extensions → buscar "pg_cron" → Enable
-- 2. Una vez habilitada, ejecutar en el SQL Editor:
--
--    SELECT cron.schedule(
--      'refresh-metricas-hourly',   -- nombre del job
--      '0 * * * *',                 -- cada hora en punto
--      $$SELECT refresh_metricas_on_demand()$$
--    );
--
-- 3. Para verificar que el job quedó registrado:
--    SELECT * FROM cron.job;
--
-- 4. Para eliminar el job si es necesario:
--    SELECT cron.unschedule('refresh-metricas-hourly');
--
-- NOTA: Sin pg_cron, el fallback on-demand del hook garantiza que la
-- vista nunca sirva datos con más de 1h de antigüedad cuando el admin
-- abre el panel, aunque el refresh ocurra al cargar en lugar de en background.

-- ────────────────────────────────────────────────────────────
-- PARTE E: Actualizar get_metricas_mantenimiento()
-- ────────────────────────────────────────────────────────────
-- Ahora lee los tiempos de resolución de la vista materializada
-- (lectura en ~1 ms) y los contadores básicos en vivo (3x COUNT rápido).

CREATE OR REPLACE FUNCTION get_metricas_mantenimiento()
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
  -- 1. Verificación de rol (get_user_rol lee public.usuarios.rol via auth.uid())
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Contadores en vivo (baratos: 4x COUNT simple)
  SELECT COUNT(*) INTO v_total FROM solicitudes;
  SELECT COUNT(*) INTO v_pendientes FROM solicitudes WHERE estado = 'pendiente';
  SELECT COUNT(*) INTO v_en_proceso  FROM solicitudes WHERE estado IN ('asignada','en_progreso');
  SELECT COUNT(*) INTO v_resueltas_hoy
  FROM solicitudes
  WHERE estado IN ('resuelta','cerrada') AND updated_at::date = v_hoy;

  -- 3. Tiempos de resolución desde la vista materializada (~1 ms)
  SELECT tiempos_resolucion, refreshed_at
  INTO v_tiempos, v_refreshed_at
  FROM vw_metricas_solicitudes
  LIMIT 1;

  -- Si la vista está vacía (primera vez), usar NULL
  IF v_tiempos IS NULL THEN
    v_tiempos := jsonb_build_object('avg_horas', NULL, 'mediana_horas', NULL, 'p95_horas', NULL);
  END IF;

  -- 4. Resultado
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

REVOKE ALL ON FUNCTION get_metricas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_metricas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_metricas_mantenimiento() IS
  'Sprint 7 Refactor — KPIs en vivo (contadores) + tiempos de resolución desde vista materializada. '
  'Solo ejecutable por usuarios con rol=admin.';

-- ────────────────────────────────────────────────────────────
-- PARTE F: Actualizar get_graficas_mantenimiento()
-- ────────────────────────────────────────────────────────────
-- Lee los tres datasets de gráficas directamente desde la vista
-- materializada, descartando los cálculos pesados en vivo.

CREATE OR REPLACE FUNCTION get_graficas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row vw_metricas_solicitudes%ROWTYPE;
BEGIN
  -- 1. Verificación de rol (get_user_rol lee public.usuarios.rol via auth.uid())
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Leer desde vista materializada (~1 ms)
  SELECT * INTO v_row FROM vw_metricas_solicitudes LIMIT 1;

  -- 3. Devolver mismo contrato JSON que antes (sin breaking changes)
  RETURN jsonb_build_object(
    'por_tipo',          COALESCE(v_row.por_tipo,           '[]'::jsonb),
    'tendencia_mensual', COALESCE(v_row.tendencia_mensual,  '[]'::jsonb),
    'top_categorias',    COALESCE(v_row.top_categorias,     '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION get_graficas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_graficas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_graficas_mantenimiento() IS
  'Sprint 7 Refactor — Gráficas Recharts desde vista materializada (lectura ~1 ms). '
  'Solo ejecutable por usuarios con rol=admin.';
