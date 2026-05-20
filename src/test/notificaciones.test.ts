/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useNotificaciones } from '../lib/notificaciones'

// Mock de Supabase
const mockState = {
  selectData: [] as any[],
  selectError: null as any,
  updateError: null as any,
}

const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: mockState.selectData, error: mockState.selectError }))
      }))
    }))
  })),
  update: vi.fn(() => ({
    eq: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: mockState.updateError }))
    })),
    eqSingle: vi.fn(() => Promise.resolve({ error: mockState.updateError }))
  }))
}))

const mockChannelObj = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'notificaciones') {
        return mockFrom()
      }
      return {}
    },
    channel: () => mockChannelObj,
    removeChannel: vi.fn()
  }
}))

describe('useNotificaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState.selectData = []
    mockState.selectError = null
    mockState.updateError = null
  })

  it('debe inicializar vacio si no hay usuarioId', async () => {
    const { result } = renderHook(() => useNotificaciones(undefined))
    expect(result.current.notificaciones).toEqual([])
    expect(result.current.noLeidasCount).toBe(0)
    expect(result.current.loading).toBe(false)
  })

  it('debe consultar notificaciones si hay usuarioId', async () => {
    mockState.selectData = [
      { id: '1', usuario_id: 'usr1', titulo: 'Test', mensaje: 'Msg', leida: false, created_at: '2026-05-19T00:00:00Z' }
    ]

    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useNotificaciones('usr1'))
      hookResult = result
    })

    expect(hookResult.current.notificaciones).toHaveLength(1)
    expect(hookResult.current.noLeidasCount).toBe(1)
    expect(hookResult.current.loading).toBe(false)
  })

  it('debe permitir marcar como leida optimistamente', async () => {
    mockState.selectData = [
      { id: '1', usuario_id: 'usr1', titulo: 'Test', mensaje: 'Msg', leida: false, created_at: '2026-05-19T00:00:00Z' }
    ]

    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useNotificaciones('usr1'))
      hookResult = result
    })

    await act(async () => {
      await hookResult.current.marcarComoLeida('1')
    })

    expect(hookResult.current.notificaciones[0].leida).toBe(true)
    expect(hookResult.current.noLeidasCount).toBe(0)
  })

  it('debe permitir marcar todas como leidas optimistamente', async () => {
    mockState.selectData = [
      { id: '1', usuario_id: 'usr1', titulo: 'Test1', mensaje: 'Msg', leida: false, created_at: '2026-05-19T00:00:00Z' },
      { id: '2', usuario_id: 'usr1', titulo: 'Test2', mensaje: 'Msg', leida: false, created_at: '2026-05-19T00:00:00Z' }
    ]

    let hookResult: any
    await act(async () => {
      const { result } = renderHook(() => useNotificaciones('usr1'))
      hookResult = result
    })

    await act(async () => {
      await hookResult.current.marcarTodasComoLeidas()
    })

    expect(hookResult.current.notificaciones.every((n: any) => n.leida)).toBe(true)
    expect(hookResult.current.noLeidasCount).toBe(0)
  })
})
