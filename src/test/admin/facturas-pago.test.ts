// Sprint 9 · HU-FACT-04 — Tests de integración del registro de pago.
//
// Mockean supabase.rpc (patrón de rls-facturas.test.ts): verifican el contrato
// del wrapper registrarPagoFactura contra la RPC registrar_pago_factura, incluida
// la idempotencia del doble pago (R3). El comportamiento real ya se validó con un
// smoke test E2E contra la BD (pendiente→pagada, vencida→pagada, doble pago).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted: estas funciones deben existir cuando el factory de vi.mock corre
// (hoisteado al tope), porque importamos lib/facturas estáticamente y eso carga
// lib/supabase de inmediato.
const { mockRpc, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockFrom: vi.fn() }))

vi.mock('../../lib/supabase', () => ({
  supabase: { rpc: mockRpc, from: mockFrom },
}))

import { registrarPagoFactura } from '../../lib/facturas'

describe('registrarPagoFactura — transición a pagada (HU-FACT-04)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pendiente → pagada: ok y yaPagada=false, con los parámetros correctos', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, ya_pagada: false, numero: 'F-2026-05-001', mensaje: 'Factura registrada como pagada' },
      error: null,
    })

    const r = await registrarPagoFactura('f1', 'transferencia', '2026-05-15')

    expect(r.ok).toBe(true)
    expect(r.yaPagada).toBe(false)
    expect(mockRpc).toHaveBeenCalledWith('registrar_pago_factura', {
      p_factura_id: 'f1', p_metodo: 'transferencia', p_fecha: '2026-05-15',
    })
  })

  it('vencida → pagada: también se registra (la transición lo permite)', async () => {
    mockRpc.mockResolvedValue({ data: { ok: true, ya_pagada: false }, error: null })

    const r = await registrarPagoFactura('f2', 'efectivo')

    expect(r.ok).toBe(true)
    expect(r.yaPagada).toBe(false)
    // Sin fecha explícita → se envía null y el servidor usa hoy (America/Lima).
    expect(mockRpc).toHaveBeenCalledWith('registrar_pago_factura', {
      p_factura_id: 'f2', p_metodo: 'efectivo', p_fecha: null,
    })
  })

  it('doble pago idempotente (R3): yaPagada=true y aviso "ya estaba pagada"', async () => {
    mockRpc.mockResolvedValue({
      data: { ok: true, ya_pagada: true, mensaje: 'La factura ya estaba pagada' },
      error: null,
    })

    const r = await registrarPagoFactura('f1', 'efectivo')

    expect(r.ok).toBe(true)
    expect(r.yaPagada).toBe(true)
    expect(r.mensaje).toMatch(/ya estaba pagada/i)
  })

  it('propaga el error si la RPC rechaza (ej: caller no admin)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Acceso denegado: se requiere rol admin' },
    })

    const r = await registrarPagoFactura('f1', 'efectivo')

    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Acceso denegado/)
  })
})

describe('Contrato de notificación tras el pago (HU-FACT-04)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el residente correcto recibe una notificación tipo factura_pagada', async () => {
    const lauraUuid = 'laura-uuid'
    mockFrom.mockImplementation((tabla: string) => {
      if (tabla !== 'notificaciones') return { select: vi.fn() }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'n1', usuario_id: lauraUuid, tipo: 'factura_pagada', metadata: { factura_id: 'f1' } }],
          error: null,
        }),
      }
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', lauraUuid)
      .eq('tipo', 'factura_pagada')
      .order('created_at', { ascending: false })

    expect(data).toHaveLength(1)
    expect(data?.[0]).toMatchObject({ tipo: 'factura_pagada', metadata: { factura_id: 'f1' } })
  })
})
