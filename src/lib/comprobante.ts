// Sprint 9 · PBI-S8-E01 — Generación del comprobante PDF de una factura pagada.
//
// Se genera 100% en el cliente con pdf-lib (el stack de runtime es JS/Deno; se
// descartó reportlab —Python— por incompatibilidad: ver docs/conventions.md y ADR-011).
// El comprobante solo está disponible para facturas con estado='pagada' (R4) y
// reusa el campo `numero` ya persistido (no se recalcula, R7).

import zityLogo from '../assets/zity_logo.png'
import {
  LABEL_FACTURA_TIPO,
  LABEL_METODO_PAGO,
  formatearMonto,
  formatearPeriodo,
  type Factura,
} from './facturas'

/** Datos mínimos del residente que aparecen en el comprobante. */
export type DatosResidenteComprobante = {
  nombre: string
  apellido: string
  departamento?: string
}

/** Contenido textual del comprobante (lógica pura, testeable sin generar binario). */
export type ComprobanteData = {
  numero: string
  residente: string
  departamento: string
  concepto: string
  periodo: string
  montoLabel: string
  metodoLabel: string
  fechaPagoLabel: string
  sello: 'PAGADO'
}

function formatearFechaLarga(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

/**
 * Arma los datos del comprobante a partir de una factura pagada.
 * Lanza si la factura no está pagada (R4) — el comprobante no existe para
 * facturas pendientes/vencidas.
 */
export function construirComprobante(
  factura: Factura,
  residente: DatosResidenteComprobante,
): ComprobanteData {
  if (factura.estado !== 'pagada') {
    throw new Error('Solo se puede generar el comprobante de una factura pagada.')
  }
  return {
    numero:         factura.numero ?? '—',
    residente:      `${residente.nombre} ${residente.apellido}`,
    departamento:   residente.departamento ?? '—',
    concepto:       LABEL_FACTURA_TIPO[factura.tipo],
    periodo:        formatearPeriodo(factura.periodo),
    montoLabel:     formatearMonto(factura.monto),
    metodoLabel:    factura.metodo_pago ? LABEL_METODO_PAGO[factura.metodo_pago] : '—',
    fechaPagoLabel: factura.fecha_pago ? formatearFechaLarga(factura.fecha_pago) : '—',
    sello:          'PAGADO',
  }
}

/**
 * Genera el PDF del comprobante y devuelve sus bytes. Acepta opcionalmente los
 * bytes del logo (PNG) para incrustarlo; si no se pasan, se omite el logo.
 */
export async function generarComprobantePDF(
  factura: Factura,
  residente: DatosResidenteComprobante,
  logoBytes?: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const datos = construirComprobante(factura, residente)

  // pdf-lib se carga bajo demanda (≈400 kB): así la vista de facturas no lo
  // descarga salvo que el residente genere un comprobante.
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 en puntos
  const { width, height } = page.getSize()

  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  const azul = rgb(0.058, 0.298, 0.541)   // primary Zity (#0f4c8a aprox)
  const gris = rgb(0.39, 0.45, 0.55)
  const negro = rgb(0.06, 0.09, 0.16)
  const verde = rgb(0.13, 0.59, 0.33)

  const margen = 56
  let y = height - margen

  // ── Encabezado: logo + marca ────────────────────────────────────────────
  if (logoBytes) {
    try {
      const png = await pdf.embedPng(logoBytes)
      const escala = 38 / png.height
      page.drawImage(png, { x: margen, y: y - 38, width: png.width * escala, height: 38 })
    } catch {
      // Logo opcional: si falla el embed, se omite sin romper el comprobante.
    }
  }
  page.drawText('Zity', { x: margen + 48, y: y - 28, size: 24, font: bold, color: azul })
  page.drawText('Comprobante de pago', { x: width - margen - 180, y: y - 22, size: 14, font: bold, color: gris })

  y -= 70
  page.drawLine({ start: { x: margen, y }, end: { x: width - margen, y }, thickness: 1, color: rgb(0.9, 0.9, 0.92) })
  y -= 36

  // ── Número de factura ───────────────────────────────────────────────────
  page.drawText('N° de factura', { x: margen, y, size: 10, font: helv, color: gris })
  page.drawText(datos.numero, { x: margen, y: y - 18, size: 16, font: bold, color: negro })
  y -= 50

  // ── Datos del residente ───────────────────────────────────────────────────
  const fila = (label: string, valor: string) => {
    page.drawText(label, { x: margen, y, size: 10, font: helv, color: gris })
    page.drawText(valor, { x: margen + 160, y, size: 11, font: bold, color: negro })
    y -= 24
  }
  fila('Residente', datos.residente)
  fila('Departamento', datos.departamento)
  fila('Concepto', datos.concepto)
  fila('Período', datos.periodo)
  y -= 6
  page.drawLine({ start: { x: margen, y }, end: { x: width - margen, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.92) })
  y -= 28
  fila('Método de pago', datos.metodoLabel)
  fila('Fecha de pago', datos.fechaPagoLabel)

  // ── Monto destacado ─────────────────────────────────────────────────────
  y -= 14
  page.drawText('Total pagado', { x: margen, y, size: 11, font: helv, color: gris })
  page.drawText(datos.montoLabel, { x: margen, y: y - 30, size: 30, font: bold, color: azul })

  // ── Sello PAGADO ──────────────────────────────────────────────────────────
  const selloW = 150, selloH = 54
  const selloX = width - margen - selloW
  const selloY = y - 36
  page.drawRectangle({
    x: selloX, y: selloY, width: selloW, height: selloH,
    borderColor: verde, borderWidth: 2.5, color: rgb(0.13, 0.59, 0.33), opacity: 0.06,
  })
  const selloText = datos.sello
  const selloSize = 26
  const selloTextW = bold.widthOfTextAtSize(selloText, selloSize)
  page.drawText(selloText, {
    x: selloX + (selloW - selloTextW) / 2,
    y: selloY + (selloH - selloSize) / 2 + 4,
    size: selloSize, font: bold, color: verde,
  })

  // ── Pie ───────────────────────────────────────────────────────────────────
  page.drawText('Documento generado automáticamente por Zity. Datos ficticios — uso académico.', {
    x: margen, y: margen, size: 8, font: helv, color: rgb(0.6, 0.64, 0.7),
  })

  return pdf.save()
}

/**
 * Genera y descarga el comprobante en el navegador (fetch del logo + Blob).
 */
export async function descargarComprobante(
  factura: Factura,
  residente: DatosResidenteComprobante,
): Promise<void> {
  let logoBytes: ArrayBuffer | undefined
  try {
    logoBytes = await fetch(zityLogo).then(r => r.arrayBuffer())
  } catch {
    logoBytes = undefined  // el logo es opcional
  }

  const bytes = await generarComprobantePDF(factura, residente, logoBytes)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = `comprobante-${factura.numero ?? factura.id}.pdf`
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Revocar siempre el ObjectURL, incluso si la descarga lanza (evita fuga).
    URL.revokeObjectURL(url)
  }
}
