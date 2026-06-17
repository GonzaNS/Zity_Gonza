-- ============================================================
-- Sprint 14 · Hardening de grants (post-recreación de la matview)
-- ============================================================
-- Contexto:
--   • Al recrear vw_metricas_solicitudes (migración sprint14_volumen_resueltas)
--     se reintrodujo GRANT SELECT a 'authenticated', exponiendo la vista
--     materializada en la Data API (advisor 0016 materialized_view_in_api) y
--     revirtiendo la decisión del Sprint 7: la matview se lee SOLO a través de
--     las RPCs SECURITY DEFINER get_metricas_mantenimiento / get_graficas_mantenimiento.
--   • Las RPCs nuevas del dashboard ejecutivo (get_metricas_finanzas /
--     get_metricas_tienda) heredaron EXECUTE para el rol 'anon' por los
--     default privileges de Supabase (advisor 0028). Requieren sesión.
-- Este hardening restaura el blindaje sin afectar el acceso legítimo:
--   las RPCs son SECURITY DEFINER y leen la matview con permisos del owner.
-- ============================================================

-- 1. La vista materializada NO se expone en la Data API: acceso solo vía RPC.
REVOKE ALL ON public.vw_metricas_solicitudes FROM anon, authenticated;

-- 2. Las RPCs del panel ejecutivo no son ejecutables por 'anon' (requieren login;
--    el guard interno admite solo admin/observador).
REVOKE EXECUTE ON FUNCTION public.get_metricas_finanzas(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_metricas_tienda(text)   FROM anon;
