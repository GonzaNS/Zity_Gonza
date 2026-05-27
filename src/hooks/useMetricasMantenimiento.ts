// Sprint 7 · PBI-22 — Hook para obtener y refrescar métricas de mantenimiento.
//
// Criterios de aceptación implementados:
//   ■ Auto-refresh cada 60 s mientras el tab está activo.
//   ■ Pausa cuando el documento va a background (visibilitychange).
//   ■ Primera carga inmediata al montar el componente.
//   ■ Expone `loading`, `error` y `metricas` (o null si todavía no llegaron).
//   ■ Llama al RPC `get_metricas_mantenimiento` que verifica rol admin server-side.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricasMantenimiento } from '../lib/metricas'

const REFRESH_INTERVAL_MS = 60_000 // 60 segundos

export type UseMetricasMantenimientoResult = {
  metricas: MetricasMantenimiento | null
  loading: boolean
  error: string | null
  /** Refresca manualmente las métricas. */
  refrescar: () => void
  /** Timestamp del último fetch exitoso (ISO string). */
  ultimaActualizacion: string | null
}

export function useMetricasMantenimiento(): UseMetricasMantenimientoResult {
  const [metricas, setMetricas] = useState<MetricasMantenimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)

  // Usamos ref para el intervalo y para evitar race conditions con fetch en vuelo.
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchMetricas = useCallback(async () => {
    // Cancelar fetch anterior si aún está en vuelo.
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // No setLoading(true) en refrescos automáticos — solo en la primera carga
    // para evitar el flash de spinner cada 60 s (UX más limpio).

    const { data, error: rpcError } = await supabase.rpc('get_metricas_mantenimiento')

    // Si fue abortado, ignorar respuesta.
    if (abortRef.current.signal.aborted) return

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    if (data) {
      setMetricas(data as MetricasMantenimiento)
      setUltimaActualizacion(new Date().toISOString())
      setError(null)
    }
    setLoading(false)
  }, [])

  // ─── Primera carga ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    void fetchMetricas()
  }, [fetchMetricas])

  // ─── Auto-refresh con pausa en background ─────────────────────────────────
  useEffect(() => {
    function iniciarIntervalo() {
      if (intervalRef.current) return // ya activo
      intervalRef.current = setInterval(() => {
        // Solo refrescar si el tab está visible.
        if (document.visibilityState === 'visible') {
          void fetchMetricas()
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
        // Tab volvió al frente: refrescar inmediatamente y reanudar intervalo.
        void fetchMetricas()
        iniciarIntervalo()
      } else {
        // Tab fue a background: pausar intervalo para no gastar quota.
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
  }, [fetchMetricas])

  return {
    metricas,
    loading,
    error,
    refrescar: fetchMetricas,
    ultimaActualizacion,
  }
}
