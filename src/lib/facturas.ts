// Sprint 8 · HU-FACT-01 — Tipos y utilidades para el módulo de facturas.
//
// Los tipos reflejan exactamente el DDL de la tabla `facturas`:
//   tipo    → enum factura_tipo  ('luz' | 'agua' | 'pension' | 'multa' | 'tienda')
//   estado  → enum factura_estado ('pendiente' | 'pagada' | 'vencida')
//   periodo → 'YYYY-MM' (validado también en BD con CHECK regex)
//
// Las constantes de labels y colores se usan en los componentes de UI
// para evitar strings duplicados entre la tabla y la vista.

import { supabase } from './supabase'

// ─── Enums ───────────────────────────────────────────────────────────────────

export type FacturaTipo       = 'luz' | 'agua' | 'pension' | 'multa' | 'tienda'
export type FacturaEstado     = 'pendiente' | 'pagada' | 'vencida'
/** Sprint 9 · HU-FACT-04 — método de pago. 'tarjeta' = pago en línea del residente (S10). */
export type FacturaMetodoPago = 'efectivo' | 'transferencia' | 'otro' | 'tarjeta'

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
  /** Número legible, ej: F-2026-05-001. Null hasta ejecutar migr. HU-FACT-03. */
  numero:        string | null
  // Sprint 9 · HU-FACT-04 / HU-FACT-08
  /** Fecha en que el admin registró el pago (ISO 'YYYY-MM-DD'). Null si no está pagada. */
  fecha_pago:           string | null
  /** Método con el que se registró el pago. Null si no está pagada. */
  metodo_pago:          FacturaMetodoPago | null
  /** UUID del admin que registró el pago. Null si no está pagada. */
  registrado_por:       string | null
  /** Evita recordatorios duplicados si el cron corre dos veces (HU-FACT-08). */
  recordatorio_enviado: boolean
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
  tienda:   'Tienda',
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

/** Sprint 9 · HU-FACT-04 — etiquetas legibles de los métodos de pago. */
export const LABEL_METODO_PAGO: Record<FacturaMetodoPago, string> = {
  efectivo:      'Efectivo',
  transferencia: 'Transferencia',
  otro:          'Otro',
  tarjeta:       'Tarjeta (en línea)',
}

/** Aviso de idempotencia (R3) que muestra la UI al re-pagar una factura ya pagada. */
export const MENSAJE_YA_PAGADA = 'La factura ya estaba pagada'

// ─── Totales del periodo (PBI-S8-E02) ──────────────────────────────────────────

/** Totales del periodo devueltos por la RPC totales_facturacion (sumados en servidor). */
export type TotalesPeriodo = {
  emitido:   number
  cobrado:   number
  pendiente: number
  vencido:   number
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/**
 * Formatea un monto numérico como moneda local (es-PE, PEN — soles peruanos).
 * Ej: 1500.50 → 'S/ 1,500.50'
 */
export function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
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
 *
 * Comparamos strings 'YYYY-MM-DD' directamente para evitar el bug de timezone:
 * `new Date("2026-05-30")` se parsea como UTC medianoche → en zonas UTC-5/UTC-6
 * la factura aparecería vencida desde las 6-7 PM del día anterior.
 * Al comparar como string con la fecha local evitamos ese desfase.
 */
export function estaVencida(factura: Pick<Factura, 'estado' | 'vencimiento'>): boolean {
  if (factura.estado === 'pagada') return false
  // Obtener la fecha local como 'YYYY-MM-DD' (sin conversión UTC)
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  // factura.vencimiento ya viene como 'YYYY-MM-DD' desde Postgres
  return factura.vencimiento < hoyStr
}

/**
 * Sprint 9 · HU-FACT-04 — Una factura solo puede marcarse como pagada desde
 * 'pendiente' o 'vencida' (transición permitida del ciclo de cobro).
 */
export function puedeMarcarsePagada(estado: FacturaEstado): boolean {
  return estado === 'pendiente' || estado === 'vencida'
}

/**
 * Fecha local de hoy en 'YYYY-MM-DD' (sin desfase UTC), para el valor por
 * defecto del campo "fecha de pago" del modal "Marcar como pagada".
 */
export function fechaHoyISO(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

// ─── Operaciones de datos (wrappers de RPC del servidor) ───────────────────────

/** Resultado de registrar el pago de una factura (HU-FACT-04). */
export type ResultadoPago = {
  ok: boolean
  /** true si la factura ya estaba pagada (idempotencia, R3). */
  yaPagada: boolean
  mensaje: string
  error?: string
}

/**
 * Sprint 9 · HU-FACT-04 — Marca una factura como pagada vía la RPC
 * registrar_pago_factura (idempotente y atómica en el servidor). Toda la
 * transición pasa por aquí; el trigger after_factura_paid notifica al residente.
 *
 * @param fecha ISO 'YYYY-MM-DD'. Si se omite, el servidor usa hoy (America/Lima).
 */
export async function registrarPagoFactura(
  facturaId: string,
  metodo: FacturaMetodoPago,
  fecha?: string,
): Promise<ResultadoPago> {
  const { data, error } = await supabase.rpc('registrar_pago_factura', {
    p_factura_id: facturaId,
    p_metodo: metodo,
    p_fecha: fecha ?? null,
  })

  if (error) {
    return { ok: false, yaPagada: false, mensaje: error.message, error: error.message }
  }

  const r = (data ?? {}) as { ok?: boolean; ya_pagada?: boolean; mensaje?: string }
  return {
    ok: r.ok ?? true,
    yaPagada: r.ya_pagada ?? false,
    mensaje: r.mensaje ?? '',
  }
}

/**
 * Sprint 9 · PBI-S8-E02 — Totales del periodo (emitido/cobrado/pendiente/vencido)
 * sumados 100% en el servidor (numeric). Nunca se hace aritmética de montos en JS.
 */
export async function obtenerTotalesPeriodo(periodo: string): Promise<TotalesPeriodo> {
  const { data, error } = await supabase.rpc('totales_facturacion', { p_periodo: periodo })

  if (error || !data) {
    return { emitido: 0, cobrado: 0, pendiente: 0, vencido: 0 }
  }

  const d = data as Record<string, number | string>
  return {
    emitido:   Number(d.emitido   ?? 0),
    cobrado:   Number(d.cobrado   ?? 0),
    pendiente: Number(d.pendiente ?? 0),
    vencido:   Number(d.vencido   ?? 0),
  }
}

/**
 * Sprint 10 · HU-FACT-09 — Pago en línea SIMULADO de una factura por su propio
 * residente, vía la RPC pagar_factura_residente (SECURITY DEFINER, valida que la
 * factura es suya). Marca 'pagada' con metodo_pago='tarjeta' y fecha de hoy
 * (America/Lima). Idempotente; el trigger after_factura_paid emite la
 * notificación 'factura_pagada' y suma el monto a los totales del admin.
 */
export async function pagarFacturaResidente(facturaId: string): Promise<ResultadoPago> {
  const { data, error } = await supabase.rpc('pagar_factura_residente', {
    p_factura_id: facturaId,
  })

  if (error) {
    return { ok: false, yaPagada: false, mensaje: error.message, error: error.message }
  }

  const r = (data ?? {}) as { ok?: boolean; ya_pagada?: boolean; mensaje?: string }
  return {
    ok: r.ok ?? true,
    yaPagada: r.ya_pagada ?? false,
    mensaje: r.mensaje ?? '',
  }
}
