// Sprint 11 · HU-TIENDA-07 — Historial de pedidos del residente.
//
// Carga los pedidos del residente que ya no son borrador (confirmado / facturado),
// con sus líneas y el nombre del producto, ordenados por fecha descendente. La RLS
// de pedidos / pedido_items limita el SELECT a los del propio residente.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PedidoConItems, PedidoItemDetalle } from '../lib/pedidos'
import type { PedidoEstado } from '../lib/tienda'

type FilaPedido = {
  id: string
  residente_id: string
  estado: PedidoEstado
  total: number | string
  periodo: string | null
  factura_id: string | null
  created_at: string
  pedido_items: Array<{
    producto_id: string
    cantidad: number
    precio_unitario: number | string
    productos: { nombre: string; imagen_url: string | null } | null
  }>
}

export function usePedidosResidente() {
  const [pedidos, setPedidos] = useState<PedidoConItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('pedidos')
      .select('id, residente_id, estado, total, periodo, factura_id, created_at, ' +
        'pedido_items(producto_id, cantidad, precio_unitario, productos(nombre, imagen_url))')
      .neq('estado', 'borrador')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const filas = (data ?? []) as unknown as FilaPedido[]
    const mapped: PedidoConItems[] = filas.map((p) => ({
      id:           p.id,
      residente_id: p.residente_id,
      estado:       p.estado,
      total:        Number(p.total),
      periodo:      p.periodo,
      factura_id:   p.factura_id,
      created_at:   p.created_at,
      items: (p.pedido_items ?? []).map((pi): PedidoItemDetalle => ({
        producto_id:     pi.producto_id,
        nombre:          pi.productos?.nombre ?? '',
        cantidad:        pi.cantidad,
        precio_unitario: Number(pi.precio_unitario),
        imagen_url:      pi.productos?.imagen_url ?? null,
      })),
    }))
    setPedidos(mapped)
    setLoading(false)
  }, [])

  useEffect(() => {
    void Promise.resolve().then(() => cargar())
  }, [cargar])

  return { pedidos, loading, error, recargar: cargar }
}
