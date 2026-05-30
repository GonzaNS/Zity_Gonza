// Sprint 9 · PBI-S8-E01 — Tests del comprobante PDF de factura pagada.
//
// construirComprobante() es la lógica pura (datos del comprobante); se prueba
// sin generar el binario. generarComprobantePDF() valida que se produce un PDF.

import { describe, it, expect } from 'vitest'
import { construirComprobante, generarComprobantePDF } from '../../lib/comprobante'
import type { Factura } from '../../lib/facturas'

const facturaPagada: Factura = {
  id: 'f1',
  residente_id: 'r1',
  tipo: 'luz',
  monto: 120,
  periodo: '2026-05',
  fecha_emision: '2026-05-01',
  vencimiento: '2026-05-31',
  estado: 'pagada',
  descripcion: null,
  numero: 'F-2026-05-001',
  fecha_pago: '2026-05-15',
  metodo_pago: 'transferencia',
  registrado_por: 'admin-1',
  recordatorio_enviado: false,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: '2026-05-15T00:00:00Z',
}

const residente = { nombre: 'Laura', apellido: 'Vega', departamento: 'B' }

describe('construirComprobante', () => {
  it('el número del comprobante coincide con el numero persistido de la factura (no se recalcula)', () => {
    const c = construirComprobante(facturaPagada, residente)
    expect(c.numero).toBe('F-2026-05-001')
  })

  it('incluye el método de pago en formato legible', () => {
    expect(construirComprobante(facturaPagada, residente).metodoLabel).toBe('Transferencia')
  })

  it('incluye el nombre completo del residente', () => {
    expect(construirComprobante(facturaPagada, residente).residente).toBe('Laura Vega')
  })

  it('lleva el sello PAGADO', () => {
    expect(construirComprobante(facturaPagada, residente).sello).toBe('PAGADO')
  })

  it('lanza si la factura NO está pagada (R4: solo facturas pagadas)', () => {
    expect(() => construirComprobante({ ...facturaPagada, estado: 'pendiente' }, residente)).toThrow()
    expect(() => construirComprobante({ ...facturaPagada, estado: 'vencida' }, residente)).toThrow()
  })
})

describe('generarComprobantePDF', () => {
  it('genera un PDF (bytes con cabecera %PDF) para una factura pagada', async () => {
    const bytes = await generarComprobantePDF(facturaPagada, residente)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF')
  })

  it('lanza si la factura NO está pagada', async () => {
    await expect(
      generarComprobantePDF({ ...facturaPagada, estado: 'vencida' }, residente),
    ).rejects.toThrow()
  })
})
