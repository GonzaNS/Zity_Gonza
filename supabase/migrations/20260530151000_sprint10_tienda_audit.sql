-- ============================================================
-- Sprint 10 · HU-TIENDA-02 · Auditoría del catálogo de productos
-- ============================================================
-- "Toda alta/edición/baja registra en audit_log."
--
-- Se registra vía trigger SECURITY DEFINER sobre `productos` (mismo patrón que
-- log_solicitud_creada del S3 y registrar_pago_factura del S9), NO desde el
-- frontend: la policy `audit_insert_authenticated` solo admite las entidades de
-- mantenimiento/usuarios, y un trigger SECURITY DEFINER (owner) puede registrar
-- entidad='productos' sin ampliar esa superficie.
--
-- El catálogo `audit_acciones` (FK de audit_log.accion) recibe las 4 acciones.
-- ============================================================

-- ── Catálogo de acciones (FK audit_log.accion → audit_acciones.codigo) ────────
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle) VALUES
  ('crear_producto',     'Alta de un producto en la tienda',          true),
  ('editar_producto',    'Edicion de un producto de la tienda',       true),
  ('baja_producto',      'Baja logica de un producto (activo=false)', true),
  ('reactivar_producto', 'Reactivacion de un producto (activo=true)', true)
ON CONFLICT (codigo) DO NOTHING;

-- ── Trigger de auditoría ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_producto_cambio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_accion   text;
  v_detalles jsonb;
BEGIN
  -- Cambios sin sesión (seed con service_role) no se auditan.
  IF v_actor IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_accion   := 'crear_producto';
    v_detalles := jsonb_build_object(
      'categoria', NEW.categoria, 'precio', NEW.precio, 'stock', NEW.stock);
  ELSE  -- UPDATE: distingue baja / reactivación / edición por el flag activo
    IF OLD.activo = true AND NEW.activo = false THEN
      v_accion := 'baja_producto';
    ELSIF OLD.activo = false AND NEW.activo = true THEN
      v_accion := 'reactivar_producto';
    ELSE
      v_accion := 'editar_producto';
    END IF;
    v_detalles := jsonb_build_object(
      'precio_anterior', OLD.precio, 'precio_nuevo', NEW.precio,
      'stock_anterior',  OLD.stock,  'stock_nuevo',  NEW.stock,
      'activo', NEW.activo);
  END IF;

  -- Best-effort: un fallo de auditoría nunca revierte el cambio del catálogo.
  BEGIN
    INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
    VALUES (v_actor, v_accion, 'productos', NEW.id, v_detalles, 'exitoso');
  EXCEPTION WHEN others THEN
    RAISE WARNING 'log_producto_cambio falló: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_producto_cambio ON public.productos;
CREATE TRIGGER after_producto_cambio
  AFTER INSERT OR UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.log_producto_cambio();

-- Seguridad: función de trigger — no exponer como RPC invocable.
REVOKE ALL ON FUNCTION public.log_producto_cambio() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.log_producto_cambio() IS
  'Sprint 10 · HU-TIENDA-02 — Audita alta/edición/baja/reactivación de productos '
  'en audit_log (entidad=productos). SECURITY DEFINER. No audita cambios del service_role.';
