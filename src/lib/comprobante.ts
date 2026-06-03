// Sprint 9 · PBI-S8-E01 — Generación del comprobante PDF de una factura pagada.
//
// Se genera 100% en el cliente con pdf-lib (el stack de runtime es JS/Deno; se
// descartó reportlab —Python— por incompatibilidad: ver docs/conventions.md y ADR-011).
// El comprobante solo está disponible para facturas con estado='pagada' (R4) y
// reusa el campo `numero` ya persistido (no se recalcula, R7).

import zityLogo from '../assets/zity_logo.png'
import type { Color, PDFFont } from 'pdf-lib'
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
 * bytes del logo (PNG) para incrustarlo; si no se pasan (o el embed falla), se
 * dibuja el wordmark textual "Zity" como respaldo. Nunca se dibujan el logo y
 * el wordmark a la vez: dibujarlos juntos era lo que producía el solape "ZitZity".
 */
export async function generarComprobantePDF(
  factura: Factura,
  residente: DatosResidenteComprobante,
  logoBytes?: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const datos = construirComprobante(factura, residente)

  // pdf-lib se carga bajo demanda (≈400 kB): así la vista de facturas no lo
  // descarga salvo que el residente genere un comprobante.
  const { PDFDocument, StandardFonts, LineCapStyle, rgb } = await import('pdf-lib')

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89]) // A4 en puntos
  const { width, height } = page.getSize()

  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  // ── Paleta de marca Zity (deep teal + warm gold), tomada de src/index.css ──
  const tinta     = rgb(0.067, 0.141, 0.184) // primary-800 · texto y valores
  const petroleo  = rgb(0.086, 0.184, 0.239) // primary-700 · títulos y monto
  const dorado    = rgb(0.831, 0.627, 0.263) // accent-500  · filo y acentos
  const gris      = rgb(0.404, 0.459, 0.498) // rótulos
  const grisTenue = rgb(0.553, 0.596, 0.635) // pie
  const linea     = rgb(0.871, 0.902, 0.918) // separadores
  const panel     = rgb(0.937, 0.965, 0.973) // primary-50  · fondos sutiles
  const verde     = rgb(0.290, 0.486, 0.349) // success
  const verdeBg   = rgb(0.918, 0.945, 0.925) // success muy claro

  const ML = 50            // margen izquierdo
  const MR = width - 50    // margen derecho (coordenada x)
  const ancho = MR - ML
  const colDer = ML + ancho / 2 + 8 // inicio de la 2ª columna en bloques de 2

  // ── Helpers de texto ───────────────────────────────────────────────────────
  const txt = (s: string, x: number, y: number, size: number, font: PDFFont, color: Color) =>
    page.drawText(s, { x, y, size, font, color })

  const anchoTracked = (s: string, size: number, font: PDFFont, tr: number) => {
    let w = 0
    for (const ch of s) w += font.widthOfTextAtSize(ch, size) + tr
    return w - tr
  }
  // Texto con interletraje (letter-spacing): pdf-lib no lo expone, así que se
  // dibuja carácter a carácter. Es el detalle que hace ver "premium" a los
  // rótulos en mayúsculas.
  const tracked = (s: string, x: number, y: number, size: number, font: PDFFont, color: Color, tr: number) => {
    let cx = x
    for (const ch of s) {
      page.drawText(ch, { x: cx, y, size, font, color })
      cx += font.widthOfTextAtSize(ch, size) + tr
    }
  }
  const der = (s: string, xR: number, y: number, size: number, font: PDFFont, color: Color) =>
    page.drawText(s, { x: xR - font.widthOfTextAtSize(s, size), y, size, font, color })
  const trackedDer = (s: string, xR: number, y: number, size: number, font: PDFFont, color: Color, tr: number) =>
    tracked(s, xR - anchoTracked(s, size, font, tr), y, size, font, color, tr)
  const regla = (y: number, x1 = ML, x2 = MR, thickness = 1, color = linea) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color })

  // Normaliza espacios duros que Intl puede insertar en la moneda (NBSP, narrow
  // NBSP…): WinAnsi —la codificación de las fuentes estándar— no los soporta y
  // romperían la generación en algunos runtimes.
  const dinero = datos.montoLabel.replace(/\s/g, ' ')

  // ── Filo superior de marca ───────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: height - 5, width, height: 5, color: dorado })

  let y = height - 60

  // ── Encabezado: logo (o wordmark) + tipo de documento ─────────────────────
  let logoOk = false
  if (logoBytes) {
    try {
      const png = await pdf.embedPng(logoBytes)
      const h = 30
      page.drawImage(png, { x: ML, y: y - h, width: png.width * (h / png.height), height: h })
      logoOk = true
    } catch {
      // Logo opcional: si el embed falla, se usa el wordmark textual de abajo.
    }
  }
  if (!logoOk) txt('Zity', ML, y - 24, 24, bold, petroleo)

  trackedDer('COMPROBANTE DE PAGO', MR, y - 6, 9.5, bold, petroleo, 1.4)
  der(datos.numero, MR, y - 28, 14, bold, tinta)

  y -= 54
  regla(y)
  page.drawRectangle({ x: ML, y: y - 1, width: 54, height: 2, color: dorado }) // acento dorado bajo el logo
  y -= 48

  // ── Partes: emisor / receptor ──────────────────────────────────────────────
  tracked('EMITIDO POR', ML, y, 8, helv, gris, 1.2)
  tracked('FACTURADO A', colDer, y, 8, helv, gris, 1.2)
  txt('Zity', ML, y - 17, 11, bold, tinta)
  txt(datos.residente, colDer, y - 17, 11, bold, tinta)
  txt('Administración del condominio', ML, y - 31, 9, helv, gris)
  txt(`Departamento ${datos.departamento}`, colDer, y - 31, 9, helv, gris)
  y -= 78

  // ── Detalle (tabla de una línea) ───────────────────────────────────────────
  const thH = 22
  page.drawRectangle({ x: ML, y: y - thH, width: ancho, height: thH, color: panel })
  const thY = y - thH + 7
  tracked('CONCEPTO', ML + 14, thY, 8, bold, gris, 1)
  tracked('PERÍODO', ML + 248, thY, 8, bold, gris, 1)
  trackedDer('IMPORTE', MR - 14, thY, 8, bold, gris, 1)
  y -= thH

  const rowY = y - 20
  txt(datos.concepto, ML + 14, rowY, 11, bold, tinta)
  txt(datos.periodo, ML + 248, rowY, 10, helv, gris)
  der(dinero, MR - 14, rowY, 11, bold, tinta)
  y -= 30
  regla(y)
  y -= 44

  // ── Total + estado (panel destacado) ───────────────────────────────────────
  const ph = 70
  const pY = y - ph
  page.drawRectangle({ x: ML, y: pY, width: ancho, height: ph, color: panel })

  trackedDer('TOTAL PAGADO', MR - 18, pY + ph - 26, 9, helv, gris, 1.4)
  der(dinero, MR - 18, pY + 18, 26, bold, petroleo)

  // Badge "PAGADO" (check + texto) a la izquierda del panel
  const bw = 120, bh = 34
  const bx = ML + 18, bY = pY + (ph - bh) / 2
  page.drawRectangle({ x: bx, y: bY, width: bw, height: bh, color: verdeBg, borderColor: verde, borderWidth: 1 })
  const ccx = bx + 18, ccy = bY + bh / 2
  page.drawLine({ start: { x: ccx - 5, y: ccy }, end: { x: ccx - 1, y: ccy - 5 }, thickness: 1.8, color: verde, lineCap: LineCapStyle.Round })
  page.drawLine({ start: { x: ccx - 1, y: ccy - 5 }, end: { x: ccx + 6, y: ccy + 5 }, thickness: 1.8, color: verde, lineCap: LineCapStyle.Round })
  tracked('PAGADO', bx + 36, ccy - 4, 11, bold, verde, 1.5)

  y = pY - 52

  // ── Datos del pago ───────────────────────────────────────────────────────────
  tracked('MÉTODO DE PAGO', ML, y, 8, helv, gris, 1.2)
  tracked('FECHA DE PAGO', colDer, y, 8, helv, gris, 1.2)
  txt(datos.metodoLabel, ML, y - 17, 11, bold, tinta)
  txt(datos.fechaPagoLabel, colDer, y - 17, 11, bold, tinta)

  // ── Nota de conservación + pie ─────────────────────────────────────────────
  // La nota cierra el bloque de contenido (no flota a media página).
  txt('Conserva este comprobante como constancia de tu pago.', ML, y - 59, 9.5, helv, gris)

  const hoy = new Date().toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
  regla(64)
  txt(`Generado el ${hoy}. Documento sin valor tributario.`, ML, 48, 8, helv, grisTenue)
  txt('Zity. Datos ficticios para uso académico.', ML, 36, 8, helv, grisTenue)

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
