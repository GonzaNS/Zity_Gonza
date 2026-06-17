-- ============================================================
-- Sprint 13 · HU-HOME-03 · Tarjeta 'Facturas pendientes'
-- Migración: vista vw_home_facturas para el dashboard del residente
-- ============================================================
-- Diseño:
--   • Devuelve las facturas PENDIENTES y VENCIDAS del residente
--     autenticado, ordenadas por vencimiento ASC (las más urgentes
--     primero), limitadas a 4 filas para el feed del home.
--   • Incluye columnas de ventana (sin subquery adicional) para los
--     totales que necesita la cabecera de la tarjeta:
--       total_pendiente   — suma de monto de todas las filas pendientes/vencidas
--       count_vencidas    — cuántas ya superaron su fecha de vencimiento
--       proxima_fecha     — la fecha de vencimiento más próxima (MIN)
--   • La columna `esta_vencida` permite al componente aplicar el badge
--     rojo sin recalcular en cliente (comparación date pura en Postgres).
--   • security_invoker = true → la RLS de 'facturas' aplica al llamante
--     (residente); solo ve las suyas.
--   • 'pagada' queda excluida — no requiere acción del residente.
-- ============================================================

CREATE OR REPLACE VIEW public.vw_home_facturas
WITH (security_invoker = true)
AS
SELECT
  -- Columnas de la factura individual
  f.id,
  f.tipo,
  f.monto,
  f.periodo,
  f.vencimiento,
  f.estado,
  f.numero,
  f.descripcion,
  f.created_at,

  -- ¿Ya venció? Calculado en servidor para no depender del TZ del cliente.
  -- Usa la fecha local de Lima para coincidir con la lógica del front.
  (f.vencimiento < (now() AT TIME ZONE 'America/Lima')::date) AS esta_vencida,

  -- Totales globales de las pendientes/vencidas del residente (window functions)
  -- Se repiten en cada fila; el hook lee solo la primera fila para los totales.
  SUM(f.monto)  OVER ()                                                     AS total_pendiente,
  COUNT(*)      FILTER (
    WHERE f.vencimiento < (now() AT TIME ZONE 'America/Lima')::date
  ) OVER ()                                                                  AS count_vencidas,
  MIN(f.vencimiento) OVER ()                                                 AS proxima_fecha

FROM public.facturas f
WHERE f.estado IN ('pendiente', 'vencida')
ORDER BY f.vencimiento ASC   -- urgentes primero
LIMIT 4;

COMMENT ON VIEW public.vw_home_facturas IS
  'Sprint 13 · HU-HOME-03 — Feed de facturas pendientes/vencidas del residente '
  'para la tarjeta del dashboard home. Incluye totales como columnas de ventana '
  '(total_pendiente, count_vencidas, proxima_fecha) y flag esta_vencida calculado '
  'en servidor. security_invoker=true: la RLS de facturas aplica al llamante. '
  'Limitada a 4 filas — el listado completo vive en /residente/facturas.';

-- Permisos
GRANT SELECT ON public.vw_home_facturas TO authenticated;
REVOKE ALL  ON public.vw_home_facturas FROM anon, public;
