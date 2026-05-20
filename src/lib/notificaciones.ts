import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import type { Notificacion } from '../types/database'

export function useNotificaciones(usuarioId: string | undefined) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidasCount, setNoLeidasCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchNotificaciones = useCallback(async () => {
    if (!usuarioId) {
      setNotificaciones([])
      setNoLeidasCount(0)
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      setNotificaciones(data as Notificacion[])
      setNoLeidasCount(data.filter((n: Notificacion) => !n.leida).length)
    }
    setLoading(false)
  }, [usuarioId])

  useEffect(() => {
    void Promise.resolve().then(() => fetchNotificaciones())

    if (!usuarioId) return

    // Suscripción Realtime (PBI-12)
    const channel = supabase
      .channel(`notificaciones:${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${usuarioId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const nueva = payload.new as Notificacion
            setNotificaciones(prev => [nueva, ...prev].slice(0, 50))
            setNoLeidasCount(prev => prev + 1)
          } else if (payload.eventType === 'UPDATE') {
            const actualizada = payload.new as Notificacion
            setNotificaciones(prev =>
              prev.map(n => (n.id === actualizada.id ? actualizada : n))
            )
            // Recalcular contador
            setNoLeidasCount(prev => {
              const old = payload.old as Partial<Notificacion>
              if (old.leida === false && actualizada.leida === true) return Math.max(0, prev - 1)
              if (old.leida === true && actualizada.leida === false) return prev + 1
              return prev
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [usuarioId, fetchNotificaciones])

  const marcarComoLeida = async (id: string) => {
    // Optimistic update
    setNotificaciones(prev => prev.map(n => n.id === id ? { ...n, leida: true } : n))
    setNoLeidasCount(prev => Math.max(0, prev - 1))

    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id)

    if (error) {
      // Rollback on error
      fetchNotificaciones()
    }
  }

  const marcarTodasComoLeidas = async () => {
    if (!usuarioId) return

    // Optimistic update
    setNotificaciones(prev => prev.map(n => ({ ...n, leida: true })))
    setNoLeidasCount(0)

    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false)

    if (error) {
      // Rollback
      fetchNotificaciones()
    }
  }

  return {
    notificaciones,
    noLeidasCount,
    loading,
    marcarComoLeida,
    marcarTodasComoLeidas,
  }
}
