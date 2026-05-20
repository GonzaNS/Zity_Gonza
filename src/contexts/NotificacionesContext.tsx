// Sprint 6 · PBI-12
// Suscripción Realtime CENTRALIZADA: una sola conexión al canal
// `notificaciones:{auth.uid()}` por sesión (decisión técnica + ADR-009).
// Antes cada componente que usaba el hook abría su propia suscripción y estado;
// ahora todos consumen este contexto. Incluye reconexión exponencial y refetch
// al (re)conectar para recuperar eventos perdidos (Riesgo R1 del Sprint 6).

import { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import {
  fetchNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  contarNoLeidas,
  aplicarEventoRealtime,
  calcularBackoff,
  type EventoRealtime,
} from '../lib/notificaciones'
import type { Notificacion } from '../types/database'

type NotificacionesContextType = {
  notificaciones: Notificacion[]
  noLeidasCount: number
  loading: boolean
  /** Marca una notificación como leída (optimista, rollback si falla). */
  marcarComoLeida: (id: string) => Promise<{ ok: boolean }>
  /** Marca todas como leídas (optimista, rollback si falla). */
  marcarTodasComoLeidas: () => Promise<{ ok: boolean }>
  refetch: () => Promise<void>
}

const NotificacionesContext = createContext<NotificacionesContextType | null>(null)

export function NotificacionesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const usuarioId = user?.id

  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loading, setLoading] = useState(true)

  const noLeidasCount = useMemo(() => contarNoLeidas(notificaciones), [notificaciones])

  // Estado de reconexión, fuera del render.
  const intentoRef = useRef(0)

  const cargar = useCallback(async () => {
    if (!usuarioId) {
      setNotificaciones([])
      setLoading(false)
      return
    }
    setLoading(true)
    const data = await fetchNotificaciones(usuarioId)
    setNotificaciones(data)
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    // Diferimos la carga a un microtask para no hacer setState síncrono en el
    // cuerpo del efecto (regla react-hooks/set-state-in-effect). cargar() maneja
    // internamente el caso sin usuario.
    void Promise.resolve().then(() => cargar())
    if (!usuarioId) return

    let activo = true
    let channel: RealtimeChannel | null = null
    let reconexionTimer: ReturnType<typeof setTimeout> | null = null

    const conectar = () => {
      channel = supabase
        .channel(`notificaciones:${usuarioId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuarioId}` },
          (payload) => {
            if (!activo) return
            setNotificaciones(prev => aplicarEventoRealtime(prev, payload as unknown as EventoRealtime))
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Conexión OK: reinicia el backoff y recupera lo que se perdió.
            intentoRef.current = 0
            void cargar()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!activo) return
            const delay = calcularBackoff(intentoRef.current)
            intentoRef.current += 1
            if (channel) {
              supabase.removeChannel(channel)
              channel = null
            }
            reconexionTimer = setTimeout(() => {
              if (activo) conectar()
            }, delay)
          }
        })
    }

    conectar()

    return () => {
      activo = false
      if (reconexionTimer) clearTimeout(reconexionTimer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [usuarioId, cargar])

  const marcarComoLeida = useCallback(async (id: string): Promise<{ ok: boolean }> => {
    // Optimista: baja el badge al instante.
    setNotificaciones(prev => prev.map(n => (n.id === id ? { ...n, leida: true } : n)))
    const { ok } = await marcarNotificacionLeida(id)
    if (!ok) await cargar() // rollback
    return { ok }
  }, [cargar])

  const marcarTodasComoLeidas = useCallback(async (): Promise<{ ok: boolean }> => {
    if (!usuarioId) return { ok: false }
    let snapshot: Notificacion[] = []
    setNotificaciones(prev => {
      snapshot = prev
      return prev.map(n => ({ ...n, leida: true }))
    })
    const { ok } = await marcarTodasLeidas(usuarioId)
    if (!ok) setNotificaciones(snapshot) // rollback
    return { ok }
  }, [usuarioId])

  const value = useMemo<NotificacionesContextType>(
    () => ({ notificaciones, noLeidasCount, loading, marcarComoLeida, marcarTodasComoLeidas, refetch: cargar }),
    [notificaciones, noLeidasCount, loading, marcarComoLeida, marcarTodasComoLeidas, cargar],
  )

  return <NotificacionesContext.Provider value={value}>{children}</NotificacionesContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotificaciones() {
  const ctx = useContext(NotificacionesContext)
  if (!ctx) {
    throw new Error('useNotificaciones debe usarse dentro de un NotificacionesProvider')
  }
  return ctx
}
