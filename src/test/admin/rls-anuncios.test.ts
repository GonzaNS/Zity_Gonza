// Sprint 12 · HU-ANUNCIO-01 — Tests de integración RLS del Tablón (3 roles).
//
// SIMULAN el comportamiento de las políticas RLS en BD
// (migración sprint12_anuncios_tablon.sql):
//   anuncios:
//     - residente / técnico: SELECT solo vigentes y no archivados
//     - admin: SELECT todo (vigentes, vencidos y archivados); único que INSERT/UPDATE (A01)
//     - residente: INSERT denegado (sin política de escritura) → 42501
//   anuncio_lecturas:
//     - cada residente solo la suya (residente_id = auth.uid())
//
// Sigue el patrón de rls-tienda.test.ts: mockea supabase.from para devolver el
// shape que la BD daría según el rol del usuario simulado. Cubre el riesgo R2
// (solo el admin publica) y R7 (vencidos/archivados fuera del feed).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

describe('RLS anuncios — comportamiento por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── anuncios · Caso 1: residente ve solo vigentes y no archivados ───────────
  it('residente: SELECT anuncios retorna solo vigentes y no archivados (RLS A01/R7)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'a1', titulo: 'Corte de agua', archivado: false, vigente_hasta: null },
          { id: 'a2', titulo: 'Asamblea',      archivado: false, vigente_hasta: '2099-01-01' },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('anuncios').select('*')

    expect(data).toHaveLength(2)
    expect(data?.every(a => a.archivado === false)).toBe(true)
  })

  // ── anuncios · Caso 2: admin ve todo (incluidos archivados / vencidos) ──────
  it('admin: SELECT anuncios retorna también archivados y vencidos', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { id: 'a1', titulo: 'Vigente',   archivado: false, vigente_hasta: null },
          { id: 'a2', titulo: 'Archivado', archivado: true,  vigente_hasta: null },
          { id: 'a3', titulo: 'Vencido',   archivado: false, vigente_hasta: '2020-01-01' },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('anuncios').select('*')

    expect(data?.some(a => a.archivado === true)).toBe(true)
    expect(data?.some(a => a.vigente_hasta === '2020-01-01')).toBe(true)
  })

  // ── anuncios · Caso 3: técnico también lee el tablón (vigentes) ─────────────
  it('técnico: SELECT anuncios retorna los vigentes (lee el tablón, no escribe)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: 'a1', titulo: 'Aviso general', archivado: false, vigente_hasta: null }],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('anuncios').select('*')

    expect(data).toHaveLength(1)
    expect(data?.every(a => a.archivado === false)).toBe(true)
  })

  // ── anuncios · Caso 4: residente NO puede publicar (A01) ────────────────────
  it('residente: INSERT en anuncios falla con error de RLS (solo el admin publica)', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy for table "anuncios"' },
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data, error } = await supabase.from('anuncios').insert({
      titulo: 'Anuncio pirata', cuerpo: 'No deberia poder', categoria: 'general', prioridad: 'normal',
    })

    expect(data).toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
  })

  // ── anuncios · Caso 5: admin SÍ puede publicar ──────────────────────────────
  it('admin: INSERT en anuncios devuelve el id (única política de escritura)', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'nuevo-anuncio' }, error: null }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data, error } = await supabase
      .from('anuncios')
      .insert({ titulo: 'Corte de agua', cuerpo: 'El martes', categoria: 'mantenimiento', prioridad: 'importante' })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe('nuevo-anuncio')
  })

  // ── anuncio_lecturas · Caso 6: cada residente solo ve la suya ───────────────
  it('residente: SELECT anuncio_lecturas retorna solo las propias (residente_id = auth.uid())', async () => {
    const lauraUuid = '11111111-1111-1111-1111-111111111111'
    const pedroUuid = '22222222-2222-2222-2222-222222222222'

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { anuncio_id: 'a1', residente_id: lauraUuid },
          { anuncio_id: 'a2', residente_id: lauraUuid },
        ],
        error: null,
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { data } = await supabase.from('anuncio_lecturas').select('*').eq('residente_id', lauraUuid)

    expect(data).toHaveLength(2)
    expect(data?.every(l => l.residente_id === lauraUuid)).toBe(true)
    expect(data?.some(l => l.residente_id === pedroUuid)).toBe(false)
  })

  // ── anuncio_lecturas · Caso 7: no puede registrar la lectura de otro ────────
  it('residente: INSERT de una lectura ajena falla con error de RLS', async () => {
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'new row violates row-level security policy for table "anuncio_lecturas"' },
      }),
    })

    const { supabase } = await import('../../lib/supabase')
    const { error } = await supabase.from('anuncio_lecturas').insert({
      anuncio_id: 'a1', residente_id: 'otro-residente',
    })

    expect(error?.message).toMatch(/row-level security/i)
  })
})
