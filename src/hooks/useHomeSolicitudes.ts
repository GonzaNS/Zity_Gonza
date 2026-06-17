// Sprint 13 · HU-HOME-02 — Hook para la tarjeta de solicitudes activas del home.
//
// Consulta vw_home_solicitudes (security_invoker): devuelve hasta 5 solicitudes
// activas del residente autenticado con los últimos 3 cambios de estado embebidos.
// El residente solo ve las suyas (RLS de la tabla base).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { EstadoSolicitud, TipoSolicitud, CategoriaSolicitud } from '../types/database'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type MiniEstado = {
  estado_nuevo: EstadoSolicitud
  estado_anterior: EstadoSolicitud | null
  created_at: string
  nota: string | null
}

export type SolicitudHome = {
  id: string
  codigo: string | null
  tipo: TipoSolicitud
  categoria: CategoriaSolicitud
  descripcion: string
  estado: EstadoSolicitud
  prioridad: string
  imagen_url: string | null
  created_at: string
  updated_at: string
  /** Últimos 3 cambios de estado, ordenados del más reciente al más antiguo. */
  ultimos_estados: MiniEstado[]
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useHomeSolicitudes() {
  const [solicitudes, setSolicitudes] = useState<SolicitudHome[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('vw_home_solicitudes')
      .select('id, codigo, tipo, categoria, descripcion, estado, prioridad, imagen_url, created_at, updated_at, ultimos_estados')

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as Array<Omit<SolicitudHome, 'ultimos_estados'> & { ultimos_estados: unknown }>

    setSolicitudes(
      rows.map(r => ({
        ...r,
        ultimos_estados: Array.isArray(r.ultimos_estados)
          ? (r.ultimos_estados as MiniEstado[])
          : [],
      })),
    )
    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { solicitudes, loading, error, recargar: cargar }
}
