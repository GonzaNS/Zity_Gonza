// Sprint 13 · HU-HOME-03 — Hook para la tarjeta de facturas pendientes del home.
//
// Consulta vw_home_facturas (security_invoker): devuelve hasta 4 facturas
// pendientes/vencidas del residente, ordenadas por vencimiento ASC (urgentes
// primero). Incluye totales globales en cada fila como columnas de ventana;
// el hook extrae el resumen de la primera fila.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { FacturaTipo, FacturaEstado } from '../lib/facturas'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

/** Una factura individual devuelta por vw_home_facturas. */
export type FacturaHome = {
  id: string
  tipo: FacturaTipo
  monto: number
  periodo: string       // 'YYYY-MM'
  vencimiento: string   // 'YYYY-MM-DD'
  estado: FacturaEstado
  numero: string | null
  descripcion: string | null
  created_at: string
  /** True si ya superó la fecha de vencimiento (calculado en Postgres/Lima TZ). */
  esta_vencida: boolean
}

/** Resumen extraído de las columnas de ventana (igual en todas las filas). */
export type ResumenHomeFacturas = {
  total_pendiente: number
  count_vencidas: number
  proxima_fecha: string | null  // 'YYYY-MM-DD'
}

export type UseHomeFacturasResult = {
  facturas: FacturaHome[]
  resumen: ResumenHomeFacturas
  loading: boolean
  error: string | null
  recargar: () => void
}

const RESUMEN_VACIO: ResumenHomeFacturas = {
  total_pendiente: 0,
  count_vencidas: 0,
  proxima_fecha: null,
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHomeFacturas(): UseHomeFacturasResult {
  const [facturas, setFacturas] = useState<FacturaHome[]>([])
  const [resumen, setResumen] = useState<ResumenHomeFacturas>(RESUMEN_VACIO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('vw_home_facturas')
      .select('id, tipo, monto, periodo, vencimiento, estado, numero, descripcion, created_at, esta_vencida, total_pendiente, count_vencidas, proxima_fecha')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    type RawFila = FacturaHome & {
      total_pendiente: number | string
      count_vencidas: number | string
      proxima_fecha: string | null
    }

    const filas = (data ?? []) as unknown as RawFila[]

    // Extraer el resumen de la primera fila (columnas de ventana repetidas)
    const primera = filas[0]
    setResumen(
      primera
        ? {
            total_pendiente: Number(primera.total_pendiente ?? 0),
            count_vencidas:  Number(primera.count_vencidas  ?? 0),
            proxima_fecha:   primera.proxima_fecha ?? null,
          }
        : RESUMEN_VACIO,
    )

    // Limpiar columnas de ventana de cada fila antes de exponer
    setFacturas(
      filas.map(({ total_pendiente: _t, count_vencidas: _c, proxima_fecha: _p, ...f }) => ({
        ...f,
        monto: Number(f.monto),
      })),
    )

    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { facturas, resumen, loading, error, recargar: cargar }
}
