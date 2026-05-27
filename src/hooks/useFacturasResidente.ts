// Sprint 8 · HU-FACT-03 — Hook para cargar las facturas del residente autenticado.
//
// Paginación lazy (scroll infinito): carga de PAGE_SIZE en PAGE_SIZE.
// La RLS de Supabase garantiza que solo se devuelvan facturas del usuario actual.
// Se ordena por vencimiento ASC (más urgentes primero) y luego por created_at DESC.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Factura, FacturaEstado } from '../lib/facturas'

export const PAGE_SIZE = 25

export type FiltroFactura = FacturaEstado | 'todas'

export type UseFacturasResidenteResult = {
  facturas: Factura[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  hayMas: boolean
  cargarMas: () => void
  totalPendiente: number | null
}

export function useFacturasResidente(filtro: FiltroFactura): UseFacturasResidenteResult {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [totalPendiente, setTotalPendiente] = useState<number | null>(null)
  const offsetRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // Reset y primera carga al cambiar el filtro
  const cargarPrimera = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    offsetRef.current = 0

    // Calcular total pendiente del período actual en paralelo con la primera página
    const periodoActual = new Date().toISOString().slice(0, 7)

    let query = supabase
      .from('facturas')
      .select('*')
      .order('vencimiento', { ascending: true })
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .abortSignal(controller.signal)

    if (filtro !== 'todas') {
      query = query.eq('estado', filtro)
    }

    const [{ data, error: fetchErr }, { data: totalesData }] = await Promise.all([
      query,
      supabase
        .from('facturas')
        .select('monto')
        .eq('estado', 'pendiente')
        .eq('periodo', periodoActual)
        .abortSignal(controller.signal),
    ])

    // Comparamos contra el `controller` capturado (no `abortRef.current`) porque
    // un cambio de filtro o un re-mount reasigna `abortRef.current`, lo cual
    // haría que el check del signal nuevo siempre devuelva `!aborted` y el
    // AbortError de la query previa se filtraría a `setError` (mostrando el
    // mensaje feo "AbortError: signal is aborted without reason" en la UI).
    if (controller.signal.aborted) return

    if (fetchErr) {
      // Filtrar AbortError defensivamente: si Supabase ya devolvió con un error
      // de cancelación pero el signal nuevo aún no se ha actualizado (race),
      // no lo mostramos al usuario — no es un error real, fue un cambio de filtro.
      const msg = fetchErr.message ?? ''
      const isAbort = fetchErr.name === 'AbortError' || /abort/i.test(msg)
      if (!isAbort) setError(msg)
      setLoading(false)
      return
    }

    const items = (data ?? []) as Factura[]
    setFacturas(items)
    setHayMas(items.length === PAGE_SIZE)
    offsetRef.current = items.length

    // Total pendiente del mes actual
    const total = (totalesData ?? []).reduce((sum, f) => sum + Number(f.monto), 0)
    setTotalPendiente(total)

    setLoading(false)
  }, [filtro])

  useEffect(() => {
    void cargarPrimera()
    return () => { abortRef.current?.abort() }
  }, [cargarPrimera])

  // Cargar siguiente página (scroll infinito)
  const cargarMas = useCallback(async () => {
    if (loadingMore || !hayMas) return

    setLoadingMore(true)
    const desde = offsetRef.current
    const hasta = desde + PAGE_SIZE - 1

    let query = supabase
      .from('facturas')
      .select('*')
      .order('vencimiento', { ascending: true })
      .order('created_at', { ascending: false })
      .range(desde, hasta)

    if (filtro !== 'todas') {
      query = query.eq('estado', filtro)
    }

    const { data, error: fetchErr } = await query

    if (fetchErr) {
      setError(fetchErr.message)
      setLoadingMore(false)
      return
    }

    const nuevas = (data ?? []) as Factura[]
    setFacturas(prev => [...prev, ...nuevas])
    setHayMas(nuevas.length === PAGE_SIZE)
    offsetRef.current += nuevas.length
    setLoadingMore(false)
  }, [filtro, loadingMore, hayMas])

  return { facturas, loading, loadingMore, error, hayMas, cargarMas, totalPendiente }
}
