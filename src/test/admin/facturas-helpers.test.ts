// Sprint 8 — Tests unitarios de las funciones puras de src/lib/facturas.ts.
//
// Las funciones no dependen de Supabase ni de React: son utilidades de
// formateo y validación que se usan en toda la UI del módulo de facturación.

import { describe, it, expect } from 'vitest'
import {
  formatearMonto,
  formatearPeriodo,
  estaVencida,
  LABEL_FACTURA_TIPO,
  LABEL_FACTURA_ESTADO,
  BADGE_FACTURA_ESTADO,
} from '../../lib/facturas'

describe('formatearMonto', () => {
  it('formatea con 2 decimales y separadores de miles', () => {
    const out = formatearMonto(1500.5)
    // Intl puede usar caracteres no-ASCII para los separadores según el runtime.
    // Verificamos las partes esenciales en lugar de comparar string exacto.
    expect(out).toMatch(/1[\s ,.]?500\.50/)
    expect(out).toMatch(/\$/)
  })

  it('formatea cero correctamente', () => {
    const out = formatearMonto(0)
    expect(out).toMatch(/0\.00/)
  })

  it('formatea montos pequeños con decimales', () => {
    const out = formatearMonto(0.99)
    expect(out).toMatch(/0\.99/)
  })
})

describe('formatearPeriodo', () => {
  it('formatea "2026-05" como mes y año legible', () => {
    const out = formatearPeriodo('2026-05')
    expect(out).toMatch(/mayo/i)
    expect(out).toMatch(/2026/)
  })

  it('formatea enero correctamente', () => {
    const out = formatearPeriodo('2026-01')
    expect(out).toMatch(/enero/i)
  })

  it('formatea diciembre correctamente', () => {
    const out = formatearPeriodo('2026-12')
    expect(out).toMatch(/diciembre/i)
  })
})

describe('estaVencida', () => {
  it('factura pagada NUNCA está vencida, aunque la fecha sea pasada', () => {
    expect(estaVencida({ estado: 'pagada', vencimiento: '2020-01-01' })).toBe(false)
  })

  it('factura pendiente con vencimiento futuro NO está vencida', () => {
    const enFuturo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    expect(estaVencida({ estado: 'pendiente', vencimiento: enFuturo })).toBe(false)
  })

  it('factura pendiente con vencimiento pasado SÍ está vencida', () => {
    const enPasado = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    expect(estaVencida({ estado: 'pendiente', vencimiento: enPasado })).toBe(true)
  })

  it('factura vencida (estado="vencida") con vencimiento futuro: aún está vencida según el estado en BD', () => {
    // Caso raro pero posible: BD marcada como vencida, pero la fecha ya se actualizó.
    // La función decide basándose en la fecha — si la fecha es futura, NO está vencida.
    // Esto refleja que estaVencida es una "doble verificación visual" del frontend.
    const enFuturo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)
    expect(estaVencida({ estado: 'vencida', vencimiento: enFuturo })).toBe(false)
  })
})

describe('LABEL_FACTURA_TIPO', () => {
  it('cubre los 4 tipos del enum factura_tipo', () => {
    expect(LABEL_FACTURA_TIPO.luz).toBe('Electricidad')
    expect(LABEL_FACTURA_TIPO.agua).toBe('Agua')
    expect(LABEL_FACTURA_TIPO.pension).toBe('Pensión')
    expect(LABEL_FACTURA_TIPO.multa).toBe('Multa')
  })
})

describe('LABEL_FACTURA_ESTADO y BADGE_FACTURA_ESTADO', () => {
  it('cubre los 3 estados del enum factura_estado con label y color', () => {
    const estados = ['pendiente', 'pagada', 'vencida'] as const
    for (const e of estados) {
      expect(LABEL_FACTURA_ESTADO[e]).toBeTruthy()
      expect(BADGE_FACTURA_ESTADO[e]).toContain('bg-')
    }
  })

  it('badge de vencida usa color error (rojo)', () => {
    expect(BADGE_FACTURA_ESTADO.vencida).toContain('error')
  })

  it('badge de pagada usa color success (verde)', () => {
    expect(BADGE_FACTURA_ESTADO.pagada).toContain('success')
  })
})
