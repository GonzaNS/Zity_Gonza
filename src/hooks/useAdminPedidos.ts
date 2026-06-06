// Sprint 11 · HU-TIENDA-08 — Datos de la vista admin de pedidos.
//
// Carga todas las órdenes (todos los residentes) con el nombre del residente y sus
// líneas; la RLS de pedidos permite al admin ver todo (el técnico no tiene acceso).
// Expone también el cierre de periodo (facturar_pedidos_periodo) para el admin.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PedidoConItems, PedidoItemDetalle } from '../lib/pedidos'
import type { PedidoEstado } from '../lib/tienda'

type FilaAdminPedido = {
  id: string
  residente_id: string
  estado: PedidoEstado
  total: number | string
  periodo: string | null
  factura_id: string | null
  created_at: string
  usuarios: { nombre: string; apellido: string } | null
  pedido_items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario: number | string
    productos: { nombre: string } | null
  }>
}

export type ResultadoCierre =
  | { ok: true; facturasCreadas: number; pedidosFacturados: number }
  | { ok: false; error: string }

export function useAdminPedidos() {
  const [pedidos, setPedidos] = useState<PedidoConItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pedidos')
      .select('id, residente_id, estado, total, periodo, factura_id, created_at, ' +
        'usuarios(nombre, apellido), pedido_items(producto_id, cantidad, precio_unitario, productos(nombre))')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const filas = (data ?? []) as unknown as FilaAdminPedido[]
    setPedidos(filas.map((p) => ({
      id:           p.id,
      residente_id: p.residente_id,
      estado:       p.estado,
      total:        Number(p.total),
      periodo:      p.periodo,
      factura_id:   p.factura_id,
      created_at:   p.created_at,
      residente_nombre: p.usuarios ? `${p.usuarios.nombre} ${p.usuarios.apellido}` : '—',
      items: (p.pedido_items ?? []).map((pi): PedidoItemDetalle => ({
        producto_id:     pi.producto_id,
        nombre:          pi.productos?.nombre ?? '',
        cantidad:        pi.cantidad,
        precio_unitario: Number(pi.precio_unitario),
        imagen_url:      null,
      })),
    })))
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => cargar())
  }, [cargar])

  /** Cierre de mes: consolida los pedidos 'confirmado' del periodo en facturas de tienda. */
  const cerrarPeriodo = useCallback(async (periodo: string): Promise<ResultadoCierre> => {
    const { data, error: err } = await supabase.rpc('facturar_pedidos_periodo', { p_periodo: periodo })
    if (err) return { ok: false, error: err.message }
    const r = (data ?? {}) as { facturas_creadas?: number; pedidos_facturados?: number }
    return {
      ok: true,
      facturasCreadas: Number(r.facturas_creadas ?? 0),
      pedidosFacturados: Number(r.pedidos_facturados ?? 0),
    }
  }, [])

  return { pedidos, loading, error, recargar: cargar, cerrarPeriodo }
}
