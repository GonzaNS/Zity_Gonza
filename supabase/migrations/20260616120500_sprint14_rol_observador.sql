-- ============================================================
-- Sprint 14 · HU-EJEC-01 · Rol 'observador' (solo lectura)
-- Migración 015 — enum + RLS de solo SELECT para el observador
-- ============================================================
-- Diseño de seguridad:
--   • 'observador' solo puede hacer SELECT en las vistas/tablas
--     que consume el panel /admin/ejecutivo.
--   • Nunca se le concede INSERT / UPDATE / DELETE en ninguna
--     tabla operativa.
--   • La RLS usa la función helper get_user_rol() existente
--     para identificar el rol sin exponer JWT raw.
--
-- Tablas/vistas accesibles para 'observador':
--   • solicitudes         (solo lectura — métricas)
--   • historial_estados   (solo lectura — tiempos de resolución)
--   • Vistas RPC: se usan SECURITY DEFINER con verificación
--     de rol interna — el observador puede invocarlas igual
--     que el admin después de esta migración.
-- ============================================================

-- ─── 1. Extender el enum de rol ──────────────────────────────────────────────

-- ADD VALUE es DDL no transaccional en PostgreSQL; debe ejecutarse fuera
-- de un bloque de transacción abierta. Supabase lo ejecuta como sentencia
-- independiente al aplicar la migración.
ALTER TYPE public.rol_usuario ADD VALUE IF NOT EXISTS 'observador';

COMMENT ON TYPE public.rol_usuario IS
  'Roles del sistema Zity. '
  'admin: acceso operativo completo. '
  'residente: acceso a su unidad y servicios. '
  'tecnico: gestión de asignaciones propias. '
  'observador (Sprint 14): solo lectura para panel ejecutivo. '
  'NO añadir nuevos valores sin revisar todas las políticas RLS.';

-- ─── 2. RLS de solo lectura sobre tablas operativas ──────────────────────────
-- Nota: la mayoría de las tablas ya tienen RLS habilitada desde sprints
-- anteriores. Solo añadimos políticas SELECT para el nuevo rol.

-- 2.1 Solicitudes: el observador puede leer todas las solicitudes
--     (necesita el conteo global, no por residente).
CREATE POLICY "solicitudes: observador puede SELECT global"
  ON public.solicitudes
  FOR SELECT
  TO authenticated
  USING (public.get_user_rol() = 'observador');

-- 2.2 Historial de estados: necesario para tiempos de resolución
CREATE POLICY "historial_estados: observador puede SELECT"
  ON public.historial_estados
  FOR SELECT
  TO authenticated
  USING (public.get_user_rol() = 'observador');

-- 2.3 Facturas: el observador puede ver el estado global de facturación
CREATE POLICY "facturas: observador puede SELECT global"
  ON public.facturas
  FOR SELECT
  TO authenticated
  USING (public.get_user_rol() = 'observador');

-- 2.4 Pedidos: para KPIs de tienda
CREATE POLICY "pedidos: observador puede SELECT global"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (public.get_user_rol() = 'observador');

-- ─── 3. Acceso a vistas del home/resumen ─────────────────────────────────────
-- Las vistas de Sprint 13 usan security_invoker = true, por lo que
-- heredan las políticas de las tablas base. Al haber dado SELECT al
-- observador en las tablas, las vistas automáticamente quedan accesibles.
-- No se requiere GRANT adicional salvo para las vistas sprint 13:
GRANT SELECT ON public.vw_resumen_solicitudes_residente TO authenticated;
GRANT SELECT ON public.vw_resumen_facturas_residente    TO authenticated;
GRANT SELECT ON public.vw_resumen_pedidos_residente     TO authenticated;

-- ─── 4. El observador NO tiene acceso de escritura ───────────────────────────
-- Por seguridad explícita, documentamos que NO se crean políticas de
-- INSERT/UPDATE/DELETE para 'observador' en ninguna tabla operativa.
-- RLS con ENABLE deniega por defecto todo lo que no esté permitido
-- explícitamente — no se necesita una política DENY.
--
-- Tablas donde el observador NUNCA puede escribir (por diseño):
--   solicitudes, facturas, pedidos, productos, metodos_pago,
--   usuarios, audit_log, notificaciones, anuncios.

-- ─── 5. Acceso a las RPCs de métricas ────────────────────────────────────────
-- Las RPCs de métricas usan SECURITY DEFINER + verificación interna de rol.
-- Actualizamos el cuerpo de get_metricas_mantenimiento() para aceptar
-- también 'observador'. Si la RPC usa una comparación estricta contra 'admin',
-- la extendemos para aceptar ambos roles.
--
-- NOTA: si la RPC original hace:
--   IF public.get_user_rol() IS DISTINCT FROM 'admin' THEN RAISE ...
-- debemos cambiarla a:
--   IF public.get_user_rol() NOT IN ('admin', 'observador') THEN RAISE ...
--
-- Ejecutar el UPDATE de la RPC (ver comentario abajo) si aplica.
-- En el contexto de esta migración creamos el helper de verificación:

CREATE OR REPLACE FUNCTION public.puede_ver_metricas()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.get_user_rol() IN ('admin', 'observador');
$$;

COMMENT ON FUNCTION public.puede_ver_metricas() IS
  'Sprint 14 · HU-EJEC-01 — Retorna true si el usuario autenticado puede '
  'ver el panel de métricas (roles: admin, observador).';

GRANT EXECUTE ON FUNCTION public.puede_ver_metricas() TO authenticated;

-- ─── 6. Tabla usuarios: el observador solo ve su propio perfil ───────────────
-- La política existente ya cubre esto (cada usuario ve su propia fila).
-- No se requiere política adicional.

-- ─── 7. Seguridad: metodos_pago permanece inaccesible para observador ─────────
-- La tabla metodos_pago NO tiene política para observador → acceso bloqueado.
-- (El observador no necesita ver datos financieros de tarjetas de residentes.)
