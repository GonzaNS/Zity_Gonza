-- ============================================================
-- Sprint 13 · HU-HOME-01 · Dashboard integral del residente
-- Migración: vistas de resumen para las 3 tarjetas del home
-- ============================================================
-- Diseño:
--   • Las vistas usan security_invoker = true → la RLS de las
--     tablas base se aplica con el rol del llamante (residente),
--     garantizando que cada uno solo vea sus propios datos.
--   • Son de solo lectura y muy ligeras (sin JOINs costosos).
--   • El hook useResumenResidente las consulta en paralelo:
--       vw_resumen_solicitudes_residente
--       vw_resumen_facturas_residente
--       vw_resumen_pedidos_residente
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- VISTA 1: Resumen de solicitudes del residente
-- ────────────────────────────────────────────────────────────
-- Columnas expuestas:
--   total                   — total de solicitudes del residente
--   pendientes              — en estado 'pendiente'
--   en_progreso             — en estados 'asignada' | 'en_progreso'
--   pendientes_confirmacion — en estado 'resuelta' (esperan confirmación)
-- La RLS de 'solicitudes' (residente solo ve las suyas) hace que
-- auth.uid() no necesite compararse aquí: con security_invoker
-- la vista hereda la política del llamante.
CREATE OR REPLACE VIEW public.vw_resumen_solicitudes_residente
WITH (security_invoker = true)
AS
SELECT
  count(*)                                                              AS total,
  count(*) FILTER (WHERE estado = 'pendiente')                         AS pendientes,
  count(*) FILTER (WHERE estado IN ('asignada','en_progreso'))         AS en_progreso,
  count(*) FILTER (WHERE estado = 'resuelta')                         AS pendientes_confirmacion
FROM public.solicitudes;

COMMENT ON VIEW public.vw_resumen_solicitudes_residente IS
  'Sprint 13 · HU-HOME-01 — Contadores de solicitudes del residente para la tarjeta '
  'del dashboard. security_invoker=true: la RLS de solicitudes aplica al llamante.';

-- ────────────────────────────────────────────────────────────
-- VISTA 2: Resumen de facturas del residente
-- ────────────────────────────────────────────────────────────
-- Columnas expuestas:
--   total_pendiente_mes   — suma de montos pendientes del período actual (YYYY-MM)
--   facturas_vencidas     — facturas con estado='pendiente' y vencimiento < hoy
--   proxima_vencimiento   — fecha de vencimiento de la próxima factura pendiente
-- La RLS de 'facturas' (residente solo ve las suyas) aplica por security_invoker.
CREATE OR REPLACE VIEW public.vw_resumen_facturas_residente
WITH (security_invoker = true)
AS
SELECT
  coalesce(
    sum(monto) FILTER (
      WHERE estado = 'pendiente'
        AND periodo = to_char(now() AT TIME ZONE 'America/Lima', 'YYYY-MM')
    ), 0
  )                                                                          AS total_pendiente_mes,

  count(*) FILTER (
    WHERE estado = 'pendiente'
      AND vencimiento < (now() AT TIME ZONE 'America/Lima')::date
  )                                                                          AS facturas_vencidas,

  min(vencimiento) FILTER (
    WHERE estado = 'pendiente'
      AND vencimiento >= (now() AT TIME ZONE 'America/Lima')::date
  )                                                                          AS proxima_vencimiento
FROM public.facturas;

COMMENT ON VIEW public.vw_resumen_facturas_residente IS
  'Sprint 13 · HU-HOME-01 — Resumen financiero del residente para la tarjeta del '
  'dashboard: deuda del mes, vencidas y próximo vencimiento. security_invoker=true.';

-- ────────────────────────────────────────────────────────────
-- VISTA 3: Resumen de pedidos del residente
-- ────────────────────────────────────────────────────────────
-- Columnas expuestas:
--   total_pedidos    — pedidos no-borrador del residente
--   ultimo_pedido_at — timestamp del pedido más reciente
--   ultimo_total     — monto del pedido más reciente
-- La RLS de 'pedidos' (residente solo ve los suyos) aplica por security_invoker.
CREATE OR REPLACE VIEW public.vw_resumen_pedidos_residente
WITH (security_invoker = true)
AS
SELECT
  count(*)                                                   AS total_pedidos,
  max(created_at)                                            AS ultimo_pedido_at,
  (
    SELECT total
    FROM public.pedidos p2
    WHERE p2.estado != 'borrador'
      AND p2.residente_id = (select auth.uid())
    ORDER BY created_at DESC
    LIMIT 1
  )                                                          AS ultimo_total
FROM public.pedidos
WHERE estado != 'borrador';

COMMENT ON VIEW public.vw_resumen_pedidos_residente IS
  'Sprint 13 · HU-HOME-01 — Resumen de pedidos del residente para la tarjeta del '
  'dashboard: total, fecha y monto del último pedido. security_invoker=true.';

-- ────────────────────────────────────────────────────────────
-- Permisos: solo rol authenticated puede hacer SELECT
-- ────────────────────────────────────────────────────────────
GRANT SELECT ON public.vw_resumen_solicitudes_residente TO authenticated;
GRANT SELECT ON public.vw_resumen_facturas_residente    TO authenticated;
GRANT SELECT ON public.vw_resumen_pedidos_residente     TO authenticated;

REVOKE ALL ON public.vw_resumen_solicitudes_residente FROM anon, public;
REVOKE ALL ON public.vw_resumen_facturas_residente    FROM anon, public;
REVOKE ALL ON public.vw_resumen_pedidos_residente     FROM anon, public;
