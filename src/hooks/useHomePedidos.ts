// Sprint 13 · HU-HOME-04 — Hook para la tarjeta de pedidos del mes del home.
//
// Consulta vw_home_pedidos (security_invoker): devuelve hasta 3 pedidos
// del mes actual del residente (no-borrador), más los KPIs del mes como
// columnas de ventana (pedidos_mes, unidades_mes, total_mes).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PedidoEstado } from '../lib/tienda'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

/** Un pedido del mes devuelto por vw_home_pedidos. */
export type PedidoHome = {
  id: string
  estado: PedidoEstado
  total: number
  periodo: string | null
  factura_id: string | null
  created_at: string
  /** Suma de cantidades de todos los ítems del pedido. */
  unidades_pedido: number
}

/** KPIs del mes extraídos de las columnas de ventana (iguales en todas las filas). */
export type ResumenHomePedidos = {
  pedidos_mes: number
  unidades_mes: number
  total_mes: number
}

export type UseHomePedidosResult = {
  pedidos: PedidoHome[]
  resumen: ResumenHomePedidos
  loading: boolean
  error: string | null
  recargar: () => void
}

const RESUMEN_VACIO: ResumenHomePedidos = {
  pedidos_mes: 0,
  unidades_mes: 0,
  total_mes: 0,
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHomePedidos(): UseHomePedidosResult {
  const [pedidos, setPedidos] = useState<PedidoHome[]>([])
  const [resumen, setResumen] = useState<ResumenHomePedidos>(RESUMEN_VACIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('vw_home_pedidos')
      .select('id, estado, total, periodo, factura_id, created_at, unidades_pedido, pedidos_mes, unidades_mes, total_mes')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    type RawFila = PedidoHome & {
      pedidos_mes:  number | string
      unidades_mes: number | string
      total_mes:    number | string
    }

    const filas = (data ?? []) as unknown as RawFila[]

    // Resumen global desde la primera fila (columnas de ventana repetidas)
    const primera = filas[0]
    setResumen(
      primera
        ? {
            pedidos_mes:  Number(primera.pedidos_mes  ?? 0),
            unidades_mes: Number(primera.unidades_mes ?? 0),
            total_mes:    Number(primera.total_mes    ?? 0),
          }
        : RESUMEN_VACIO,
    )

    // Limpiar columnas de ventana de cada fila
    setPedidos(
      filas.map(({ pedidos_mes: _p, unidades_mes: _u, total_mes: _t, ...f }) => ({
        ...f,
        total:           Number(f.total),
        unidades_pedido: Number(f.unidades_pedido),
      })),
    )

    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { pedidos, resumen, loading, error, recargar: cargar }
}
