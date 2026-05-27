// Sprint 7 · HU-KPI-01 — Hook para obtener los datos de las gráficas Recharts.
//
// Llama al RPC get_graficas_mantenimiento() que devuelve en una sola
// petición los tres datasets:
//   - por_tipo:         conteo por tipo de solicitud (BarChart)
//   - tendencia_mensual: AVG + mediana por mes, últimos 6 meses (LineChart)
//   - top_categorias:   top 5 categorías con porcentajes (barras de proporción)
//
// Comparte el mismo intervalo de refresh (60 s) y pausa visibilitychange
// que useMetricasMantenimiento, siguiendo el mismo patrón del PBI-22.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { GraficasMantenimiento } from '../lib/metricas'

const REFRESH_INTERVAL_MS = 60_000

export type UseGraficasMantenimientoResult = {
  graficas: GraficasMantenimiento | null
  loading: boolean
  error: string | null
  /** Refresca manualmente los datos de las gráficas. */
  refrescar: () => void
}

export function useGraficasMantenimiento(): UseGraficasMantenimientoResult {
  const [graficas, setGraficas] = useState<GraficasMantenimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchGraficas = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const { data, error: rpcError } = await supabase.rpc('get_graficas_mantenimiento')

    if (abortRef.current.signal.aborted) return

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    if (data) {
      setGraficas(data as GraficasMantenimiento)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    void fetchGraficas()
  }, [fetchGraficas])

  useEffect(() => {
    function iniciarIntervalo() {
      if (intervalRef.current) return
      intervalRef.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          void fetchGraficas()
        }
      }, REFRESH_INTERVAL_MS)
    }

    function detenerIntervalo() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void fetchGraficas()
        iniciarIntervalo()
      } else {
        detenerIntervalo()
      }
    }

    iniciarIntervalo()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      detenerIntervalo()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      abortRef.current?.abort()
    }
  }, [fetchGraficas])

  return { graficas, loading, error, refrescar: fetchGraficas }
}
