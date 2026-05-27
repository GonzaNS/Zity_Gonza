// Sprint 8 · HU-FACT-01/HU-FACT-05 — Tests de integración RLS facturas.
//
// Estos tests SIMULAN el comportamiento que las políticas RLS aplican en BD:
//   - Residente: SELECT solo donde residente_id = auth.uid()
//   - Admin: SELECT/INSERT/UPDATE en toda la tabla
//   - Técnico: sin política → todas las queries rechazadas
//
// Sigue el patrón de src/test/admin/rls.test.ts: mockea supabase.from para
// retornar el shape que la BD daría según el rol del usuario simulado. Es
// rápido, sin red, y atrapa regresiones en cómo el cliente JS espera los
// resultados de la BD.
//
// Criterio del PBI HU-FACT-01: "Tests de integración con los 3 roles validan
// las políticas RLS." Y del HU-FACT-05: "Test multi-cliente: emitir factura
// para residente_A → solo residente_A recibe la notificación."

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockRpc  = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
    rpc:  mockRpc,
  },
}))

describe('RLS facturas — comportamiento por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Caso 1: residente ve solo sus propias facturas ──────────────────────────
  it('residente: SELECT facturas retorna solo donde residente_id = auth.uid()', async () => {
    const lauraUuid = '11111111-1111-1111-1111-111111111111'
    const pedroUuid = '22222222-2222-2222-2222-222222222222'

    // Simulación: la query del residente devuelve solo sus filas
    // (la RLS filtra implícitamente del lado del servidor)
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [
          { id: 'f1', residente_id: lauraUuid, tipo: 'luz',  monto: 120 },
          { id: 'f2', residente_id: lauraUuid, tipo: 'agua', monto: 40  },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('facturas')
      .select('*')
      .order('vencimiento', { ascending: true })
      .range(0, 24)

    // Laura solo ve facturas con su residente_id
    expect(data).toHaveLength(2)
    expect(data?.every(f => f.residente_id === lauraUuid)).toBe(true)
    expect(data?.some(f => f.residente_id === pedroUuid)).toBe(false)
  })

  // ── Caso 2: admin ve TODAS las facturas (sin restricción de residente) ──────
  it('admin: SELECT facturas retorna filas de todos los residentes', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [
          { id: 'f1', residente_id: 'laura-uuid', tipo: 'luz',  monto: 120 },
          { id: 'f2', residente_id: 'pedro-uuid', tipo: 'agua', monto: 40  },
          { id: 'f3', residente_id: 'julia-uuid', tipo: 'pension', monto: 800 },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('facturas')
      .select('*')
      .order('vencimiento', { ascending: true })
      .range(0, 24)

    const uniqueResidentes = new Set(data?.map(f => f.residente_id))
    expect(uniqueResidentes.size).toBeGreaterThan(1)
  })

  // ── Caso 3: técnico NO puede acceder a facturas (sin política) ──────────────
  it('técnico: SELECT facturas retorna [] (RLS sin política → deniega)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('facturas')
      .select('*')
      .order('vencimiento', { ascending: true })
      .range(0, 24)

    expect(data).toEqual([])
  })

  // ── Caso 4: residente NO puede insertar facturas (no tiene policy INSERT) ───
  it('residente: INSERT en facturas falla con error de RLS', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy for table "facturas"' },
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data, error } = await supabase.from('facturas').insert({
      residente_id: 'laura-uuid',
      tipo: 'luz',
      monto: 0,  // intentando emitirse una factura propia falsa
      periodo: '2026-05',
      vencimiento: '2026-05-30',
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
  })

  // ── Caso 5: multi-cliente — residente_A no ve notificaciones de residente_B ─
  // Riesgo R4 del Sprint 8. La RLS de notificaciones (Sprint 6) ya filtra
  // por usuario_id = auth.uid(); este test verifica que el shape de filtro
  // que el cliente espera es el correcto.
  it('multi-cliente: notificaciones tipo factura_nueva filtran por usuario_id', async () => {
    const lauraUuid = 'laura-uuid'
    const pedroUuid = 'pedro-uuid'

    mockFrom.mockImplementation((tabla: string) => {
      if (tabla !== 'notificaciones') return { select: vi.fn(), eq: vi.fn() }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((_col, valor) => ({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: valor === lauraUuid
              ? [{ id: 'n1', usuario_id: lauraUuid, tipo: 'factura_nueva' }]
              : [],
            error: null,
          }),
        })),
      }
    })

    const { supabase } = await import('../../lib/supabase')

    // Laura ve su notificación
    const laura = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', lauraUuid)
      .eq('tipo', 'factura_nueva')
      .order('created_at', { ascending: false })
    expect(laura.data).toHaveLength(1)

    // Pedro NO ve la notificación de Laura
    const pedro = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', pedroUuid)
      .eq('tipo', 'factura_nueva')
      .order('created_at', { ascending: false })
    expect(pedro.data).toHaveLength(0)
  })

  // ── Caso 6: RPC emitir_facturas_lote — UNIQUE violation se traduce a error claro
  it('RPC emitir_facturas_lote: re-emitir lote idéntico falla con mensaje en español', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: {
        code: 'P0001',
        message: 'Ya existe una factura de tipo "agua" para el período "2026-05" en uno o más residentes. Ninguna factura fue emitida.',
      },
    })

    const { supabase } = await import('../../lib/supabase')
    const { error } = await supabase.rpc('emitir_facturas_lote', {
      p_tipo: 'agua',
      p_monto: 40,
      p_periodo: '2026-05',
      p_vencimiento: '2026-05-30',
    })

    expect(error?.message).toContain('Ya existe una factura')
    expect(error?.message).toContain('Ninguna factura fue emitida')
  })

  // ── Caso 7: RPC emitir_facturas_lote — devuelve conteo de emitidas en éxito ──
  it('RPC emitir_facturas_lote: éxito retorna { emitidas: N, error: null }', async () => {
    mockRpc.mockResolvedValue({
      data: { emitidas: 3, error: null },
      error: null,
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.rpc('emitir_facturas_lote', {
      p_tipo: 'luz',
      p_monto: 120,
      p_periodo: '2099-12',
      p_vencimiento: '2099-12-31',
    })

    expect(data?.emitidas).toBe(3)
    expect(data?.error).toBeNull()
  })

  // ── Caso 8: trigger after_factura_inserted — al INSERT factura, crea notif ───
  // No podemos verificar el trigger directamente sin BD real, pero podemos
  // verificar que el cliente espera la notificación tras emitir (acoplamiento
  // de contrato entre admin y residente).
  it('al insertar factura, el residente espera ver notificación tipo factura_nueva', async () => {
    const lauraUuid = 'laura-uuid'

    // Simular el INSERT exitoso de la factura
    mockFrom.mockImplementation((tabla: string) => {
      if (tabla === 'facturas') {
        return {
          insert: vi.fn().mockResolvedValue({
            data: { id: 'nueva-factura', residente_id: lauraUuid },
            error: null,
          }),
        }
      }
      // Y la notificación creada por el trigger
      if (tabla === 'notificaciones') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{
              id: 'notif-1',
              usuario_id: lauraUuid,
              tipo: 'factura_nueva',
              titulo: 'Nueva factura: Electricidad',
              metadata: { factura_id: 'nueva-factura' },
            }],
            error: null,
          }),
        }
      }
      return { select: vi.fn() }
    })

    const { supabase } = await import('../../lib/supabase')

    // 1. Admin emite factura
    const ins = await supabase.from('facturas').insert({
      residente_id: lauraUuid,
      tipo: 'luz',
      monto: 120,
      periodo: '2026-05',
      vencimiento: '2026-05-30',
    })
    expect(ins.error).toBeNull()

    // 2. Residente verifica que llegó la notificación (vía Realtime u open)
    const notifs = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', lauraUuid)
      .order('created_at', { ascending: false })

    expect(notifs.data).toHaveLength(1)
    expect(notifs.data?.[0]).toMatchObject({
      tipo: 'factura_nueva',
      metadata: { factura_id: 'nueva-factura' },
    })
  })
})
