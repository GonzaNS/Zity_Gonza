-- ============================================================
-- Sprint 13 · HU-HOME-02 · Tarjeta 'Solicitudes activas'
-- Migración: vista vw_home_solicitudes para el dashboard del residente
-- ============================================================
-- Diseño:
--   • Devuelve las solicitudes ACTIVAS del residente autenticado
--     (estados: pendiente, asignada, en_progreso, resuelta).
--     'cerrada' queda excluida — ya no requiere atención del residente.
--   • Embebe los últimos 3 cambios de estado (historial_estados)
--     como columna JSONB `ultimos_estados`, ordenados del más reciente
--     al más antiguo. El cliente los renderiza sin queries adicionales.
--   • security_invoker = true → la RLS de las tablas base aplica al
--     llamante (residente): solo ve sus propias solicitudes.
--   • Ordenada por updated_at DESC — la más reciente primero.
--   • Limitada a 5 solicitudes en la vista — es el feed del home,
--     no el historial completo (ese vive en /residente/solicitudes).
-- ============================================================

CREATE OR REPLACE VIEW public.vw_home_solicitudes
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.codigo,
  s.tipo,
  s.categoria,
  s.descripcion,
  s.estado,
  s.prioridad,
  s.imagen_url,
  s.created_at,
  s.updated_at,

  -- Últimos 3 cambios de estado como JSONB array
  -- Cada entrada: { estado_nuevo, estado_anterior, created_at, nota }
  -- Ordenados del más reciente al más antiguo (DESC).
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'estado_nuevo',      he.estado_nuevo,
          'estado_anterior',   he.estado_anterior,
          'created_at',        he.created_at,
          'nota',              he.nota
        )
        ORDER BY he.created_at DESC
      )
      FROM (
        SELECT estado_nuevo, estado_anterior, created_at, nota
        FROM public.historial_estados
        WHERE solicitud_id = s.id
        ORDER BY created_at DESC
        LIMIT 3
      ) he
    ),
    '[]'::jsonb
  ) AS ultimos_estados

FROM public.solicitudes s
WHERE s.estado IN ('pendiente', 'asignada', 'en_progreso', 'resuelta')
ORDER BY s.updated_at DESC
LIMIT 5;

COMMENT ON VIEW public.vw_home_solicitudes IS
  'Sprint 13 · HU-HOME-02 — Feed de solicitudes activas del residente para la '
  'tarjeta del dashboard home. Incluye los últimos 3 cambios de estado (JSONB). '
  'security_invoker=true: la RLS de solicitudes aplica al llamante. '
  'Limitada a 5 filas — el listado completo vive en /residente/solicitudes.';

-- Permisos
GRANT SELECT ON public.vw_home_solicitudes TO authenticated;
REVOKE ALL  ON public.vw_home_solicitudes FROM anon, public;
