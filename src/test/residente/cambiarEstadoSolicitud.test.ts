// HU-MANT-02/04/07 SPRINT-4
// Tests del helper centralizado cambiarEstadoSolicitud().
// Garantiza que toda transición de estado escribe en las 3 tablas
// (solicitudes, historial_estados, audit_log) con los campos correctos y
// que los errores se propagan en el orden esperado.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cambiarEstadoSolicitud } from '../../lib/solicitudes'

// ─── Mock de Supabase ───────────────────────────────────────────────────────
// El helper sólo usa la fluent API `from(...).update/insert(...).eq(...)`.
// Construimos un mock que captura los argumentos por tabla y devuelve el
// error configurado por el test.

type MockResult = { error: { message: string } | null }
type TablaTrazada = 'solicitudes' | 'historial_estados' | 'audit_log' | 'notificaciones'

type EstadoTabla = {
  updateArgs?: Record<string, unknown>
  updateFilter?: { col: string; val: string }
  insertArgs?: Record<string, unknown>
  result: MockResult
}

const mockState: Record<TablaTrazada, EstadoTabla> = {
  solicitudes: { result: { error: null } },
  historial_estados: { result: { error: null } },
  audit_log: { result: { error: null } },
  notificaciones: { result: { error: null } },
}

function resetMockState() {
  ;(Object.keys(mockState) as TablaTrazada[]).forEach(tabla => {
    mockState[tabla] = { result: { error: null } }
  })
}

const mockFrom = vi.fn((tabla: TablaTrazada) => {
  const estado = mockState[tabla]
  return {
    select() {
      return {
        eq() {
          return {
            single() {
              return Promise.resolve({
                data: { residente_id: 'residente-123', codigo: 'SOL-123' },
                error: null,
              })
            },
          }
        },
      }
    },
    update(values: Record<string, unknown>) {
      estado.updateArgs = values
      return {
        eq(col: string, val: string) {
          estado.updateFilter = { col, val }
          return Promise.resolve(estado.result)
        },
      }
    },
    insert(values: Record<string, unknown>) {
      estado.insertArgs = values
      return Promise.resolve(estado.result)
    },
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: (tabla: string) => mockFrom(tabla as TablaTrazada) },
}))

const INPUT_BASE = {
  solicitudId: 'sol-uuid-001',
  estadoAnterior: 'pendiente' as const,
  estadoNuevo: 'asignada' as const,
  nota: 'Nota de prueba',
  usuarioId: 'usr-uuid-admin',
  accionAudit: 'asignar_solicitud' as const,
}

describe('cambiarEstadoSolicitud', () => {
  beforeEach(() => {
    resetMockState()
    mockFrom.mockClear()
  })

  it('escribe en las 3 tablas en el orden esperado y devuelve ok=true', async () => {
    const resultado = await cambiarEstadoSolicitud(INPUT_BASE)

    expect(resultado).toEqual({ ok: true })

    // 1. UPDATE solicitudes
    expect(mockState.solicitudes.updateArgs).toEqual({ estado: 'asignada' })
    expect(mockState.solicitudes.updateFilter).toEqual({ col: 'id', val: 'sol-uuid-001' })

    // 2. INSERT historial_estados
    expect(mockState.historial_estados.insertArgs).toMatchObject({
      solicitud_id: 'sol-uuid-001',
      estado_anterior: 'pendiente',
      estado_nuevo: 'asignada',
      cambiado_por: 'usr-uuid-admin',
      nota: 'Nota de prueba',
    })

    // 3. INSERT audit_log
    expect(mockState.audit_log.insertArgs).toMatchObject({
      usuario_id: 'usr-uuid-admin',
      accion: 'asignar_solicitud',
      entidad: 'solicitudes',
      entidad_id: 'sol-uuid-001',
      resultado: 'exitoso',
    })
  })

  it('aplica camposExtraSolicitud al UPDATE (HU-MANT-07)', async () => {
    await cambiarEstadoSolicitud({
      ...INPUT_BASE,
      estadoAnterior: 'resuelta',
      estadoNuevo: 'cerrada',
      camposExtraSolicitud: { confirmada_por_residente: true },
    })

    expect(mockState.solicitudes.updateArgs).toEqual({
      estado: 'cerrada',
      confirmada_por_residente: true,
    })
  })

  it('mezcla detallesAudit con estado_anterior/estado_nuevo en audit_log.detalles', async () => {
    await cambiarEstadoSolicitud({
      ...INPUT_BASE,
      estadoAnterior: 'resuelta',
      estadoNuevo: 'pendiente',
      accionAudit: 'escalada_solicitud',
      detallesAudit: { intentos: 3, escalada: true },
    })

    expect(mockState.audit_log.insertArgs?.detalles).toEqual({
      estado_anterior: 'resuelta',
      estado_nuevo: 'pendiente',
      intentos: 3,
      escalada: true,
    })
  })

  it('normaliza nota vacía o solo espacios a null', async () => {
    await cambiarEstadoSolicitud({ ...INPUT_BASE, nota: '   ' })

    expect(mockState.historial_estados.insertArgs?.nota).toBeNull()
  })

  it('preserva nota con espacios internos pero recorta extremos', async () => {
    await cambiarEstadoSolicitud({ ...INPUT_BASE, nota: '  texto con   espacios  ' })

    expect(mockState.historial_estados.insertArgs?.nota).toBe('texto con   espacios')
  })

  it('aborta si UPDATE solicitudes falla y NO escribe historial ni audit_log', async () => {
    mockState.solicitudes.result = { error: { message: 'RLS: rol no permitido' } }

    const resultado = await cambiarEstadoSolicitud(INPUT_BASE)

    expect(resultado).toEqual({ ok: false, error: 'RLS: rol no permitido' })
    expect(mockState.historial_estados.insertArgs).toBeUndefined()
    expect(mockState.audit_log.insertArgs).toBeUndefined()
  })

  it('devuelve error explícito si INSERT historial falla pero NO revierte el UPDATE', async () => {
    mockState.historial_estados.result = { error: { message: 'columna inexistente' } }

    const resultado = await cambiarEstadoSolicitud(INPUT_BASE)

    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.error).toContain('historial')
      expect(resultado.error).toContain('columna inexistente')
    }
    // El UPDATE ya se ejecutó (no revertimos)
    expect(mockState.solicitudes.updateArgs).toEqual({ estado: 'asignada' })
  })

  it('ignora silenciosamente fallos en INSERT audit_log (fire-and-forget)', async () => {
    mockState.audit_log.result = { error: { message: 'audit policy' } }

    const resultado = await cambiarEstadoSolicitud(INPUT_BASE)

    expect(resultado).toEqual({ ok: true })
    // historial sí debió escribirse antes del audit fallido
    expect(mockState.historial_estados.insertArgs).toBeDefined()
  })
})
