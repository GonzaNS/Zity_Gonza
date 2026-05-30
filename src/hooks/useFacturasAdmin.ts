// Sprint 9 · HU-FACT-04/06 + PBI-S8-E02 — Hook para el listado de facturas del admin.
//
// Carga TODAS las facturas (RLS admin) con el residente embebido, filtradas por
// estado, y los totales del periodo seleccionado (RPC totales_facturacion).
// Expone `recargar()` para refrescar tras registrar un pago (recálculo en vivo).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { obtenerTotalesPeriodo, type Factura, type TotalesPeriodo } from '../lib/facturas'
import type { FiltroFactura } from './useFacturasResidente'

/** Factura con los datos mínimos del residente embebidos (para la tabla admin). */
export type FacturaAdmin = Factura & {
  residente: {
    nombre: string
    apellido: string
    departamento: string
    piso: string
  } | null
}

/** Máximo de facturas que se listan (suficiente para el alcance del proyecto). */
export const ADMIN_FACTURAS_LIMIT = 200

export type UseFacturasAdminResult = {
  facturas: FacturaAdmin[]
  totales: TotalesPeriodo | null
  loading: boolean
  error: string | null
  recargar: () => void
}

export function useFacturasAdmin(filtro: FiltroFactura, periodo: string): UseFacturasAdminResult {
  const [facturas, setFacturas] = useState<FacturaAdmin[]>([])
  const [totales, setTotales] = useState<TotalesPeriodo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Dos FKs facturas→usuarios (residente_id y registrado_por): se desambigua
    // el embed por la COLUMNA (residente_id) — más robusto que el nombre del
    // constraint (que difiere entre la migración y la BD real).
    let query = supabase
      .from('facturas')
      .select(
        '*, residente:usuarios!residente_id(nombre, apellido, departamento, piso)',
      )
      .order('vencimiento', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(ADMIN_FACTURAS_LIMIT)

    if (filtro !== 'todas') {
      query = query.eq('estado', filtro)
    }

    const [{ data, error: fetchErr }, totalesPeriodo] = await Promise.all([
      query,
      obtenerTotalesPeriodo(periodo),
    ])

    // Los totales se calculan en servidor de forma independiente del listado:
    // se muestran aunque el listado falle.
    setTotales(totalesPeriodo)

    if (fetchErr) {
      setError(fetchErr.message)
      setLoading(false)
      return
    }

    setFacturas((data ?? []) as unknown as FacturaAdmin[])
    setLoading(false)
  }, [filtro, periodo])

  useEffect(() => {
    // cargar() hace setState síncrono de reset; es el patrón del proyecto
    // (ver useFacturasResidente). Falso positivo de set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  return { facturas, totales, loading, error, recargar: cargar }
}
