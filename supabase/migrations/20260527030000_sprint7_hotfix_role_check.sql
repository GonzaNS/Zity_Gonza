-- ============================================================
-- Sprint 7 · Hotfix · Verificación de rol via get_user_rol()
-- ============================================================
-- Las 4 funciones originales del Sprint 7 leian el rol con:
--   SELECT (auth.jwt() -> 'app_metadata' ->> 'rol') INTO v_rol;
--
-- Eso es INCORRECTO para Zity: el rol del usuario vive en la columna
-- public.usuarios.rol (no en app_metadata del JWT). El seed crea los
-- usuarios con user_metadata={rol: 'admin', ...} y handle_new_user()
-- copia eso a public.usuarios.rol. app_metadata queda vacio
-- (provider/providers de Supabase Auth) y por eso la validación
-- rechazaba a Carlos (admin legítimo) con "Acceso denegado".
--
-- Patrón estándar del proyecto: usar la función helper get_user_rol()
-- (declarada en migraciones consolidadas iniciales) que hace:
--   SELECT rol FROM public.usuarios WHERE id = auth.uid()
--
-- Este hotfix reescribe las 4 RPCs del Sprint 7 para usar get_user_rol().

-- ────────────────────────────────────────────────────────────
-- 1. get_metricas_mantenimiento  (PBI-22, refactored to read from MV)
-- ────────────────────────────────────────────────────────────
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
  -- Validación de rol: lee desde public.usuarios via helper estándar
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- Contadores en vivo (rápidos, no materializados)
  SELECT COUNT(*) INTO v_total FROM solicitudes;
  SELECT COUNT(*) INTO v_pendientes FROM solicitudes WHERE estado = 'pendiente';
  SELECT COUNT(*) INTO v_en_proceso  FROM solicitudes WHERE estado IN ('asignada','en_progreso');
  SELECT COUNT(*) INTO v_resueltas_hoy
  FROM solicitudes
  WHERE estado IN ('resuelta','cerrada') AND updated_at::date = v_hoy;

  -- Tiempos de resolución desde la vista materializada (~1 ms)
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

REVOKE ALL ON FUNCTION get_metricas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_metricas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_metricas_mantenimiento() IS
  'Sprint 7 · PBI-22 (hotfix role check) — KPIs en vivo + tiempos de resolución desde vista materializada. Valida rol admin vía get_user_rol().';

-- ────────────────────────────────────────────────────────────
-- 2. get_graficas_mantenimiento  (HU-KPI-01, reads from MV)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_graficas_mantenimiento()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row vw_metricas_solicitudes%ROWTYPE;
BEGIN
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
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

REVOKE ALL ON FUNCTION get_graficas_mantenimiento() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_graficas_mantenimiento() TO authenticated;

COMMENT ON FUNCTION get_graficas_mantenimiento() IS
  'Sprint 7 · HU-KPI-01 (hotfix role check) — Gráficas Recharts desde vista materializada. Valida rol admin vía get_user_rol().';

-- ────────────────────────────────────────────────────────────
-- 3. export_solicitudes_csv  (PBI-17)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION export_solicitudes_csv(f_inicio date, f_fin date)
RETURNS TABLE (
  "ID Solicitud" uuid,
  "Estado" text,
  "Tipo" text,
  "Categoría" text,
  "Fecha Creación" text,
  "Fecha Actualización" text,
  "Nombre Residente" text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id AS "ID Solicitud",
    s.estado AS "Estado",
    s.tipo AS "Tipo",
    s.categoria AS "Categoría",
    to_char(s.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS "Fecha Creación",
    to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS "Fecha Actualización",
    COALESCE(p.nombre || ' ' || p.apellido, '—') AS "Nombre Residente"
  FROM solicitudes s
  LEFT JOIN usuarios p ON s.residente_id = p.id
  WHERE s.created_at >= f_inicio::timestamp
    AND s.created_at < (f_fin + interval '1 day')::timestamp
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION export_solicitudes_csv(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_solicitudes_csv(date, date) TO authenticated;

COMMENT ON FUNCTION export_solicitudes_csv(date, date) IS
  'Sprint 7 · PBI-17 (hotfix role check) — Exportar solicitudes a CSV. Valida rol admin vía get_user_rol().';

-- ────────────────────────────────────────────────────────────
-- 4. refresh_metricas_on_demand  (sin cambio funcional, solo cleanup)
-- ────────────────────────────────────────────────────────────
-- refresh_metricas_on_demand() no validaba rol antes (cualquier authenticated
-- podía dispararlo, pero solo refresca si la vista tiene >1h). Mantenemos el
-- comportamiento, ya que el costo del refresh es acotado y es llamado por
-- pg_cron (que corre sin JWT) además del hook del frontend.
-- Sin cambios — la función actual ya está correcta.
