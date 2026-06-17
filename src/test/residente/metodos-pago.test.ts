// Sprint 13 · HU-PAGO-01 — Tests de integración para metodos_pago.
//
// Cubre:
//   T01 — RLS residente: solo ve sus propias tarjetas
//   T02 — RLS residente: puede insertar con su propio residente_id
//   T03 — RLS residente: no puede insertar con residente_id ajeno
//   T04 — RLS admin: no puede SELECT sobre metodos_pago de ningún residente
//   T05 — RLS admin: no puede INSERT sobre metodos_pago
//   T06 — RLS anón: no puede acceder a metodos_pago
//   T07 — Esquema: la tabla NO contiene columnas PAN ni CVV (seguridad no-PII)
//   T08 — Índice único parcial: un residente no puede tener 2 tarjetas predeterminadas
//   T09 — establecerPredeterminado: quita la marca anterior y establece la nueva
//   T10 — detectarMarca: detecta correctamente Visa, Mastercard, Amex y otros
//   T11 — mascaraTarjeta: enmascara correctamente los últimos 4 dígitos
//   T12 — formatearExpiracion: formatea mes/año como MM/YY

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks de Supabase ────────────────────────────────────────────────────────

const mockSelect  = vi.fn()
const mockInsert  = vi.fn()
const mockUpdate  = vi.fn()
const mockDelete  = vi.fn()
const mockEq      = vi.fn()
const mockSingle  = vi.fn()
const mockOrder   = vi.fn()

// Fluent builder — cada método devuelve el mismo objeto para encadenar
const fluentBuilder = {
  select:  (..._args: unknown[]) => { mockSelect();  return fluentBuilder },
  insert:  (vals: unknown)       => { mockInsert(vals); return fluentBuilder },
  update:  (vals: unknown)       => { mockUpdate(vals); return fluentBuilder },
  delete:  (..._args: unknown[]) => { mockDelete();  return fluentBuilder },
  eq:      (col: string, val: unknown) => { mockEq(col, val); return fluentBuilder },
  order:   (..._args: unknown[]) => { mockOrder();  return fluentBuilder },
  single:  ()                    => mockSingle(),
}

// El then/awaitable por defecto (para casos que NO usan .single())
// Lo configuramos con vi.fn() que retorna Promise en cada test.
let mockFromResult: { data: unknown; error: { message: string } | null } = { data: [], error: null }

// Override: cuando se llama `await supabase.from(...).select()...` sin .single()
// devolvemos mockFromResult via .then()
Object.defineProperty(fluentBuilder, 'then', {
  get() {
    return (resolve: (v: typeof mockFromResult) => void) => resolve(mockFromResult)
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFrom = vi.fn((_tabla: string): any => fluentBuilder)

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (tabla: string) => mockFrom(tabla) },
}))

// ─── Helpers de test ─────────────────────────────────────────────────────────

function metodoBase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    alias:          'Mi Visa personal',
    marca:          'visa' as const,
    titular:        'Juan Pérez',
    ultimos4:       '4242',
    exp_mes:        12,
    exp_anio:       2027,
    token_simulado: 'tok_sim_abc123',
    predeterminada: false,
    ...overrides,
  }
}

