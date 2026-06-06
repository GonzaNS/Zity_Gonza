// Sprint 11 · HU-TIENDA-03/04/07/08 — Tipos y utilidades del carrito y los pedidos.
//
// Refleja el DDL de pedidos / pedido_items (migración 20260530150000_sprint10_tienda)
// y la columna pedidos.factura_id (migración sprint11_carrito_esquema). El módulo es
// puro: las mutaciones del carrito viven en las RPCs (actualizar_item_carrito /
// confirmar_pedido) y los hooks; aquí van tipos, labels, badges y helpers de display.
//
// IMPORTANTE (conventions.md §1): el total AUTORITATIVO del pedido lo calcula el
// servidor (la RPC devuelve `total`). Los helpers de abajo son para presentación de
// datos ya persistidos (historial) y preview optimista del carrito, no la fuente de
// verdad del cobro.

import { formatearMonto } from './facturas'
import type { PedidoEstado } from './tienda'

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Ítem del carrito tal como lo devuelve la RPC actualizar_item_carrito. */
export type CarritoItem = {
  producto_id:     string
  nombre:          string
  cantidad:        number
  /** Snapshot del precio al momento de agregar (lo fija el servidor). */
  precio_unitario: number
  subtotal:        number
  stock:           number
  activo:          boolean
  imagen_url:      string | null
}

/** Estado del carrito (resultado de las RPCs del carrito). pedido_id NULL = vacío. */
export type Carrito = {
  pedido_id: string | null
  total:     number
  unidades:  number
  items:     CarritoItem[]
}

/** Carrito vacío (estado inicial del contexto). */
export const CARRITO_VACIO: Carrito = { pedido_id: null, total: 0, unidades: 0, items: [] }

/** Línea de un pedido del historial, con datos del producto para mostrar. */
export type PedidoItemDetalle = {
  producto_id:     string
  nombre:          string
  cantidad:        number
  precio_unitario: number
  imagen_url:      string | null
}

/** Pedido con sus líneas, para el historial del residente y la vista admin. */
export type PedidoConItems = {
  id:           string
  residente_id: string
  estado:       PedidoEstado
  total:        number
  periodo:      string | null
  factura_id:   string | null
  created_at:   string
  items:        PedidoItemDetalle[]
  /** Nombre del residente (solo en la vista admin; el residente ve los suyos). */
  residente_nombre?: string
}

// ─── Labels y badges del estado del pedido ──────────────────────────────────────

export const LABEL_PEDIDO_ESTADO: Record<PedidoEstado, string> = {
  borrador:   'Borrador',
  confirmado: 'Confirmado',
  facturado:  'Facturado',
}

/** Clases del badge de estado del pedido (consistentes con BADGE_FACTURA_ESTADO). */
export const BADGE_PEDIDO_ESTADO: Record<PedidoEstado, { label: string; clases: string }> = {
  borrador:   { label: 'Borrador',   clases: 'bg-warm-100 text-warm-500 border-warm-200' },
  confirmado: { label: 'Confirmado', clases: 'bg-accent-50 text-accent-700 border-accent-200' },
  facturado:  { label: 'Facturado',  clases: 'bg-success/10 text-success border-success/30' },
}

export function labelEstadoPedido(estado: PedidoEstado): string {
  return LABEL_PEDIDO_ESTADO[estado] ?? estado
}

/** Estados para los filtros de la vista admin de pedidos (HU-TIENDA-08). */
export const ESTADOS_PEDIDO_FILTRO: PedidoEstado[] = ['borrador', 'confirmado', 'facturado']

// ─── Helpers de cálculo (presentación / preview) ────────────────────────────────

type ItemCobrable = { cantidad: number; precio_unitario: number }

/** Subtotal de una línea: cantidad × precio_unitario. */
export function subtotalItem(item: ItemCobrable): number {
  return item.cantidad * item.precio_unitario
}

/** Total del carrito/pedido a partir de sus líneas (display/preview). */
export function totalItems(items: ItemCobrable[]): number {
  return items.reduce((acc, it) => acc + subtotalItem(it), 0)
}

/** Unidades totales (suma de cantidades) — usado por el badge del mini-carrito. */
export function unidadesItems(items: Array<{ cantidad: number }>): number {
  return items.reduce((acc, it) => acc + it.cantidad, 0)
}

/**
 * Acota una cantidad deseada al rango válido [1, stock]. Devuelve 0 si no hay stock.
 * Usado por el control +/- del carrito (el tope es el stock disponible).
 */
export function clampCantidad(deseada: number, stock: number): number {
  if (stock <= 0) return 0
  return Math.min(Math.max(Math.trunc(deseada), 1), stock)
}

// ─── Formato ────────────────────────────────────────────────────────────────────

/** Reusa el formateador canónico de moneda (soles PEN). */
export const formatearPrecio = formatearMonto
