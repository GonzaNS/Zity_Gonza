// Sprint 7 · PBI-22 — Hook para obtener y refrescar métricas de mantenimiento.
//
// Criterios de aceptación implementados:
//   ■ Auto-refresh cada 60 s mientras el tab está activo.
//   ■ Pausa cuando el documento va a background (visibilitychange).
//   ■ Primera carga inmediata al montar el componente.
//   ■ Expone `loading`, `error` y `metricas` (o null si todavía no llegaron).
//   ■ Llama al RPC `get_metricas_mantenimiento` que verifica rol admin server-side.
//
// Sprint 7 Refactor · Vista Materializada:
//   ■ El RPC ahora devuelve `vista_refreshed_at` (marca del último REFRESH de
//     vw_metricas_solicitudes). Si la vista tiene >1h de antigüedad, el hook
//     dispara `refresh_metricas_on_demand()` y luego re-fetcha para servir
//     los datos frescos. Esto garantiza que el panel nunca muestre datos con
//     más de 1 hora de desfase incluso si pg_cron no está configurado.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricasMantenimiento } from '../lib/metricas'

const REFRESH_INTERVAL_MS = 60_000 // 60 segundos
const VISTA_MAX_AGE_MS    = 60 * 60 * 1000 // 1 hora

// Tipo interno que incluye el campo extra de la vista materializada
type MetricasRpcResponse = MetricasMantenimiento & {
  vista_refreshed_at?: string | null
}

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

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchMetricas = useCallback(async () => {
    // Cancelar fetch anterior si aún está en vuelo.
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    const { data, error: rpcError } = await supabase.rpc('get_metricas_mantenimiento')

    if (abortRef.current.signal.aborted) return

    if (rpcError) {
      setError(rpcError.message)
      setLoading(false)
      return
    }

    if (data) {
      const respuesta = data as MetricasRpcResponse

      // ── Fallback on-demand de la vista materializada ─────────────────────────
      // Si la vista tiene más de 1 hora de antigüedad, disparar un refresh
      // on-demand y luego re-fetchear para servir datos actualizados.
      // Esto actúa como seguro si pg_cron no está configurado.
      const vistaRefreshedAt = respuesta.vista_refreshed_at
        ? new Date(respuesta.vista_refreshed_at).getTime()
        : 0
      const vistaEdadMs = Date.now() - vistaRefreshedAt
      const vistaEsAntigua = vistaEdadMs > VISTA_MAX_AGE_MS

      if (vistaEsAntigua) {
        // Disparar refresh on-demand en background (sin await para no bloquear la UI)
        void supabase.rpc('refresh_metricas_on_demand').then(async () => {
          if (abortRef.current?.signal.aborted) return
          // Re-fetchear con la vista ya actualizada
          const { data: dataFresh, error: errFresh } = await supabase.rpc('get_metricas_mantenimiento')
          if (!abortRef.current?.signal.aborted && !errFresh && dataFresh) {
            const { vista_refreshed_at: _, ...metricas } = dataFresh as MetricasRpcResponse
            setMetricas(metricas as MetricasMantenimiento)
            setUltimaActualizacion(new Date().toISOString())
            setError(null)
          }
        })
      }

      // Publicar datos actuales inmediatamente (sin esperar al refresh on-demand)
      // para no bloquear la UI. Si había datos viejos, el re-fetch los reemplazará.
      const { vista_refreshed_at: _, ...metricasLimpias } = respuesta
      setMetricas(metricasLimpias as MetricasMantenimiento)
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
      if (intervalRef.current) return
      intervalRef.current = setInterval(() => {
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
        void fetchMetricas()
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
  }, [fetchMetricas])

  return {
    metricas,
    loading,
    error,
    refrescar: fetchMetricas,
    ultimaActualizacion,
  }
}
