-- ============================================================
-- Sprint 13 · HU-HOME-04 · Tarjeta 'Pedidos del mes'
-- Migración: vista vw_home_pedidos para el dashboard del residente
-- ============================================================
-- Diseño:
--   • Devuelve los pedidos NO-borrador del residente del MES ACTUAL
--     (confirmado | facturado), ordenados por created_at DESC.
--   • Columnas de ventana para los KPIs del mes que muestra la cabecera:
--       pedidos_mes   — número de pedidos del mes
--       unidades_mes  — suma de unidades en todos los pedidos del mes
--       total_mes     — suma de totales del mes (numeric exacto desde BD)
--   • Limitado a 3 filas para el feed del home.
--   • La columna `items_count` evita un JOIN costoso: se calcula como
--     subconsulta escalar (muy barata dado el LIMIT 3).
--   • El mes se calcula en America/Lima para consistencia con facturas.
--   • security_invoker = true → la RLS de 'pedidos' aplica al llamante
--     (residente solo ve los suyos).
-- ============================================================

CREATE OR REPLACE VIEW public.vw_home_pedidos
WITH (security_invoker = true)
AS
WITH mes_actual AS (
  -- Período del mes actual en Lima (ej. '2026-06')
  SELECT to_char(now() AT TIME ZONE 'America/Lima', 'YYYY-MM') AS periodo_mes
),
pedidos_mes AS (
  SELECT
    p.id,
    p.estado,
    p.total,
    p.periodo,
    p.factura_id,
    p.created_at,
    -- Número de ítems/líneas del pedido (subconsulta escalar, LIMIT 3 en outer)
    (
      SELECT COALESCE(SUM(pi.cantidad), 0)
      FROM public.pedido_items pi
      WHERE pi.pedido_id = p.id
    ) AS unidades_pedido
  FROM public.pedidos p, mes_actual m
  WHERE p.estado NOT IN ('borrador')
    AND to_char(p.created_at AT TIME ZONE 'America/Lima', 'YYYY-MM') = m.periodo_mes
)
SELECT
  id,
  estado,
  total::numeric                   AS total,
  periodo,
  factura_id,
  created_at,
  unidades_pedido,

  -- KPIs del mes como columnas de ventana (se repiten en cada fila)
  COUNT(*)        OVER ()          AS pedidos_mes,
  SUM(unidades_pedido) OVER ()     AS unidades_mes,
  SUM(total)      OVER ()          AS total_mes

FROM pedidos_mes
ORDER BY created_at DESC
LIMIT 3;

COMMENT ON VIEW public.vw_home_pedidos IS
  'Sprint 13 · HU-HOME-04 — Feed de pedidos del mes actual del residente para '
  'la tarjeta del dashboard home. Incluye KPIs (pedidos_mes, unidades_mes, '
  'total_mes) como columnas de ventana. Limitado a 3 filas. '
  'security_invoker=true: la RLS de pedidos aplica al llamante.';

-- Permisos
GRANT SELECT ON public.vw_home_pedidos TO authenticated;
REVOKE ALL  ON public.vw_home_pedidos FROM anon, public;
