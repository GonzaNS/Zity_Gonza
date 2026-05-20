// Sprint 6 · PBI-12 / HU-NOTIF-01 / HU-NOTIF-02
// Módulo de notificaciones: lógica pura (testeable) + operaciones de datos.
// La suscripción Realtime y el estado React viven en NotificacionesContext;
// aquí se concentra todo lo que se puede probar sin React ni red.

import { supabase } from './supabase'
import type { Notificacion } from '../types/database'

/** Máximo de notificaciones que se mantienen en memoria / se piden por fetch. */
export const NOTIF_FETCH_LIMIT = 50

/**
 * Backoff exponencial para reconexión Realtime: 1s, 2s, 4s, 8s, …, máx 30s.
 * `intento` es 0-indexado (primer reintento => 1s).
 */
export function calcularBackoff(intento: number): number {
  return Math.min(1000 * 2 ** intento, 30000)
}

/** Cuenta cuántas notificaciones están sin leer. */
export function contarNoLeidas(notifs: Notificacion[]): number {
  return notifs.filter(n => !n.leida).length
}

/** Forma mínima de un evento Realtime de postgres_changes que nos interesa. */
export type EventoRealtime = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new?: Partial<Notificacion> | null
  old?: Partial<Notificacion> | null
}

/**
 * Aplica un evento Realtime al arreglo previo de notificaciones (función pura).
 * - INSERT: agrega al inicio sin duplicar (idempotente por id) y respeta el límite.
 * - UPDATE: reemplaza la fila por id.
 * - DELETE: la elimina por id.
 */
export function aplicarEventoRealtime(
  prev: Notificacion[],
  payload: EventoRealtime,
): Notificacion[] {
  if (payload.eventType === 'INSERT' && payload.new) {
    const nueva = payload.new as Notificacion
    if (prev.some(n => n.id === nueva.id)) return prev
    return [nueva, ...prev].slice(0, NOTIF_FETCH_LIMIT)
  }
  if (payload.eventType === 'UPDATE' && payload.new) {
    const actualizada = payload.new as Notificacion
    return prev.map(n => (n.id === actualizada.id ? actualizada : n))
  }
  if (payload.eventType === 'DELETE' && payload.old?.id) {
    return prev.filter(n => n.id !== payload.old!.id)
  }
  return prev
}

// ─── Operaciones de datos ────────────────────────────────────────────────────

/** Trae las últimas notificaciones del usuario (más recientes primero). */
export async function fetchNotificaciones(usuarioId: string): Promise<Notificacion[]> {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(NOTIF_FETCH_LIMIT)

  if (error || !data) return []
  return data as Notificacion[]
}

/** Marca una notificación como leída. */
export async function marcarNotificacionLeida(id: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('id', id)
  return { ok: !error }
}

/** Marca todas las no leídas del usuario como leídas. */
export async function marcarTodasLeidas(usuarioId: string): Promise<{ ok: boolean }> {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', usuarioId)
    .eq('leida', false)
  return { ok: !error }
}
