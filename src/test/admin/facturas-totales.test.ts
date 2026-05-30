// Sprint 9 · PBI-S8-E02 — Tests del RPC de totales del periodo.
//
// Verifican el contrato del wrapper obtenerTotalesPeriodo y la invariante de
// negocio: cobrado + pendiente + vencido = emitido (los 3 estados son exhaustivos).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mockRpc } }))

import { obtenerTotalesPeriodo } from '../../lib/facturas'

describe('obtenerTotalesPeriodo (PBI-S8-E02)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mapea los totales y cumple cobrado + pendiente + vencido = emitido', async () => {
    mockRpc.mockResolvedValue({
      data: { emitido: 480, cobrado: 160, pendiente: 280, vencido: 40 },
      error: null,
    })

    const t = await obtenerTotalesPeriodo('2026-05')

    expect(t).toEqual({ emitido: 480, cobrado: 160, pendiente: 280, vencido: 40 })
    expect(t.cobrado + t.pendiente + t.vencido).toBe(t.emitido)
    expect(mockRpc).toHaveBeenCalledWith('totales_facturacion', { p_periodo: '2026-05' })
  })

  it('convierte los numeric de Postgres (que llegan como string) a number', async () => {
    mockRpc.mockResolvedValue({
      data: { emitido: '480.00', cobrado: '160.00', pendiente: '280.00', vencido: '40.00' },
      error: null,
    })

    const t = await obtenerTotalesPeriodo('2026-05')

    expect(t.emitido).toBe(480)
    expect(typeof t.cobrado).toBe('number')
    expect(t.cobrado + t.pendiente + t.vencido).toBe(t.emitido)
  })

  it('ante un error del RPC devuelve ceros (no rompe la tarjeta)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'fail' } })

    const t = await obtenerTotalesPeriodo('2026-05')

    expect(t).toEqual({ emitido: 0, cobrado: 0, pendiente: 0, vencido: 0 })
  })
})
