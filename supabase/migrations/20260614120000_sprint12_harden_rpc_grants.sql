-- ============================================================
-- Sprint 12 · Hardening — REVOKE EXECUTE en RPCs y funciones de trigger
-- (advisors 0028 anon_security_definer_function_executable y
--  0029 authenticated_security_definer_function_executable)
-- ============================================================
-- Las RPCs de admin ya validan el rol en su body (get_user_rol() = 'admin'),
-- pero seguían siendo invocables por `anon` vía /rest/v1/rpc/. Se revoca el
-- EXECUTE del rol anónimo como defensa en profundidad (patrón ya usado en las
-- migraciones del S11/S12 para las funciones nuevas; estas son anteriores).
--
-- Las funciones de TRIGGER nunca deben llamarse vía API: el chequeo de EXECUTE
-- sobre una función de trigger ocurre en CREATE TRIGGER, no al dispararse, así
-- que revocar a los roles de la API no afecta el funcionamiento de los triggers.
-- ============================================================

-- ── RPCs de admin (validan rol internamente; solo necesitan authenticated) ──
REVOKE EXECUTE ON FUNCTION public.emitir_facturas_lote(text, numeric, text, date, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.export_solicitudes_csv(date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_graficas_mantenimiento() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_metricas_mantenimiento() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.refresh_metricas_on_demand() FROM anon, public;

-- ── Funciones de trigger (no expuestas a ningún rol de la API) ──
REVOKE EXECUTE ON FUNCTION public.generate_solicitud_codigo() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.guard_usuario_estado_y_rol() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_solicitud_creada() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.log_solicitud_prioridad_cambiada() FROM anon, authenticated, public;
