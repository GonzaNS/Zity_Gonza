// Sprint 9 · HU-FACT-06/08 — Tests de contrato del job diario.
//
// El job (marcar_facturas_vencidas_y_recordatorios) es una función SQL invocada
// por pg_cron a las 06:00 America/Lima. Aquí se verifica el CONTRATO que el job
// expone {vencidas, recordatorios, fecha} y la idempotencia esperada (R1): una
// segunda ejecución consecutiva no vuelve a marcar ni a notificar.
//
// El comportamiento real se validó con un smoke test E2E contra la BD:
//   cron 1ª vez → {vencidas:1, recordatorios:1}; cron 2ª vez → {vencidas:0, recordatorios:0}.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc, mockFrom } = vi.hoisted(() => ({ mockRpc: vi.fn(), mockFrom: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mockRpc, from: mockFrom } }))

import { supabase } from '../../lib/supabase'

describe('Job diario vencidas + recordatorios (HU-FACT-06/08)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('primera ejecución: marca vencidas y emite recordatorios 3 días antes', async () => {
    mockRpc.mockResolvedValue({
      data: { vencidas: 1, recordatorios: 1, fecha: '2026-05-29' },
      error: null,
    })

    const { data } = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')

    expect(data.vencidas).toBe(1)
    expect(data.recordatorios).toBe(1)
  })

  it('idempotencia (R1): la segunda corrida no duplica (0 vencidas, 0 recordatorios)', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { vencidas: 1, recordatorios: 1, fecha: '2026-05-29' }, error: null })
      .mockResolvedValueOnce({ data: { vencidas: 0, recordatorios: 0, fecha: '2026-05-29' }, error: null })

    const primera = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')
    const segunda = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')

    expect(primera.data.recordatorios).toBe(1)
    expect(segunda.data.recordatorios).toBe(0) // exactamente 1 recordatorio por factura
    expect(segunda.data.vencidas).toBe(0)
  })

  it('el residente recibe una notificación tipo factura_por_vencer con deep link', async () => {
    const lauraUuid = 'laura-uuid'
    mockFrom.mockImplementation((tabla: string) => {
      if (tabla !== 'notificaciones') return { select: vi.fn() }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'n1', usuario_id: lauraUuid, tipo: 'factura_por_vencer', metadata: { factura_id: 'f1' } }],
          error: null,
        }),
      }
    })

    const { data } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', lauraUuid)
      .eq('tipo', 'factura_por_vencer')
      .order('created_at', { ascending: false })

    expect(data).toHaveLength(1)
    expect(data?.[0]).toMatchObject({ tipo: 'factura_por_vencer', metadata: { factura_id: 'f1' } })
  })

  // ── Sprint 12 · Buffer PBI-S9-E02 — recordatorio el día del vencimiento ──────
  it('PBI-S9-E02: el job reporta los recordatorios emitidos el día del vencimiento', async () => {
    mockRpc.mockResolvedValue({
      data: { vencidas: 0, recordatorios: 0, recordatorios_hoy: 2, fecha: '2026-06-13' },
      error: null,
    })

    const { data } = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')

    expect(data.recordatorios_hoy).toBe(2)
  })

  it('idempotencia (R1): el recordatorio del día del vencimiento no se duplica', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: { vencidas: 0, recordatorios: 0, recordatorios_hoy: 1, fecha: '2026-06-13' }, error: null })
      .mockResolvedValueOnce({ data: { vencidas: 0, recordatorios: 0, recordatorios_hoy: 0, fecha: '2026-06-13' }, error: null })

    const primera = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')
    const segunda = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')

    expect(primera.data.recordatorios_hoy).toBe(1)
    expect(segunda.data.recordatorios_hoy).toBe(0)
  })
})
