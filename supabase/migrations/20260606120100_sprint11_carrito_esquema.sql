-- ============================================================
-- Sprint 11 · Migración 012 (nominal) — parte 2/4 · Esquema del carrito
-- ============================================================
-- Cambios de esquema y triggers que habilitan el carrito v2 y la integración
-- pedido -> factura, SIN tocar la lógica de negocio existente:
--   • pedidos.factura_id  → enlaza la factura de tienda con sus pedidos (HU-04/07).
--   • UNIQUE(pedido_id, producto_id) en pedido_items → una línea por producto,
--     habilita el upsert atómico del carrito (actualizar_item_carrito).
--   • Catálogo audit_acciones += confirmar_pedido / facturar_pedidos (FK de audit_log).
--   • after_factura_inserted / after_factura_paid → el CASE de tipo ahora rotula
--     'tienda' como 'Tienda' (reusa la notificación de factura del S8/S9).
--   • log_producto_cambio → respeta el flag de sesión zity.venta_en_curso para NO
--     auditar el descuento de stock por venta como 'editar_producto' del residente
--     (esa trazabilidad la lleva el evento 'confirmar_pedido'). El CRUD del admin
--     se sigue auditando igual.
-- ============================================================

-- ── PARTE A: pedidos.factura_id ───────────────────────────────────────────────
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS factura_id uuid
    REFERENCES public.facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedidos_factura_idx ON public.pedidos (factura_id);

COMMENT ON COLUMN public.pedidos.factura_id IS
  'Sprint 11 · HU-TIENDA-04 — Factura de tipo tienda que consolidó este pedido al '
  'cierre de mes. NULL mientras el pedido no esté facturado. ON DELETE SET NULL.';

-- ── PARTE B: una línea por producto en el carrito ─────────────────────────────
-- pedido_items estaba vacío (0 pedidos), así que el UNIQUE no rompe datos.
ALTER TABLE public.pedido_items
  ADD CONSTRAINT pedido_items_pedido_producto_key UNIQUE (pedido_id, producto_id);

-- ── PARTE C: catálogo de acciones de auditoría (FK audit_log.accion) ──────────
INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle) VALUES
  ('confirmar_pedido',  'Residente confirma un pedido (descuento atomico de stock)', true),
  ('facturar_pedidos',  'Cierre de mes: pedidos de tienda consolidados en factura',  true)
ON CONFLICT (codigo) DO NOTHING;

-- ── PARTE D: notificación de factura — rotular 'tienda' ───────────────────────
-- Reemplaza el cuerpo (CREATE OR REPLACE) añadiendo WHEN 'tienda' al CASE; el
-- resto es idéntico a la versión vigente del S9 (moneda en soles + email f&f).
CREATE OR REPLACE FUNCTION public.after_factura_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tipo_label text;
  v_titulo     text;
  v_mensaje    text;
BEGIN
  BEGIN
    v_tipo_label := CASE NEW.tipo
      WHEN 'luz'      THEN 'Electricidad'
      WHEN 'agua'     THEN 'Agua'
      WHEN 'pension'  THEN 'Pensión'
      WHEN 'multa'    THEN 'Multa'
      WHEN 'tienda'   THEN 'Tienda'
      ELSE NEW.tipo::text
    END;
    v_titulo  := 'Nueva factura: ' || v_tipo_label;
    v_mensaje := 'Factura nueva: ' || v_tipo_label
              || ' — S/ ' || to_char(NEW.monto, 'FM999,999,990.00')
              || ', vence ' || to_char(NEW.vencimiento, 'DD/MM');

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (NEW.residente_id, NULL, 'factura_nueva', v_titulo, v_mensaje, false,
       jsonb_build_object('factura_id', NEW.id));

    BEGIN
      PERFORM net.http_post(
        url     := current_setting('app.supabase_url', true) || '/functions/v1/notificar-factura-nueva',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body    := jsonb_build_object(
          'factura_id',   NEW.id,
          'residente_id', NEW.residente_id,
          'tipo',         NEW.tipo,
          'monto',        NEW.monto,
          'periodo',      NEW.periodo,
          'vencimiento',  to_char(NEW.vencimiento, 'YYYY-MM-DD')
        )
      );
    EXCEPTION WHEN others THEN
      RAISE WARNING 'after_factura_inserted: email fire-and-forget falló: %', SQLERRM;
    END;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_factura_inserted falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.after_factura_inserted() FROM anon, authenticated, public;

-- ── PARTE E: notificación de pago — rotular 'tienda' ──────────────────────────
CREATE OR REPLACE FUNCTION public.after_factura_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_tipo_label text;
BEGIN
  BEGIN
    v_tipo_label := CASE NEW.tipo
      WHEN 'luz'     THEN 'Electricidad'
      WHEN 'agua'    THEN 'Agua'
      WHEN 'pension' THEN 'Pensión'
      WHEN 'multa'   THEN 'Multa'
      WHEN 'tienda'  THEN 'Tienda'
      ELSE NEW.tipo::text
    END;

    INSERT INTO public.notificaciones
      (usuario_id, solicitud_id, tipo, titulo, mensaje, leida, metadata)
    VALUES
      (NEW.residente_id, NULL, 'factura_pagada',
       'Pago registrado: ' || v_tipo_label,
       'Tu factura de ' || v_tipo_label || ' (S/ ' || to_char(NEW.monto, 'FM999,999,990.00')
         || ') fue registrada como pagada.',
       false, jsonb_build_object('factura_id', NEW.id));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'after_factura_paid falló: %', SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.after_factura_paid() FROM anon, authenticated, public;

-- ── PARTE F: auditoría de productos — no registrar el descuento por venta ─────
-- Igual que el S10 pero salta cuando confirmar_pedido marca zity.venta_en_curso:
-- el movimiento de stock por una venta se audita como 'confirmar_pedido', no como
-- 'editar_producto' (que es el CRUD del admin).
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

  -- Descuento de stock por una venta (confirmar_pedido) → no es edición del catálogo.
  IF current_setting('zity.venta_en_curso', true) = '1' THEN
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

  BEGIN
    INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
    VALUES (v_actor, v_accion, 'productos', NEW.id, v_detalles, 'exitoso');
  EXCEPTION WHEN others THEN
    RAISE WARNING 'log_producto_cambio falló: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_producto_cambio() FROM anon, authenticated, public;

COMMENT ON FUNCTION public.log_producto_cambio() IS
  'Sprint 10/11 · HU-TIENDA-02 — Audita alta/edición/baja/reactivación de productos. '
  'Salta el descuento de stock por venta (zity.venta_en_curso=1), auditado como confirmar_pedido.';