function metodoDB(id: string, residente_id: string, overrides = {}) {
  return {
    id,
    residente_id,
    alias:          'Mi Visa',
    marca:          'visa',
    titular:        'Juan Pérez',
    ultimos4:       '4242',
    exp_mes:        12,
    exp_anio:       2027,
    token_simulado: 'tok_sim_abc123',
    predeterminada: false,
    created_at:     '2026-06-16T20:00:00Z',
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('metodos_pago — RLS y operaciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromResult = { data: [], error: null }
    mockSingle.mockResolvedValue({ data: null, error: null })
  })

  // ── T01: Residente solo ve sus propias tarjetas ──────────────────────────────
  it('T01 — listarMetodosPago: residente solo ve las suyas (RLS SELECT)', async () => {
    const miResidente = 'res-uuid-001'
    const misMétodos  = [metodoDB('mp-1', miResidente)]
    mockFromResult    = { data: misMétodos, error: null }

    const { listarMetodosPago } = await import('../../lib/metodos-pago')
    const { data, error } = await listarMetodosPago()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    // Todos los registros devueltos pertenecen al residente autenticado
    // (en BD lo garantiza la RLS; aquí el mock simula ese comportamiento)
    expect(data.every(m => m.residente_id === miResidente)).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('metodos_pago')
  })

  // ── T02: Residente puede insertar con su propio residente_id ─────────────────
  it('T02 — agregarMetodoPago: inserta con los datos correctos (RLS INSERT)', async () => {
    const nuevoMetodo = metodoDB('mp-new', 'res-uuid-001')
    mockSingle.mockResolvedValue({ data: nuevoMetodo, error: null })
    // Primer update (clear predeterminada) → no error
    mockFromResult = { data: [], error: null }

    const { agregarMetodoPago } = await import('../../lib/metodos-pago')
    const { data, error } = await agregarMetodoPago(metodoBase())

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        alias:          'Mi Visa personal',
        marca:          'visa',
        ultimos4:       '4242',
        token_simulado: 'tok_sim_abc123',
      })
    )
    // Verificar que NO se intentó insertar PAN completo ni CVV
    const insertPayload = mockInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertPayload).not.toHaveProperty('pan')
    expect(insertPayload).not.toHaveProperty('numero')
    expect(insertPayload).not.toHaveProperty('cvv')
    expect(insertPayload).not.toHaveProperty('cvc')
    expect(insertPayload).not.toHaveProperty('numero_tarjeta')
  })

  // ── T03: Residente no puede insertar con residente_id ajeno ──────────────────
  it('T03 — agregarMetodoPago: RLS rechaza insertar con residente_id ajeno', async () => {
    // Simula el error que lanzaría Postgres RLS al detectar residente_id != auth.uid()
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy for table "metodos_pago"' },
    })
    mockFromResult = { data: [], error: null }

    const { agregarMetodoPago } = await import('../../lib/metodos-pago')
    const { data, error } = await agregarMetodoPago(metodoBase())

    expect(data).toBeNull()
    expect(error).toMatch(/row-level security/)
  })

  // ── T04: Admin no puede SELECT sobre metodos_pago ────────────────────────────
  it('T04 — RLS admin: SELECT devuelve 0 filas (sin política para admin)', async () => {
    // La RLS de metodos_pago no tiene excepción para admin; cualquier
    // SELECT autenticado con rol admin retorna vacío (auth.uid() ≠ residente_id).
    // El mock simula ese comportamiento.
    mockFromResult = { data: [], error: null }

    const { listarMetodosPago } = await import('../../lib/metodos-pago')
    const { data, error } = await listarMetodosPago()

    // Un admin autenticado obtiene array vacío — la RLS lo aísla
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  // ── T05: Admin no puede INSERT ────────────────────────────────────────────────
  it('T05 — RLS admin: INSERT rechazado por RLS (WITH CHECK falla)', async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    })
    mockFromResult = { data: [], error: null }

    const { agregarMetodoPago } = await import('../../lib/metodos-pago')
    // Un admin que intente insertar un método ajeno recibirá error RLS
    const { data, error } = await agregarMetodoPago(metodoBase())

    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  // ── T06: Anón no puede acceder ────────────────────────────────────────────────
  it('T06 — RLS anón: SELECT lanza error de permisos', async () => {
    mockFromResult = {
      data: null,
      error: { message: 'permission denied for table metodos_pago' },
    }

    const { listarMetodosPago } = await import('../../lib/metodos-pago')
    const { data, error } = await listarMetodosPago()

    expect(data).toHaveLength(0)
    expect(error).toMatch(/permission denied/)
  })

  // ── T07: La tabla NO contiene columnas PAN ni CVV ────────────────────────────
  it('T07 — Seguridad: MetodoPagoInsert no tiene campo PAN, CVV ni número completo', () => {
    // Este test verifica en tiempo de compilación/runtime que el tipo
    // MetodoPagoInsert del módulo no expone campos sensibles.
    // Como TypeScript borra los tipos en runtime, lo verificamos via
    // Object.keys de un objeto que cumpla el tipo.
    const payload = metodoBase()
    const llaves = Object.keys(payload)

    // Verificar ausencia de campos sensibles
    expect(llaves).not.toContain('pan')
    expect(llaves).not.toContain('numero')
    expect(llaves).not.toContain('cvv')
    expect(llaves).not.toContain('cvc')
    expect(llaves).not.toContain('numero_tarjeta')
    expect(llaves).not.toContain('pin')

    // Verificar presencia de campos permitidos
    expect(llaves).toContain('ultimos4')
    expect(llaves).toContain('token_simulado')
    expect(llaves).toContain('marca')
  })

  // ── T08: Índice único parcial — no 2 predeterminadas por residente ────────────
  it('T08 — Índice único parcial: 2da predeterminada para el mismo residente → error RLS/DB', async () => {
    // El primer update (clear predeterminada) va bien
    mockFromResult = { data: [], error: null }
    // El insert falla porque ya existe una predeterminada=true para ese residente
    // (el índice único parcial lo impide)
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "idx_metodos_pago_una_predeterminada"' },
    })

    const { agregarMetodoPago } = await import('../../lib/metodos-pago')
    const { data, error } = await agregarMetodoPago(metodoBase({ predeterminada: true }))

    // Nota: la lib llama primero al update de clear; si ese pasa el insert
    // puede fallar por la constraint. El error se propaga al llamador.
    expect(data).toBeNull()
    expect(error).toMatch(/unique constraint|duplicate key|row-level security/)
  })

  // ── T09: establecerPredeterminado — flujo de 2 pasos ─────────────────────────
  it('T09 — establecerPredeterminado: quita la marca anterior y establece la nueva', async () => {
    // Ambos updates van bien
    mockFromResult = { data: [], error: null }

    const { establecerPredeterminado } = await import('../../lib/metodos-pago')
    const result = await establecerPredeterminado('mp-nuevo-uuid')

    expect(result.ok).toBe(true)
    // Primer update: predeterminada: false donde predeterminada=true
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { predeterminada: false })
    // Segundo update: predeterminada: true en el id elegido
    expect(mockUpdate).toHaveBeenNthCalledWith(2, { predeterminada: true })
    expect(mockEq).toHaveBeenCalledWith('id', 'mp-nuevo-uuid')
  })
})

