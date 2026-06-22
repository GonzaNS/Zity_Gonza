-- Fix post Sprint 13/14 (PBI-S6-E03) — Cierre PERCEPTIBLE de las demás sesiones.
--
-- Problema: `supabase.auth.signOut({ scope: 'others' })` solo revoca los refresh
-- tokens del lado servidor; los access tokens (JWT) de las otras sesiones siguen
-- siendo válidos hasta su expiración (~1 h, claim `exp`). Por eso el cierre no era
-- perceptible ni al cambiar la contraseña ni con el botón "Cerrar las demás".
--
-- Solución: verificación activa por `session_id` (claim del JWT == auth.sessions.id):
--   • `usuarios.sesion_unica_id` marca cuál es la ÚNICA sesión válida del usuario.
--   • El cliente (AuthContext) cierra cualquier sesión cuyo session_id difiera, en
--     su próxima verificación (carga / foco de pestaña / intervalo) → segundos.
--   • Además se revocan server-side las demás sesiones (defensa en profundidad).

-- 1) Columna de control. NULL = sin restricción (varias sesiones permitidas).
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS sesion_unica_id uuid;

COMMENT ON COLUMN public.usuarios.sesion_unica_id IS
  'Si no es NULL, identifica la única sesión (auth.sessions.id) válida del usuario. '
  'El cliente cierra toda sesión cuyo session_id del JWT difiera. Se fija al cerrar '
  'las demás sesiones o al cambiar la contraseña; se limpia en cada login nuevo.';

-- 2) Cierra todas las demás sesiones del usuario actual:
--    a) marca la sesión actual como la única válida (verificación activa en cliente),
--    b) revoca server-side las demás (borra sus filas de auth.sessions).
--    Devuelve cuántas sesiones server-side se revocaron.
CREATE OR REPLACE FUNCTION public.cerrar_otras_sesiones()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  uid      uuid := auth.uid();
  sid      uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  cerradas integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'No hay un usuario autenticado.';
  END IF;
  IF sid IS NULL THEN
    -- El JWT siempre debería traer session_id; si no, fallamos ruidosamente en
    -- lugar de dejar la operación sin efecto (y borrar sesiones equivocadas).
    RAISE EXCEPTION 'El token no incluye session_id; no se pueden cerrar las otras sesiones.';
  END IF;

  UPDATE public.usuarios SET sesion_unica_id = sid WHERE id = uid;

  DELETE FROM auth.sessions WHERE user_id = uid AND id <> sid;
  GET DIAGNOSTICS cerradas = ROW_COUNT;

  RETURN cerradas;
END;
$$;

COMMENT ON FUNCTION public.cerrar_otras_sesiones() IS
  'Cierra todas las sesiones del usuario salvo la actual: fija usuarios.sesion_unica_id '
  'con el session_id del JWT y borra de auth.sessions las demás. Devuelve cuántas revocó.';

-- 3) Limpia la restricción de sesión única. Se invoca tras cada login nuevo
--    legítimo para que la sesión recién creada no se auto-cierre por no coincidir
--    con la marca dejada por un "cerrar otras sesiones" anterior.
CREATE OR REPLACE FUNCTION public.limpiar_sesion_unica()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.usuarios SET sesion_unica_id = NULL WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.limpiar_sesion_unica() IS
  'Resetea usuarios.sesion_unica_id del usuario actual. Se llama tras cada login nuevo '
  'para que la sesión recién creada no se cierre por la restricción anterior.';

-- 4) Permisos: ambas RPC las invoca el propio usuario autenticado.
REVOKE ALL ON FUNCTION public.cerrar_otras_sesiones() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.limpiar_sesion_unica()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cerrar_otras_sesiones() TO authenticated;
GRANT EXECUTE ON FUNCTION public.limpiar_sesion_unica()  TO authenticated;

-- 5) Catálogo de auditoría: registra la acción 'cerrar_sesiones' (PBI-S6-E03).
--    Faltaba en audit_acciones, así que el FK audit_log.accion la rechazaba con
--    409 y el log del botón "Cerrar las demás" se perdía silenciosamente.
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle)
VALUES ('cerrar_sesiones', 'Cierre de las demás sesiones activas del usuario', false)
ON CONFLICT (codigo) DO NOTHING;
