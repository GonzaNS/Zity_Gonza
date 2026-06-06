// Sprint 11 · HU-TIENDA-03/07 — Tests unitarios de los helpers puros de src/lib/pedidos.ts.
//
// Cubre la lógica de presentación del carrito y el historial de pedidos:
//   • subtotal por ítem, total y unidades del carrito (display / preview)
//   • tope de cantidad = stock (control +/- del carrito)
//   • labels y badges del estado del pedido (borrador → confirmado → facturado)
//
// Nota: el total AUTORITATIVO del pedido lo calcula el servidor (RPC). Estos
// helpers son para presentación de datos ya persistidos y preview optimista.

import { describe, it, expect } from 'vitest'
import {
  subtotalItem,
  totalItems,
  unidadesItems,
  clampCantidad,
  labelEstadoPedido,
  LABEL_PEDIDO_ESTADO,
  BADGE_PEDIDO_ESTADO,
  ESTADOS_PEDIDO_FILTRO,
  type CarritoItem,
} from '../../lib/pedidos'
import type { PedidoEstado } from '../../lib/tienda'

const item = (cantidad: number, precio_unitario: number): Pick<CarritoItem, 'cantidad' | 'precio_unitario'> =>
  ({ cantidad, precio_unitario })

describe('subtotalItem', () => {
  it('multiplica cantidad por precio_unitario', () => {
    expect(subtotalItem(item(2, 5))).toBe(10)
    expect(subtotalItem(item(3, 9.99))).toBeCloseTo(29.97, 2)
  })
  it('es 0 si la cantidad es 0', () => {
    expect(subtotalItem(item(0, 12.5))).toBe(0)
  })
})

describe('totalItems', () => {
  it('suma los subtotales de todos los ítems', () => {
    expect(totalItems([item(2, 5), item(1, 3.5)])).toBeCloseTo(13.5, 2)
  })
  it('es 0 con el carrito vacío', () => {
    expect(totalItems([])).toBe(0)
  })
})

describe('unidadesItems', () => {
  it('suma las cantidades de todos los ítems', () => {
    expect(unidadesItems([item(2, 5), item(1, 3.5), item(3, 1)])).toBe(6)
  })
  it('es 0 con el carrito vacío', () => {
    expect(unidadesItems([])).toBe(0)
  })
})

describe('clampCantidad (tope = stock, mínimo 1)', () => {
  it('deja pasar una cantidad válida dentro del stock', () => {
    expect(clampCantidad(3, 10)).toBe(3)
  })
  it('limita al stock disponible', () => {
    expect(clampCantidad(15, 10)).toBe(10)
  })
  it('nunca baja de 1 si hay stock', () => {
    expect(clampCantidad(0, 10)).toBe(1)
    expect(clampCantidad(-5, 10)).toBe(1)
  })
  it('devuelve 0 si no hay stock', () => {
    expect(clampCantidad(5, 0)).toBe(0)
  })
})

describe('labels y badges del estado del pedido', () => {
  it('traduce cada estado a su etiqueta legible', () => {
    expect(labelEstadoPedido('borrador')).toBe('Borrador')
    expect(labelEstadoPedido('confirmado')).toBe('Confirmado')
    expect(labelEstadoPedido('facturado')).toBe('Facturado')
  })
  it('devuelve el valor crudo si el estado no está mapeado (defensivo)', () => {
    expect(labelEstadoPedido('desconocido' as PedidoEstado)).toBe('desconocido')
  })
  it('LABEL y BADGE cubren los tres estados', () => {
    const estados: PedidoEstado[] = ['borrador', 'confirmado', 'facturado']
    for (const e of estados) {
      expect(LABEL_PEDIDO_ESTADO[e]).toBeTruthy()
      expect(BADGE_PEDIDO_ESTADO[e].label).toBeTruthy()
      expect(BADGE_PEDIDO_ESTADO[e].clases).toContain('bg-')
    }
  })
  it('expone los filtros de estado para la vista admin (confirmado/facturado + todos)', () => {
    expect(ESTADOS_PEDIDO_FILTRO).toContain('confirmado')
    expect(ESTADOS_PEDIDO_FILTRO).toContain('facturado')
  })
})
