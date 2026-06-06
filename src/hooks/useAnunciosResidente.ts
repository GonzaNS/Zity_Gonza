// Sprint 12 · HU-ANUNCIO-03/04 — Hooks del tablón para el residente.
//
//   • useAnunciosResidente: feed de anuncios vigentes (la RLS ya filtra los
//     archivados/vencidos) enriquecido con el estado de lectura del residente,
//     con adjuntos firmados, suscripción Realtime (aparece al instante) y
//     marcarLeido (registra la lectura en anuncio_lecturas, idempotente).
//   • useAnunciosNoLeidos: contador del badge de la navbar, recalculado SIEMPRE
//     desde BD (R3) y sincronizado en vivo por Realtime (anuncios + lecturas).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { firmarAdjuntos } from './useAnunciosAdmin'
import { ordenarFeed, type Anuncio, type AnuncioConLectura } from '../lib/anuncios'

export type UseAnunciosResidenteResult = {
  anuncios: AnuncioConLectura[]
  adjuntos: Map<string, string>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  /** Registra la lectura del residente (optimista + idempotente). */
  marcarLeido: (anuncioId: string) => Promise<{ ok: boolean }>
}

export function useAnunciosResidente(usuarioId?: string): UseAnunciosResidenteResult {
  const [anuncios, setAnuncios] = useState<AnuncioConLectura[]>([])
  const [adjuntos, setAdjuntos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    if (!usuarioId) {
      setAnuncios([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    // La RLS de anuncios entrega al residente solo vigentes y no archivados.
    const [anunciosRes, lecturasRes] = await Promise.all([
      supabase.from('anuncios').select('*'),
      supabase.from('anuncio_lecturas').select('anuncio_id').eq('residente_id', usuarioId),
    ])

    if (anunciosRes.error) {
      setError(anunciosRes.error.message)
      setLoading(false)
      return
    }

    const leidos = new Set((lecturasRes.data ?? []).map(l => l.anuncio_id as string))
    const items = ordenarFeed((anunciosRes.data ?? []) as Anuncio[])
      .map(a => ({ ...a, leido: leidos.has(a.id) }))

    setAnuncios(items)
    setAdjuntos(await firmarAdjuntos(items.map(a => a.imagen_url)))
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
    if (!usuarioId) return

    // Realtime: un anuncio nuevo aparece al instante en el feed (guión de demo).
    const channel = supabase
      .channel(`anuncios-feed:${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios' }, () => {
        void cargar()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuarioId, cargar])

  const marcarLeido = useCallback(async (anuncioId: string): Promise<{ ok: boolean }> => {
    if (!usuarioId) return { ok: false }
    // Optimista: quita el badge 'Nuevo' al instante.
    setAnuncios(prev => prev.map(a => (a.id === anuncioId ? { ...a, leido: true } : a)))

    const { error: insErr } = await supabase
      .from('anuncio_lecturas')
      .upsert(
        { anuncio_id: anuncioId, residente_id: usuarioId },
        { onConflict: 'anuncio_id,residente_id', ignoreDuplicates: true },
      )

    if (insErr) {
      await cargar() // rollback desde BD
      return { ok: false }
    }
    return { ok: true }
  }, [usuarioId, cargar])

  return { anuncios, adjuntos, loading, error, refetch: cargar, marcarLeido }
}

/**
 * Contador de anuncios vigentes NO leídos para el badge de la navbar.
 * Se recalcula desde BD (R3) y se mantiene en vivo: sube al publicarse un
 * anuncio y baja al registrarse una lectura del propio residente.
 */
export function useAnunciosNoLeidos(usuarioId?: string): number {
  const [count, setCount] = useState(0)

  const recalcular = useCallback(async () => {
    if (!usuarioId) {
      setCount(0)
      return
    }
    const [anunciosRes, lecturasRes] = await Promise.all([
      supabase.from('anuncios').select('id'),
      supabase.from('anuncio_lecturas').select('anuncio_id').eq('residente_id', usuarioId),
    ])
    if (anunciosRes.error) return
    const leidos = new Set((lecturasRes.data ?? []).map(l => l.anuncio_id as string))
    const noLeidos = (anunciosRes.data ?? []).filter(a => !leidos.has(a.id as string)).length
    setCount(noLeidos)
  }, [usuarioId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recalcular()
    if (!usuarioId) return

    const channel = supabase
      .channel(`anuncios-badge:${usuarioId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios' }, () => {
        void recalcular()
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'anuncio_lecturas', filter: `residente_id=eq.${usuarioId}` },
        () => { void recalcular() },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuarioId, recalcular])

  return count
}
