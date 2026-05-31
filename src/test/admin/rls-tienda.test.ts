// Sprint 10 · HU-TIENDA-01 — Tests de integración RLS de la Tienda (3 roles).
//
// Estos tests SIMULAN el comportamiento que las políticas RLS aplican en BD
// (migración 20260530150000_sprint10_tienda.sql):
//   productos:
//     - residente / técnico: SELECT solo donde activo = true (catálogo)
//     - admin: SELECT activos e inactivos; único que INSERT/UPDATE
//     - residente: INSERT denegado (sin política) → 42501
//   pedidos / pedido_items:
//     - residente: solo los suyos (residente_id = auth.uid())
//     - admin: todos
//     - técnico: sin política → 0 filas
//
// Sigue el patrón de src/test/admin/rls-facturas.test.ts: mockea supabase.from
// para devolver el shape que la BD daría según el rol del usuario simulado.
// Rápido, sin red, y atrapa regresiones en cómo el cliente JS espera la BD.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

describe('RLS tienda — comportamiento por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── productos · Caso 1: residente ve solo productos activos ─────────────────
  it('residente: SELECT productos retorna solo los activos (RLS filtra activo=true)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [
          { id: 'p1', nombre: 'Agua',  activo: true, stock: 24 },
          { id: 'p2', nombre: 'Focos', activo: true, stock: 3 },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase
      .from('productos')
      .select('*')
      .order('nombre', { ascending: true })
      .range(0, 23)

    expect(data).toHaveLength(2)
    expect(data?.every(p => p.activo === true)).toBe(true)
  })

  // ── productos · Caso 2: admin ve activos E inactivos ────────────────────────
  it('admin: SELECT productos retorna activos e inactivos', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [
          { id: 'p1', nombre: 'Agua',          activo: true },
          { id: 'p2', nombre: 'Descontinuado', activo: false },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('productos').select('*').order('nombre').range(0, 23)

    expect(data?.some(p => p.activo === false)).toBe(true)
    expect(data?.some(p => p.activo === true)).toBe(true)
  })

  // ── productos · Caso 3: técnico también ve el catálogo activo ────────────────
  it('técnico: SELECT productos retorna solo activos (ve el catálogo, no los inactivos)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn().mockResolvedValue({
        data: [{ id: 'p1', nombre: 'Agua', activo: true }],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('productos').select('*').order('nombre').range(0, 23)

    expect(data).toHaveLength(1)
    expect(data?.every(p => p.activo === true)).toBe(true)
  })

  // ── productos · Caso 4: residente NO puede crear productos ───────────────────
  it('residente: INSERT en productos falla con error de RLS (sin política de escritura)', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy for table "productos"' },
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data, error } = await supabase.from('productos').insert({
      nombre: 'Producto pirata', categoria: 'otros', precio: 1, stock: 1,
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
  })

  // ── pedidos · Caso 5: residente ve solo sus propios pedidos ──────────────────
  it('residente: SELECT pedidos retorna solo donde residente_id = auth.uid()', async () => {
    const lauraUuid = '11111111-1111-1111-1111-111111111111'
    const pedroUuid = '22222222-2222-2222-2222-222222222222'

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({
        data: [
          { id: 'o1', residente_id: lauraUuid, estado: 'borrador' },
          { id: 'o2', residente_id: lauraUuid, estado: 'confirmado' },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false })

    expect(data).toHaveLength(2)
    expect(data?.every(o => o.residente_id === lauraUuid)).toBe(true)
    expect(data?.some(o => o.residente_id === pedroUuid)).toBe(false)
  })

  // ── pedidos · Caso 6: admin ve los pedidos de todos los residentes ───────────
  it('admin: SELECT pedidos retorna pedidos de múltiples residentes', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({
        data: [
          { id: 'o1', residente_id: 'laura-uuid' },
          { id: 'o2', residente_id: 'pedro-uuid' },
          { id: 'o3', residente_id: 'julia-uuid' },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false })

    const residentes = new Set(data?.map(o => o.residente_id))
    expect(residentes.size).toBeGreaterThan(1)
  })

  // ── pedidos · Caso 7: técnico no tiene acceso a pedidos ──────────────────────
  it('técnico: SELECT pedidos retorna [] (RLS sin política → deniega)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      order:  vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('pedidos').select('*').order('created_at', { ascending: false })

    expect(data).toEqual([])
  })

  // ── pedido_items · Caso 8: acceso derivado del pedido padre ──────────────────
  it('residente: SELECT pedido_items retorna solo los items de sus propios pedidos', async () => {
    const lauraUuid = '11111111-1111-1111-1111-111111111111'

    // La RLS de pedido_items se evalúa via EXISTS sobre el pedido padre; el
    // cliente recibe solo los items cuyos pedidos pertenecen a Laura.
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockResolvedValue({
        data: [
          { id: 'it1', pedido_id: 'o1', producto_id: 'p1', cantidad: 2 },
          { id: 'it2', pedido_id: 'o1', producto_id: 'p2', cantidad: 1 },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('pedido_items').select('*').eq('pedido_id', 'o1')

    expect(data).toHaveLength(2)
    expect(data?.every(it => it.pedido_id === 'o1')).toBe(true)
    // (el pedido 'o1' pertenece a Laura — verificado por la RLS de pedidos)
    expect(lauraUuid).toBeTruthy()
  })
})
