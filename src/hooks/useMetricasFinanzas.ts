import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricasFinanzas } from '../lib/metricasFinanzas'

export function useMetricasFinanzas(periodo?: string) {
  const [metricas, setMetricas] = useState<MetricasFinanzas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Si no se pasa periodo, la función RPC en BD usará el mes actual por defecto
      const { data, error: err } = await supabase.rpc('get_metricas_finanzas', {
        p_periodo: periodo || undefined
      })

      if (err) throw err

      if (data) {
        setMetricas(data as MetricasFinanzas)
        setUltimaActualizacion(new Date().toISOString())
      }
    } catch (err) {
      console.error('Error al cargar métricas financieras:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar los datos financieros')
    } finally {
      setLoading(false)
    }
  }, [periodo])

  // Cargar al montar o al cambiar el periodo
  useEffect(() => {
    void cargarDatos()
  }, [cargarDatos])

  return {
    metricas,
    loading,
    error,
    refrescar: cargarDatos,
    ultimaActualizacion
  }
}
