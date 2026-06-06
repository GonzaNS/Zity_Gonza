// Sprint 11 · HU-TIENDA-03 — Capa de datos del carrito (wrappers de RPC + carga).
//
// El carrito se persiste como un pedido 'borrador' en BD (uno por residente). Las
// mutaciones pasan por RPCs SECURITY DEFINER que fijan el precio en el servidor y
// recalculan el total en SQL (conventions.md §1). Este módulo solo hace I/O; los
// helpers puros (subtotales, labels, tope de stock) viven en lib/pedidos.ts.

import { supabase } from './supabase'
import { CARRITO_VACIO, type Carrito, type CarritoItem } from './pedidos'

/** Normaliza el jsonb que devuelven las RPCs del carrito a un Carrito tipado. */
function normalizarCarrito(data: unknown): Carrito {
  const d = (data ?? {}) as {
    pedido_id?: string | null
    total?: number | string
    unidades?: number | string
    items?: Array<Record<string, unknown>>
  }
  const items: CarritoItem[] = (d.items ?? []).map((it) => ({
    producto_id:     String(it.producto_id),
    nombre:          String(it.nombre ?? ''),
    cantidad:        Number(it.cantidad ?? 0),
    precio_unitario: Number(it.precio_unitario ?? 0),
    subtotal:        Number(it.subtotal ?? 0),
    stock:           Number(it.stock ?? 0),
    activo:          Boolean(it.activo ?? false),
    imagen_url:      (it.imagen_url as string | null) ?? null,
  }))
  return {
    pedido_id: (d.pedido_id as string | null) ?? null,
    total:     Number(d.total ?? 0),
    unidades:  Number(d.unidades ?? 0),
    items,
  }
}

/** Resultado de una mutación del carrito. */
export type ResultadoCarrito = { ok: true; carrito: Carrito } | { ok: false; error: string }

/**
 * Carga el carrito (pedido 'borrador') del residente con sus líneas. La RLS limita
 * el SELECT a los pedidos del propio residente. Devuelve CARRITO_VACIO si no hay.
 */
export async function obtenerCarrito(): Promise<Carrito> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, total, pedido_items(producto_id, cantidad, precio_unitario, productos(nombre, stock, activo, imagen_url))')
    .eq('estado', 'borrador')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return CARRITO_VACIO

  type Fila = {
    id: string
    total: number | string
    pedido_items: Array<{
      producto_id: string
      cantidad: number
      precio_unitario: number | string
      productos: { nombre: string; stock: number; activo: boolean; imagen_url: string | null } | null
    }>
  }
  const fila = data as unknown as Fila
  const items: CarritoItem[] = (fila.pedido_items ?? [])
    .map((pi) => ({
      producto_id:     pi.producto_id,
      nombre:          pi.productos?.nombre ?? '',
      cantidad:        Number(pi.cantidad),
      precio_unitario: Number(pi.precio_unitario),
      subtotal:        Number(pi.cantidad) * Number(pi.precio_unitario),
      stock:           pi.productos?.stock ?? 0,
      activo:          pi.productos?.activo ?? false,
      imagen_url:      pi.productos?.imagen_url ?? null,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  return {
    pedido_id: fila.id,
    total:     Number(fila.total),
    unidades:  items.reduce((acc, it) => acc + it.cantidad, 0),
    items,
  }
}

/**
 * Fija la cantidad de un producto en el carrito (0 = quitar). El servidor valida
 * stock y producto activo, fija el precio_unitario y recalcula el total.
 */
export async function guardarItemCarrito(productoId: string, cantidad: number): Promise<ResultadoCarrito> {
  const { data, error } = await supabase.rpc('actualizar_item_carrito', {
    p_producto_id: productoId,
    p_cantidad: cantidad,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, carrito: normalizarCarrito(data) }
}

/** Resultado de confirmar el pedido. */
export type ResultadoConfirmacion =
  | { ok: true; total: number; periodo: string | null; yaConfirmado: boolean }
  | { ok: false; error: string }

/**
 * Confirma el pedido 'borrador': descuento atómico de stock en el servidor. Si
 * algún producto no tiene stock, devuelve el error (nadie sobrevende).
 */
export async function confirmarPedido(pedidoId: string): Promise<ResultadoConfirmacion> {
  const { data, error } = await supabase.rpc('confirmar_pedido', { p_pedido_id: pedidoId })
  if (error) return { ok: false, error: error.message }
  const r = (data ?? {}) as { total?: number | string; periodo?: string | null; ya_confirmado?: boolean }
  return { ok: true, total: Number(r.total ?? 0), periodo: r.periodo ?? null, yaConfirmado: Boolean(r.ya_confirmado) }
}
