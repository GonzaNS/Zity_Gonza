-- ============================================================
-- Sprint 11 · HU-TIENDA-03 · Migración 012 (nominal) — parte 3/4
-- RPCs del carrito: armar el carrito (borrador) y confirmar el pedido con
-- descuento ATÓMICO de stock (sin sobreventa).  ADR-014.
-- ============================================================
-- Convenciones (docs/conventions.md):
--   • SECURITY DEFINER + SET search_path; validan identidad/rol al inicio.
--   • Aritmética de montos 100% en SQL (numeric(10,2)); el front solo formatea.
--   • precio_unitario es un snapshot tomado del servidor (no del cliente).
-- ============================================================

-- ── actualizar_item_carrito(producto, cantidad) ──────────────────────────────
-- Obtiene o crea el pedido 'borrador' del residente (uno activo) y fija la
-- cantidad de un producto:
--   cantidad > 0  → upsert con precio del servidor; valida activo y stock.
--   cantidad = 0  → quita el ítem (y borra el borrador si queda vacío).
-- Recalcula pedidos.total en SQL y devuelve el carrito completo (jsonb).
CREATE OR REPLACE FUNCTION public.actualizar_item_carrito(
  p_producto_id uuid,
  p_cantidad    integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor     uuid := auth.uid();
  v_pedido_id uuid;
  v_producto  public.productos;
  v_total     numeric(10,2);
  v_unidades  integer;
BEGIN
  IF v_actor IS NULL OR public.get_user_rol() IS DISTINCT FROM 'residente' THEN
    RAISE EXCEPTION 'Acceso denegado: solo un residente arma su carrito' USING ERRCODE = '42501';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad < 0 THEN
    RAISE EXCEPTION 'La cantidad no puede ser negativa';
  END IF;

  -- Pedido 'borrador' activo del residente (uno solo).
  SELECT id INTO v_pedido_id
  FROM public.pedidos
  WHERE residente_id = v_actor AND estado = 'borrador'
  ORDER BY created_at
  LIMIT 1;

  IF p_cantidad = 0 THEN
    IF v_pedido_id IS NOT NULL THEN
      DELETE FROM public.pedido_items
      WHERE pedido_id = v_pedido_id AND producto_id = p_producto_id;
    END IF;
  ELSE
    SELECT * INTO v_producto FROM public.productos WHERE id = p_producto_id;
    IF NOT FOUND OR v_producto.activo = false THEN
      RAISE EXCEPTION 'Producto no disponible';
    END IF;
    IF p_cantidad > v_producto.stock THEN
      RAISE EXCEPTION 'Solo hay % unidad(es) de %', v_producto.stock, v_producto.nombre
        USING ERRCODE = 'P0001';
    END IF;

    IF v_pedido_id IS NULL THEN
      INSERT INTO public.pedidos (residente_id, estado, total)
      VALUES (v_actor, 'borrador', 0)
      RETURNING id INTO v_pedido_id;
    END IF;

    INSERT INTO public.pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
    VALUES (v_pedido_id, p_producto_id, p_cantidad, v_producto.precio)
    ON CONFLICT (pedido_id, producto_id) DO UPDATE
      SET cantidad        = EXCLUDED.cantidad,
          precio_unitario = EXCLUDED.precio_unitario;
  END IF;

  -- Sin pedido (nada que quitar) → carrito vacío.
  IF v_pedido_id IS NULL THEN
    RETURN jsonb_build_object('pedido_id', NULL, 'total', 0, 'unidades', 0, 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(SUM(cantidad * precio_unitario), 0)::numeric(10,2),
         COALESCE(SUM(cantidad), 0)
    INTO v_total, v_unidades
    FROM public.pedido_items WHERE pedido_id = v_pedido_id;

  -- Carrito vacío → se elimina el borrador para no dejar pedidos huérfanos.
  IF v_unidades = 0 THEN
    DELETE FROM public.pedidos WHERE id = v_pedido_id;
    RETURN jsonb_build_object('pedido_id', NULL, 'total', 0, 'unidades', 0, 'items', '[]'::jsonb);
  END IF;

  UPDATE public.pedidos SET total = v_total WHERE id = v_pedido_id;

  RETURN jsonb_build_object(
    'pedido_id', v_pedido_id,
    'total',     v_total,
    'unidades',  v_unidades,
    'items', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'producto_id',     pi.producto_id,
        'nombre',          pr.nombre,
        'cantidad',        pi.cantidad,
        'precio_unitario', pi.precio_unitario,
        'subtotal',        (pi.cantidad * pi.precio_unitario)::numeric(10,2),
        'stock',           pr.stock,
        'activo',          pr.activo,
        'imagen_url',      pr.imagen_url
      ) ORDER BY pr.nombre), '[]'::jsonb)
      FROM public.pedido_items pi
      JOIN public.productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = v_pedido_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.actualizar_item_carrito(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.actualizar_item_carrito(uuid, integer) TO authenticated;

COMMENT ON FUNCTION public.actualizar_item_carrito(uuid, integer) IS
  'Sprint 11 · HU-TIENDA-03 — Arma el carrito (pedido borrador) del residente. '
  'precio_unitario tomado del servidor; total recalculado en SQL. cantidad=0 quita el ítem.';

-- ── confirmar_pedido(pedido) — DESCUENTO ATÓMICO DE STOCK ─────────────────────
-- Núcleo de la HU-03. Bloquea los productos del carrito (SELECT ... FOR UPDATE,
-- en orden por producto_id para evitar deadlocks) y descuenta el stock con un
-- UPDATE condicional (stock >= cantidad). Si algún ítem no alcanza, RAISE y toda
-- la operación se revierte: nadie sobrevende. Idempotente: un pedido ya
-- confirmado/facturado no se reprocesa.
CREATE OR REPLACE FUNCTION public.confirmar_pedido(p_pedido_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor   uuid := auth.uid();
  v_pedido  public.pedidos;
  v_item    record;
  v_total   numeric(10,2);
  v_periodo text := to_char((now() AT TIME ZONE 'America/Lima'), 'YYYY-MM');
  v_n       integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere sesión' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_pedido FROM public.pedidos WHERE id = p_pedido_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF v_pedido.residente_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Acceso denegado: el pedido no es tuyo' USING ERRCODE = '42501';
  END IF;

  -- Idempotencia: ya confirmado o facturado → no reprocesar (evita doble descuento).
  IF v_pedido.estado <> 'borrador' THEN
    RETURN jsonb_build_object('ok', true, 'ya_confirmado', true,
                              'pedido_id', v_pedido.id, 'estado', v_pedido.estado);
  END IF;

  SELECT count(*) INTO v_n FROM public.pedido_items WHERE pedido_id = p_pedido_id;
  IF v_n = 0 THEN
    RAISE EXCEPTION 'El carrito está vacío';
  END IF;

  -- Marca el contexto de venta para que log_producto_cambio no lo audite como
  -- edición del catálogo (es local a esta transacción).
  PERFORM set_config('zity.venta_en_curso', '1', true);

  -- Bloqueo ordenado de los productos del carrito + descuento atómico.
  FOR v_item IN
    SELECT pi.producto_id, pi.cantidad, pr.nombre
    FROM public.pedido_items pi
    JOIN public.productos pr ON pr.id = pi.producto_id
    WHERE pi.pedido_id = p_pedido_id
    ORDER BY pi.producto_id
    FOR UPDATE OF pr
  LOOP
    UPDATE public.productos
      SET stock = stock - v_item.cantidad
      WHERE id = v_item.producto_id
        AND activo = true
        AND stock >= v_item.cantidad;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sin stock suficiente de %', v_item.nombre USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(cantidad * precio_unitario), 0)::numeric(10,2) INTO v_total
    FROM public.pedido_items WHERE pedido_id = p_pedido_id;

  UPDATE public.pedidos
    SET estado = 'confirmado', total = v_total, periodo = v_periodo
    WHERE id = p_pedido_id;

  -- Auditoría (solo IDs/importes — sin PII, criterio DoD v3).
  INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
  VALUES (v_actor, 'confirmar_pedido', 'pedidos', p_pedido_id,
          jsonb_build_object('total', v_total, 'periodo', v_periodo, 'items', v_n), 'exitoso');

  RETURN jsonb_build_object('ok', true, 'ya_confirmado', false,
                            'pedido_id', p_pedido_id, 'total', v_total, 'periodo', v_periodo);
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_pedido(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido(uuid) TO authenticated;

COMMENT ON FUNCTION public.confirmar_pedido(uuid) IS
  'Sprint 11 · HU-TIENDA-03 — Confirma el pedido borrador del residente con descuento '
  'atómico de stock (SELECT ... FOR UPDATE). Idempotente. Sin sobreventa. ADR-014.';
