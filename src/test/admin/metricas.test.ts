// Sprint 7 · PBI-22 — Tests unitarios de las fórmulas de métricas.
//
// Criterio de aceptación: 4 casos de borde
//   1. vacío (n=0)    → avg=null, mediana=null, p95=null
//   2. n=1            → avg=val, mediana=val, p95=null (insuf. para P95)
//   3. n=2            → p95 calculable (los dos puntos extremos)
//   4. outliers       → mediana estable, avg distorsionado
//
// Además cubrimos: interpolación de percentil, formatearHoras, edge cases de calcularP95.

import { describe, it, expect } from 'vitest'
import {
  calcularAvg,
  calcularMediana,
  calcularP95,
  calcularEstadisticosHoras,
  formatearHoras,
  P95_MIN_MUESTRAS,
} from '../../lib/metricas'

// ─── calcularAvg ─────────────────────────────────────────────────────────────
describe('calcularAvg', () => {
  it('caso borde vacío (n=0) → null', () => {
    expect(calcularAvg([])).toBeNull()
  })

  it('caso borde n=1 → devuelve el único valor', () => {
    expect(calcularAvg([8])).toBe(8)
  })

  it('caso borde n=2 → promedio exacto', () => {
    expect(calcularAvg([4, 8])).toBe(6)
  })

  it('outliers distorsionan el AVG', () => {
    // 10 solicitudes rápidas (1 h) + 1 outlier (200 h)
    const horas = [...Array(10).fill(1), 200]
    const avg = calcularAvg(horas)!
    expect(avg).toBeGreaterThan(10) // distorsionado por outlier
  })

  it('set normal', () => {
    expect(calcularAvg([2, 4, 6])).toBeCloseTo(4)
  })
})

// ─── calcularMediana ──────────────────────────────────────────────────────────
describe('calcularMediana', () => {
  it('caso borde vacío (n=0) → null', () => {
    expect(calcularMediana([])).toBeNull()
  })

  it('caso borde n=1 → devuelve el único valor', () => {
    expect(calcularMediana([5])).toBe(5)
  })

  it('n=2 → promedio de los dos valores', () => {
    expect(calcularMediana([3, 7])).toBe(5)
  })

  it('n impar → valor central', () => {
    expect(calcularMediana([1, 3, 100])).toBe(3) // no afectado por outlier 100
  })

  it('n par → promedio de los dos centrales', () => {
    expect(calcularMediana([1, 2, 4, 100])).toBe(3) // (2+4)/2
  })

  it('caso borde outliers: mediana estable vs avg distorsionado', () => {
    // 9 solicitudes de 2 h + 1 outlier de 500 h
    const horas = [...Array(9).fill(2), 500]
    const mediana = calcularMediana(horas)!
    const avg = calcularAvg(horas)!

    // Mediana ≈ 2 h (no afectada), AVG >> 2 h
    expect(mediana).toBe(2)
    expect(avg).toBeGreaterThan(40)
  })

  it('ordena correctamente valores no ordenados', () => {
    expect(calcularMediana([10, 1, 5, 3, 8])).toBe(5)
  })
})

// ─── calcularP95 ─────────────────────────────────────────────────────────────
describe('calcularP95', () => {
  it('caso borde vacío (n=0) → null', () => {
    expect(calcularP95([])).toBeNull()
  })

  it('caso borde n=1 → null (insuficiente para P95)', () => {
    expect(calcularP95([42])).toBeNull()
    expect(P95_MIN_MUESTRAS).toBe(2) // documentar la constante
  })

  it('caso borde n=2 → P95 calculable (interpolación entre los dos puntos)', () => {
    const resultado = calcularP95([1, 100])
    // idx = 0.95 * 1 = 0.95 → 1 + 0.95*(100-1) = 1 + 94.05 = 95.05
    expect(resultado).toBeCloseTo(95.05)
  })

  it('set grande → P95 mayor que mediana', () => {
    // 20 solicitudes entre 1-5 h + 1 en 50 h
    const horas = [...Array(20).fill(0).map((_, i) => 1 + (i % 5)), 50]
    const p95 = calcularP95(horas)!
    const mediana = calcularMediana(horas)!

    expect(p95).toBeGreaterThan(mediana)
  })

  it('todos los valores iguales → P95 = ese valor', () => {
    const resultado = calcularP95([10, 10, 10, 10, 10])
    expect(resultado).toBe(10)
  })

  it('outlier extremo eleva P95', () => {
    const sinOutlier = calcularP95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])!
    const conOutlier = calcularP95([1, 2, 3, 4, 5, 6, 7, 8, 9, 1000])!

    expect(conOutlier).toBeGreaterThan(sinOutlier)
  })
})

// ─── calcularEstadisticosHoras (integración de los tres) ─────────────────────
describe('calcularEstadisticosHoras', () => {
  it('caso borde vacío → todos null', () => {
    const resultado = calcularEstadisticosHoras([])
    expect(resultado.avg_horas).toBeNull()
    expect(resultado.mediana_horas).toBeNull()
    expect(resultado.p95_horas).toBeNull()
  })

  it('caso borde n=1 → avg y mediana tienen valor, p95 null', () => {
    const resultado = calcularEstadisticosHoras([24])
    expect(resultado.avg_horas).toBe(24)
    expect(resultado.mediana_horas).toBe(24)
    expect(resultado.p95_horas).toBeNull()
  })

  it('caso borde n=2 → los tres estadísticos calculados', () => {
    const resultado = calcularEstadisticosHoras([2, 8])
    expect(resultado.avg_horas).toBe(5)
    expect(resultado.mediana_horas).toBe(5)
    expect(resultado.p95_horas).not.toBeNull()
  })

  it('caso borde outliers → mediana ≠ avg, p95 alto', () => {
    const horas = [...Array(9).fill(2), 500]
    const resultado = calcularEstadisticosHoras(horas)

    expect(resultado.mediana_horas).toBe(2)
    expect(resultado.avg_horas!).toBeGreaterThan(40)
    expect(resultado.p95_horas!).toBeGreaterThan(resultado.mediana_horas!)
  })
})

// ─── formatearHoras ───────────────────────────────────────────────────────────
describe('formatearHoras', () => {
  it('null → "Sin datos suficientes"', () => {
    expect(formatearHoras(null)).toBe('Sin datos suficientes')
  })

  it('< 1 h → muestra minutos', () => {
    expect(formatearHoras(0.5)).toBe('30 min')
  })

  it('< 24 h → muestra horas con un decimal', () => {
    expect(formatearHoras(2.5)).toBe('2.5 h')
  })

  it('>= 24 h → muestra días con un decimal', () => {
    expect(formatearHoras(48)).toBe('2.0 d')
  })

  it('fracción muy pequeña → "< 1 min"', () => {
    expect(formatearHoras(0.001)).toBe('< 1 min')
  })

  it('exactamente 1 h', () => {
    expect(formatearHoras(1)).toBe('1.0 h')
  })

  it('exactamente 24 h → "1.0 d"', () => {
    expect(formatearHoras(24)).toBe('1.0 d')
  })
})
