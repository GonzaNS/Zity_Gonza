import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { MetricasTienda } from '../lib/metricasTienda'

export function useMetricasTienda(periodo?: string) {
  const [metricas, setMetricas] = useState<MetricasTienda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null)

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Si no se pasa periodo, la función RPC en BD usará el mes actual por defecto
      const { data, error: err } = await supabase.rpc('get_metricas_tienda', {
        p_periodo: periodo || undefined
      })

      if (err) throw err

      if (data) {
        setMetricas(data as MetricasTienda)
        setUltimaActualizacion(new Date().toISOString())
      }
    } catch (err) {
      console.error('Error al cargar métricas de la tienda:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar los datos de la tienda')
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
