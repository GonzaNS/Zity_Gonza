// Sprint 7 · PBI-22 — Utilidades puras para el panel de métricas de mantenimiento.
//
// Las fórmulas están aisladas de Supabase para poder ser testeadas unitariamente
// sin mocks de red. El hook useMetricasMantenimiento las usa para formatear los
// datos que llegan del RPC get_metricas_mantenimiento().
//
// Casos de borde documentados en los tests (src/test/admin/metricas.test.ts):
//   - vacío (n=0)  → null en los tres estadísticos
//   - n=1          → avg=val, mediana=val, p95=null
//   - n=2          → p95 calculable
//   - outliers     → mediana no se ve afectada; avg sí

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type TiemposResolucion = {
  avg_horas: number | null
  mediana_horas: number | null
  p95_horas: number | null
}

export type MetricasMantenimiento = {
  total_acumulado: number
  pendientes: number
  en_proceso: number
  resueltas_hoy: number
  tiempos_resolucion: TiemposResolucion
}

// ─── Constantes ─────────────────────────────────────────────────────────────

/** Mínimo de muestras para reportar P95. Con n < 2 se muestra 'Sin datos suficientes'. */
export const P95_MIN_MUESTRAS = 2

// ─── Fórmulas puras ─────────────────────────────────────────────────────────

/**
 * Calcula el promedio de un array de números.
 * Devuelve null si el array está vacío.
 */
export function calcularAvg(valores: number[]): number | null {
  if (valores.length === 0) return null
  const suma = valores.reduce((acc, v) => acc + v, 0)
  return suma / valores.length
}

/**
 * Calcula la mediana de un array de números (percentil 50).
 * La mediana es robusta a outliers — característica clave para tiempos de resolución.
 * Devuelve null si el array está vacío.
 */
export function calcularMediana(valores: number[]): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const mitad = Math.floor(ordenados.length / 2)
  if (ordenados.length % 2 === 0) {
    // Promedio de los dos valores centrales (interpolación lineal)
    return (ordenados[mitad - 1] + ordenados[mitad]) / 2
  }
  return ordenados[mitad]
}

/**
 * Calcula el percentil P95 usando interpolación lineal (método de Excel/numpy).
 * Requiere al menos P95_MIN_MUESTRAS (2) valores; devuelve null si hay menos.
 *
 * Fórmula:  idx = p * (n - 1)
 *            floor = floor(idx), ceil = ceil(idx)
 *            resultado = valores[floor] + (idx - floor) * (valores[ceil] - valores[floor])
 */
export function calcularP95(valores: number[]): number | null {
  if (valores.length < P95_MIN_MUESTRAS) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const n = ordenados.length
  const idx = 0.95 * (n - 1)
  const floorIdx = Math.floor(idx)
  const ceilIdx = Math.ceil(idx)
  if (floorIdx === ceilIdx) return ordenados[floorIdx]
  const fraccion = idx - floorIdx
  return ordenados[floorIdx] + fraccion * (ordenados[ceilIdx] - ordenados[floorIdx])
}

/**
 * Calcula los tres estadísticos (AVG, mediana, P95) a partir de un array de horas.
 * Esta función es la que usa el hook para calcular en el cliente si el RPC
 * no devuelve los valores desagregados (o para testear localmente).
 */
export function calcularEstadisticosHoras(horas: number[]): TiemposResolucion {
  return {
    avg_horas: calcularAvg(horas),
    mediana_horas: calcularMediana(horas),
    p95_horas: calcularP95(horas),
  }
}

// ─── Formateo para UI ────────────────────────────────────────────────────────

const SIN_DATOS = 'Sin datos suficientes'

/**
 * Formatea horas como texto legible para las tarjetas de métricas.
 * null → 'Sin datos suficientes'
 * < 1 h → 'X min'
 * < 24 h → 'X.X h'
 * >= 24 h → 'X.X d'
 */
export function formatearHoras(horas: number | null): string {
  if (horas === null) return SIN_DATOS
  if (horas < 1 / 60) return '< 1 min'
  if (horas < 1) return `${Math.round(horas * 60)} min`
  if (horas < 24) return `${horas.toFixed(1)} h`
  return `${(horas / 24).toFixed(1)} d`
}
