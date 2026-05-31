// Sprint 10 · HU-FACT-09 — Tests del wrapper pagarFacturaResidente (lib/facturas).
//
// Cubre las ramas del pago en línea simulado: éxito, idempotencia (ya pagada),
// error de la RPC y respuesta vacía (defaults). Mantiene la cobertura ≥ 60% de
// src/lib/facturas.ts (gate de DoD v2).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc },
}))

describe('pagarFacturaResidente', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('éxito: ok=true con el mensaje del servidor y llama la RPC con el id', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, ya_pagada: false, mensaje: 'Pago realizado correctamente' },
      error: null,
    })
    const { pagarFacturaResidente } = await import('../../lib/facturas')
    const res = await pagarFacturaResidente('f-123')

    expect(mockRpc).toHaveBeenCalledWith('pagar_factura_residente', { p_factura_id: 'f-123' })
    expect(res).toEqual({ ok: true, yaPagada: false, mensaje: 'Pago realizado correctamente' })
  })

  it('idempotencia: la factura ya estaba pagada → yaPagada=true', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, ya_pagada: true, mensaje: 'La factura ya estaba pagada' },
      error: null,
    })
    const { pagarFacturaResidente } = await import('../../lib/facturas')
    const res = await pagarFacturaResidente('f-123')

    expect(res.ok).toBe(true)
    expect(res.yaPagada).toBe(true)
  })

  it('error de la RPC: ok=false y propaga el mensaje (seguridad R4)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Acceso denegado: solo puedes pagar tus propias facturas' },
    })
    const { pagarFacturaResidente } = await import('../../lib/facturas')
    const res = await pagarFacturaResidente('f-otro')

    expect(res.ok).toBe(false)
    expect(res.yaPagada).toBe(false)
    expect(res.error).toMatch(/Acceso denegado/)
    expect(res.mensaje).toMatch(/Acceso denegado/)
  })

  it('respuesta vacía: aplica los defaults (data ?? {} y ?? por campo)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    const { pagarFacturaResidente } = await import('../../lib/facturas')
    const res = await pagarFacturaResidente('f-123')

    expect(res).toEqual({ ok: true, yaPagada: false, mensaje: '' })
  })
})
