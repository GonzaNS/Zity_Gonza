-- ============================================================
-- Sprint 7 · PBI-17 · Exportar solicitudes a CSV
-- ============================================================
-- Crea la función RPC export_solicitudes_csv() que devuelve
-- solicitudes de mantenimiento formateadas para exportación CSV.
--
-- Columnas en español y fechas en formato YYYY-MM-DD HH24:MI.
-- Solo accesible por admins (verificado via JWT).
--
-- Para generar el CSV en el cliente, se llama usando:
-- supabase.rpc('export_solicitudes_csv', { f_inicio, f_fin }).csv()
-- ============================================================

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
DECLARE
  v_rol text;
BEGIN
  -- ── 1. Verificación de rol ──────────────────────────────────────────────────
  SELECT (auth.jwt() -> 'app_metadata' ->> 'rol')
  INTO v_rol;

  IF v_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- ── 2. Consulta y formateo de datos ──────────────────────────────────────────
  -- f_fin se considera INCLUSIVO por día, así que filtramos hasta f_fin + 1 día
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
  LEFT JOIN perfiles p ON s.residente_id = p.id
  WHERE s.created_at >= f_inicio::timestamp
    AND s.created_at < (f_fin + interval '1 day')::timestamp
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION export_solicitudes_csv(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION export_solicitudes_csv(date, date) TO authenticated;

COMMENT ON FUNCTION export_solicitudes_csv(date, date) IS
  'PBI-17: Exportar solicitudes a CSV con cabeceras en español. Solo admin.';
