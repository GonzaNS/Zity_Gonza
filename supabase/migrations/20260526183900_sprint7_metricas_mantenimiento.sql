-- ============================================================
-- Sprint 7 · PBI-22 · Panel de métricas /admin/metricas
-- ============================================================
-- Crea la función RPC get_metricas_mantenimiento() que devuelve
-- todos los KPIs operativos del módulo de mantenimiento en una
-- sola llamada, protegida por SECURITY DEFINER + chequeo de rol.
--
-- El cliente llama: supabase.rpc('get_metricas_mantenimiento')
-- y obtiene un JSON único con:
--   total_acumulado   INTEGER
--   pendientes        INTEGER
--   en_proceso        INTEGER  (asignada + en_progreso)
--   resueltas_hoy     INTEGER  (resuelta + cerrada con updated_at = today UTC)
--   tiempos_resolucion: {
--     avg_horas       NUMERIC | null
--     mediana_horas   NUMERIC | null
--     p95_horas       NUMERIC | null
--   }
-- ============================================================

CREATE OR REPLACE FUNCTION get_metricas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total    integer;
  v_pendientes integer;
  v_en_proceso integer;
  v_hoy      date := CURRENT_DATE;

  -- Para tiempo de resolución usamos historial_estados:
  -- buscamos la primera transición hacia 'resuelta' o 'cerrada' por solicitud
  -- y la restamos de created_at de la solicitud (en horas).
  v_tiempos  numeric[];
  v_avg      numeric;
  v_mediana  numeric;
  v_p95      numeric;
  v_resueltas_hoy integer;
BEGIN
  -- ── 1. Verificación de rol ──────────────────────────────────────────────────
  -- get_user_rol() es el helper estándar del proyecto: lee public.usuarios.rol
  -- via auth.uid(). El rol vive en la tabla `usuarios` (no en JWT app_metadata),
  -- porque handle_new_user() lo copia de raw_user_meta_data al crear el perfil.
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  -- ── 2. Contadores básicos ───────────────────────────────────────────────────
  SELECT COUNT(*) INTO v_total FROM solicitudes;

  SELECT COUNT(*) INTO v_pendientes
  FROM solicitudes WHERE estado = 'pendiente';

  SELECT COUNT(*) INTO v_en_proceso
  FROM solicitudes WHERE estado IN ('asignada', 'en_progreso');

  -- Resueltas HOY: estado resuelta o cerrada, con updated_at en la fecha actual UTC
  SELECT COUNT(*) INTO v_resueltas_hoy
  FROM solicitudes
  WHERE estado IN ('resuelta', 'cerrada')
    AND updated_at::date = v_hoy;

  -- ── 3. Tiempos de resolución ────────────────────────────────────────────────
  -- Por cada solicitud que haya llegado a 'resuelta' o 'cerrada',
  -- calculamos horas = primera_vez_resuelta - created_at.
  -- Usamos ARRAY_AGG para hacer los cálculos de mediana y P95 en PL/pgSQL
  -- (PostgreSQL no tiene percentile_disc sobre arrays directamente, pero sí
  -- tiene la función de agregado percentile_disc dentro de una consulta).
  SELECT
    ARRAY_AGG(diff_horas ORDER BY diff_horas)
  INTO v_tiempos
  FROM (
    SELECT
      EXTRACT(EPOCH FROM (he.created_at - s.created_at)) / 3600.0 AS diff_horas
    FROM solicitudes s
    JOIN LATERAL (
      SELECT MIN(created_at) AS created_at
      FROM historial_estados
      WHERE solicitud_id = s.id
        AND estado_nuevo IN ('resuelta', 'cerrada')
    ) he ON he.created_at IS NOT NULL
    WHERE EXTRACT(EPOCH FROM (he.created_at - s.created_at)) >= 0
  ) tiempos;

  -- Si no hay datos suficientes, dejamos NULLs (el cliente los mostrará como
  -- 'Sin datos suficientes').
  IF v_tiempos IS NOT NULL AND array_length(v_tiempos, 1) >= 1 THEN
    -- AVG
    SELECT AVG(t) INTO v_avg FROM UNNEST(v_tiempos) AS t;

    -- Mediana (percentile 50)
    SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t)
    INTO v_mediana
    FROM UNNEST(v_tiempos) AS t;

    -- P95 — solo si n >= 2 (con n=1, P95 = único valor pero puede ser engañoso;
    -- el criterio del PBI dice "sin datos suficientes" para P95 < 2 muestras).
    IF array_length(v_tiempos, 1) >= 2 THEN
      SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY t)
      INTO v_p95
      FROM UNNEST(v_tiempos) AS t;
    ELSE
      v_p95 := NULL;
    END IF;
  END IF;

  -- ── 4. Resultado ────────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'total_acumulado',  v_total,
    'pendientes',       v_pendientes,
    'en_proceso',       v_en_proceso,
    'resueltas_hoy',    v_resueltas_hoy,
    'tiempos_resolucion', jsonb_build_object(
      'avg_horas',     v_avg,
      'mediana_horas', v_mediana,
      'p95_horas',     v_p95
    )
  );
END;
$$;

-- La función usa SECURITY DEFINER (corre como el owner, normalmente postgres).
-- Revocamos ejecución pública y solo dejamos el rol authenticado para que
-- el propio body de la función valide el rol admin via JWT.
REVOKE ALL ON FUNCTION get_metricas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_metricas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_metricas_mantenimiento() IS
  'Sprint 7 · PBI-22 — KPIs operativos del módulo de mantenimiento. '
  'Solo ejecutable por usuarios con rol=admin (verificado via JWT app_metadata). '
  'Devuelve totales por estado + tiempos de resolución (AVG, mediana, P95).';
