// Sprint 8 · HU-FACT-01 — Tipos y utilidades para el módulo de facturas.
//
// Los tipos reflejan exactamente el DDL de la tabla `facturas`:
//   tipo    → enum factura_tipo  ('luz' | 'agua' | 'pension' | 'multa')
//   estado  → enum factura_estado ('pendiente' | 'pagada' | 'vencida')
//   periodo → 'YYYY-MM' (validado también en BD con CHECK regex)
//
// Las constantes de labels y colores se usan en los componentes de UI
// para evitar strings duplicados entre la tabla y la vista.

// ─── Enums ───────────────────────────────────────────────────────────────────

export type FacturaTipo   = 'luz' | 'agua' | 'pension' | 'multa'
export type FacturaEstado = 'pendiente' | 'pagada' | 'vencida'

// ─── Tipo principal ───────────────────────────────────────────────────────────

export type Factura = {
  id:            string
  residente_id:  string
  tipo:          FacturaTipo
  monto:         number
  /** Formato 'YYYY-MM', ej: '2026-05' */
  periodo:       string
  fecha_emision: string   // ISO date 'YYYY-MM-DD'
  vencimiento:   string   // ISO date 'YYYY-MM-DD'
  estado:        FacturaEstado
  descripcion:   string | null
  created_at:    string
  updated_at:    string
}

/** Payload para emitir una nueva factura (solo campos que envía el admin). */
export type FacturaInsert = Omit<Factura, 'id' | 'created_at' | 'updated_at'> & {
  estado?: FacturaEstado  // default 'pendiente' en BD
}

// ─── Labels y estilos ─────────────────────────────────────────────────────────

export const LABEL_FACTURA_TIPO: Record<FacturaTipo, string> = {
  luz:      'Electricidad',
  agua:     'Agua',
  pension:  'Pensión',
  multa:    'Multa',
}

export const LABEL_FACTURA_ESTADO: Record<FacturaEstado, string> = {
  pendiente: 'Pendiente',
  pagada:    'Pagada',
  vencida:   'Vencida',
}

/** Clases Tailwind/CSS para el badge de estado de factura. */
export const BADGE_FACTURA_ESTADO: Record<FacturaEstado, string> = {
  pendiente: 'bg-accent-50 text-accent-700 border-accent-200',
  pagada:    'bg-success/10 text-success border-success/30',
  vencida:   'bg-error/10 text-error border-error/20',
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Formatea un monto numérico como moneda local (es-MX, MXN).
 * Ej: 1500.50 → '$1,500.50'
 */
export function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(monto)
}

/**
 * Formatea 'YYYY-MM' como mes y año legible en español.
 * Ej: '2026-05' → 'Mayo 2026'
 */
export function formatearPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-')
  const fecha = new Date(Number(year ?? 2000), Number(month ?? 1) - 1, 1)
  return fecha.toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

/**
 * Determina si una factura está vencida (según la fecha actual del cliente).
 * Útil para marcar visualmente facturas que aún no actualizaron su estado en BD.
 */
export function estaVencida(factura: Pick<Factura, 'estado' | 'vencimiento'>): boolean {
  if (factura.estado === 'pagada') return false
  return new Date(factura.vencimiento) < new Date()
}
