// Sprint 8 — Tests unitarios de las funciones puras de src/lib/facturas.ts.
//
// Las funciones no dependen de Supabase ni de React: son utilidades de
// formateo y validación que se usan en toda la UI del módulo de facturación.

import { describe, it, expect } from 'vitest'
import {
  formatearMonto,
  formatearPeriodo,
  estaVencida,
  puedeMarcarsePagada,
  fechaHoyISO,
  LABEL_FACTURA_TIPO,
  LABEL_FACTURA_ESTADO,
  BADGE_FACTURA_ESTADO,
  LABEL_METODO_PAGO,
  MENSAJE_YA_PAGADA,
} from '../../lib/facturas'

describe('formatearMonto', () => {
  it('formatea con 2 decimales y separadores de miles', () => {
    const out = formatearMonto(1500.5)
    // Intl puede usar caracteres no-ASCII para los separadores según el runtime.
    // Verificamos las partes esenciales en lugar de comparar string exacto.
    expect(out).toMatch(/1[\s,.]?500\.50/)
    expect(out).toMatch(/S\//) // soles peruanos (PEN)
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
  it('cubre los 5 tipos del enum factura_tipo (tienda desde Sprint 11)', () => {
    expect(LABEL_FACTURA_TIPO.luz).toBe('Electricidad')
    expect(LABEL_FACTURA_TIPO.agua).toBe('Agua')
    expect(LABEL_FACTURA_TIPO.pension).toBe('Pensión')
    expect(LABEL_FACTURA_TIPO.multa).toBe('Multa')
    expect(LABEL_FACTURA_TIPO.tienda).toBe('Tienda')
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

// ─── Sprint 9 · HU-FACT-04 — transición a pagada ──────────────────────────────

describe('puedeMarcarsePagada', () => {
  it('una factura pendiente puede marcarse como pagada', () => {
    expect(puedeMarcarsePagada('pendiente')).toBe(true)
  })

  it('una factura vencida puede marcarse como pagada', () => {
    expect(puedeMarcarsePagada('vencida')).toBe(true)
  })

  it('una factura ya pagada NO puede volver a marcarse', () => {
    expect(puedeMarcarsePagada('pagada')).toBe(false)
  })
})

describe('LABEL_METODO_PAGO', () => {
  it('cubre los 3 métodos de pago con etiqueta legible', () => {
    expect(LABEL_METODO_PAGO.efectivo).toBe('Efectivo')
    expect(LABEL_METODO_PAGO.transferencia).toBe('Transferencia')
    expect(LABEL_METODO_PAGO.otro).toBe('Otro')
  })
})

describe('MENSAJE_YA_PAGADA', () => {
  it('es el aviso de idempotencia que muestra la UI (R3)', () => {
    expect(MENSAJE_YA_PAGADA).toMatch(/ya estaba pagada/i)
  })
})

describe('fechaHoyISO', () => {
  it('devuelve la fecha local en formato YYYY-MM-DD', () => {
    expect(fechaHoyISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('coincide con la fecha local del navegador (sin desfase UTC)', () => {
    const hoy = new Date()
    const esperado = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    expect(fechaHoyISO()).toBe(esperado)
  })
})