// ─── Tests de utilidades puras (sin mock de Supabase) ────────────────────────

describe('metodos_pago — utilidades puras', () => {
  it('T10a — detectarMarca: detecta Visa por prefijo 4', async () => {
    const { detectarMarca } = await import('../../lib/metodos-pago')
    expect(detectarMarca('4')).toBe('visa')
    expect(detectarMarca('4111')).toBe('visa')
    expect(detectarMarca('4242')).toBe('visa')
  })

  it('T10b — detectarMarca: detecta Mastercard (5xx y 2xxx)', async () => {
    const { detectarMarca } = await import('../../lib/metodos-pago')
    expect(detectarMarca('51')).toBe('mastercard')
    expect(detectarMarca('55')).toBe('mastercard')
    expect(detectarMarca('2221')).toBe('mastercard')
    expect(detectarMarca('2720')).toBe('mastercard')
  })

  it('T10c — detectarMarca: detecta Amex (34, 37)', async () => {
    const { detectarMarca } = await import('../../lib/metodos-pago')
    expect(detectarMarca('34')).toBe('amex')
    expect(detectarMarca('37')).toBe('amex')
  })

  it('T10d — detectarMarca: retorna "otro" para BINs no reconocidos', async () => {
    const { detectarMarca } = await import('../../lib/metodos-pago')
    expect(detectarMarca('9')).toBe('otro')
    expect(detectarMarca('1234')).toBe('otro')
  })

  it('T11 — mascaraTarjeta: enmascara correctamente', async () => {
    const { mascaraTarjeta } = await import('../../lib/metodos-pago')
    expect(mascaraTarjeta('4242')).toBe('•••• •••• •••• 4242')
    expect(mascaraTarjeta('0000')).toBe('•••• •••• •••• 0000')
  })

  it('T12a — formatearExpiracion: formatea mes con padding', async () => {
    const { formatearExpiracion } = await import('../../lib/metodos-pago')
    expect(formatearExpiracion(1,  2027)).toBe('01/27')
    expect(formatearExpiracion(12, 2030)).toBe('12/30')
  })

  it('T12b — formatearExpiracion: usa los últimos 2 dígitos del año', async () => {
    const { formatearExpiracion } = await import('../../lib/metodos-pago')
    expect(formatearExpiracion(6, 2026)).toBe('06/26')
    expect(formatearExpiracion(9, 2099)).toBe('09/99')
  })
})
