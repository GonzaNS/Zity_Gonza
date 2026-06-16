// Sprint 5 · PBI-14 · Tests del helper logAuditAction.
// Verifica que: (1) la inserción incluye usuario_id, accion, entidad, entidad_id,
// detalles y resultado; (2) el fallo se reporta pero no se propaga como excepción;
// (3) el catálogo de acciones está alineado.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAuditAction, ACCIONES_AUDIT, labelAccion } from '../../lib/audit'

type MockResult = { error: { message: string } | null }

const mockState: {
  insertArgs?: Record<string, unknown>
  result: MockResult
} = {
  result: { error: null },
}

function reset() {
  mockState.insertArgs = undefined
  mockState.result = { error: null }
}

const mockFrom = vi.fn(() => ({
  insert(values: Record<string, unknown>) {
    mockState.insertArgs = values
    return Promise.resolve(mockState.result)
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => mockFrom() },
}))

describe('logAuditAction', () => {
  beforeEach(() => {
    reset()
    mockFrom.mockClear()
    // Silenciar console.warn en tests de error
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('inserta el payload completo con resultado exitoso por defecto', async () => {
    const out = await logAuditAction(
      {
        accion: 'asignar_solicitud',
        entidad: 'solicitudes',
        entidadId: 'sol-uuid-001',
        detalles: { tecnico_id: 't-uuid', es_reasignacion: false },
      },
      'usr-uuid-admin',
    )

    expect(out).toEqual({ ok: true })
    expect(mockState.insertArgs).toEqual({
      usuario_id: 'usr-uuid-admin',
      accion: 'asignar_solicitud',
      entidad: 'solicitudes',
      entidad_id: 'sol-uuid-001',
      detalles: { tecnico_id: 't-uuid', es_reasignacion: false },
      resultado: 'exitoso',
    })
  })

  it('respeta el resultado fallido cuando se pasa explícitamente', async () => {
    await logAuditAction(
      {
        accion: 'rechazar_solucion',
        entidad: 'solicitudes',
        entidadId: 'sol-2',
        resultado: 'fallido',
      },
      'usr-residente',
    )

    expect(mockState.insertArgs?.resultado).toBe('fallido')
  })

  it('usa objeto vacío para detalles si el llamador no los provee', async () => {
    await logAuditAction(
      {
        accion: 'editar_perfil',
        entidad: 'usuarios',
        entidadId: 'usr-uuid',
      },
      'usr-uuid',
    )

    expect(mockState.insertArgs?.detalles).toEqual({})
  })

  it('si la inserción falla, devuelve { ok: false, error } sin lanzar', async () => {
    mockState.result = { error: { message: 'policy violation' } }

    const out = await logAuditAction(
      {
        accion: 'confirmar_solicitud',
        entidad: 'solicitudes',
        entidadId: 'sol-3',
      },
      'usr-residente',
    )

    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.error).toBe('policy violation')
  })

  it('expone catálogo de acciones con las 11 acciones del frontend', () => {
    // Sprint 5: 7 acciones originales
    // Sprint 13 · PBI-S6-E03: + cerrar_sesiones
    // Sprint 13 · HU-PAGO-02: + alta_metodo_pago, predeterminada_metodo_pago, eliminar_metodo_pago
    expect(ACCIONES_AUDIT).toHaveLength(11)
    expect(ACCIONES_AUDIT).toContain('asignar_solicitud')
    expect(ACCIONES_AUDIT).toContain('actualizar_estado_solicitud')
    expect(ACCIONES_AUDIT).toContain('confirmar_solicitud')
    expect(ACCIONES_AUDIT).toContain('rechazar_solucion')
    expect(ACCIONES_AUDIT).toContain('escalada_solicitud')
    expect(ACCIONES_AUDIT).toContain('editar_perfil')
    expect(ACCIONES_AUDIT).toContain('cambio_contrasena')
  })

  it('labelAccion devuelve etiquetas humanas para frontend y triggers/edge', () => {
    expect(labelAccion('asignar_solicitud')).toBe('Asignar solicitud')
    expect(labelAccion('confirmar_solicitud')).toBe('Confirmar solución')
    // Acciones generadas por triggers o Edge Functions (no por el helper)
    expect(labelAccion('crear_solicitud')).toBe('Crear solicitud')
    expect(labelAccion('bloquear_cuenta')).toBe('Bloquear cuenta')
    // Acción desconocida cae al valor crudo
    expect(labelAccion('accion_futura')).toBe('accion_futura')
  })
})
