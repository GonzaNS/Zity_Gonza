// Tipos y utilidades para las métricas financieras (HU-EJEC-03)

export interface IngresoPorTipo {
  name: string
  value: number
}

export interface RatioCobranza {
  cobrado: number
  pendiente: number
}

export interface MetricasFinanzas {
  periodo: string
  ratio: RatioCobranza
  ingresos_por_tipo: IngresoPorTipo[]
}

// Utilidad para formatear montos en moneda local (Soles por defecto, o configurable)
export function formatearMoneda(valor: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
  }).format(valor)
}

// Utilidad para calcular el porcentaje de cobranza
export function calcularPorcentajeCobranza(cobrado: number, pendiente: number): number {
  const total = cobrado + pendiente
  if (total === 0) return 0
  return (cobrado / total) * 100
}
