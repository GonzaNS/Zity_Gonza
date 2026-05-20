import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calcularBackoff,
  contarNoLeidas,
  aplicarEventoRealtime,
  fetchNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  NOTIF_FETCH_LIMIT,
} from '../lib/notificaciones'
import type { Notificacion } from '../types/database'

// Mock de Supabase: la cadena fluent que usan las operaciones de datos.
//   fetch:  from().select().eq().order().limit()  -> { data, error }
//   marcar: from().update().eq()[.eq()]           -> { error }  (thenable)
const mockState = {
  selectData: [] as Notificacion[],
  selectError: null as { message: string } | null,
  updateError: null as { message: string } | null,
}

vi.mock('../lib/supabase', () => {
  // El chain de update es "thenable" y además expone .eq() encadenable, para
  // soportar tanto update().eq() (una notificación) como update().eq().eq() (todas).
  const makeUpdateChain = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      eq: () => chain,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      then: (onF: any, onR: any) =>
        Promise.resolve({ error: mockState.updateError }).then(onF, onR),
    }
    return chain
  }
  return {
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: mockState.selectData, error: mockState.selectError }),
            }),
          }),
        }),
        update: () => makeUpdateChain(),
      }),
    },
  }
})

function notif(over: Partial<Notificacion> = {}): Notificacion {
  return {
    id: 'n1',
    usuario_id: 'u1',
    solicitud_id: null,
    tipo: 'estado_cambio',
    titulo: 'Título',
    mensaje: 'Mensaje',
    leida: false,
    created_at: '2026-05-20T00:00:00Z',
    ...over,
  }
}

describe('notificaciones — lógica pura', () => {
  it('calcularBackoff crece exponencialmente y se limita a 30s', () => {
    expect(calcularBackoff(0)).toBe(1000)
    expect(calcularBackoff(1)).toBe(2000)
    expect(calcularBackoff(2)).toBe(4000)
    expect(calcularBackoff(3)).toBe(8000)
    expect(calcularBackoff(10)).toBe(30000)
  })

  it('contarNoLeidas cuenta solo las no leídas', () => {
    expect(contarNoLeidas([notif({ leida: false }), notif({ id: 'n2', leida: true })])).toBe(1)
    expect(contarNoLeidas([])).toBe(0)
  })

  it('aplicarEventoRealtime INSERT agrega al inicio', () => {
    const next = aplicarEventoRealtime([notif({ id: 'n1' })], { eventType: 'INSERT', new: notif({ id: 'n2' }) })
    expect(next).toHaveLength(2)
    expect(next[0]?.id).toBe('n2')
  })

  it('aplicarEventoRealtime INSERT no duplica por id', () => {
    const next = aplicarEventoRealtime([notif({ id: 'n1' })], { eventType: 'INSERT', new: notif({ id: 'n1' }) })
    expect(next).toHaveLength(1)
  })

  it('aplicarEventoRealtime INSERT respeta el límite máximo', () => {
    const prev = Array.from({ length: NOTIF_FETCH_LIMIT }, (_, i) => notif({ id: `x${i}` }))
    const next = aplicarEventoRealtime(prev, { eventType: 'INSERT', new: notif({ id: 'nuevo' }) })
    expect(next).toHaveLength(NOTIF_FETCH_LIMIT)
    expect(next[0]?.id).toBe('nuevo')
  })

  it('aplicarEventoRealtime UPDATE reemplaza la fila por id', () => {
    const next = aplicarEventoRealtime([notif({ id: 'n1', leida: false })], { eventType: 'UPDATE', new: notif({ id: 'n1', leida: true }) })
    expect(next[0]?.leida).toBe(true)
  })

  it('aplicarEventoRealtime DELETE elimina por id', () => {
    const next = aplicarEventoRealtime([notif({ id: 'n1' }), notif({ id: 'n2' })], { eventType: 'DELETE', old: { id: 'n1' } })
    expect(next).toHaveLength(1)
    expect(next[0]?.id).toBe('n2')
  })
})

describe('notificaciones — operaciones de datos', () => {
  beforeEach(() => {
    mockState.selectData = []
    mockState.selectError = null
    mockState.updateError = null
  })

  it('fetchNotificaciones devuelve los datos cuando no hay error', async () => {
    mockState.selectData = [notif()]
    const data = await fetchNotificaciones('u1')
    expect(data).toHaveLength(1)
    expect(data[0]?.id).toBe('n1')
  })

  it('fetchNotificaciones devuelve [] ante error', async () => {
    mockState.selectError = { message: 'boom' }
    const data = await fetchNotificaciones('u1')
    expect(data).toEqual([])
  })

  it('marcarNotificacionLeida devuelve ok=true sin error', async () => {
    const r = await marcarNotificacionLeida('n1')
    expect(r.ok).toBe(true)
  })

  it('marcarNotificacionLeida devuelve ok=false con error', async () => {
    mockState.updateError = { message: 'rls' }
    const r = await marcarNotificacionLeida('n1')
    expect(r.ok).toBe(false)
  })

  it('marcarTodasLeidas devuelve ok=true sin error', async () => {
    const r = await marcarTodasLeidas('u1')
    expect(r.ok).toBe(true)
  })

  it('marcarTodasLeidas devuelve ok=false con error', async () => {
    mockState.updateError = { message: 'rls' }
    const r = await marcarTodasLeidas('u1')
    expect(r.ok).toBe(false)
  })
})
