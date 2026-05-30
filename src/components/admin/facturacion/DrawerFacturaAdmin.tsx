// Sprint 9 · HU-FACT-04 — Drawer de detalle de factura para el admin, con la
// acción "Marcar como pagada" (método + fecha). La transición pasa por la RPC
// registrar_pago_factura (idempotente y atómica). El botón se deshabilita tras
// el primer click para evitar doble pago (R3).

import { useState, useEffect } from 'react'
import {
  LABEL_FACTURA_TIPO,
  LABEL_FACTURA_ESTADO,
  BADGE_FACTURA_ESTADO,
  LABEL_METODO_PAGO,
  formatearMonto,
  formatearPeriodo,
  puedeMarcarsePagada,
  fechaHoyISO,
  registrarPagoFactura,
  estaVencida,
  type FacturaMetodoPago,
} from '../../../lib/facturas'
import type { FacturaAdmin } from '../../../hooks/useFacturasAdmin'

type Props = {
  factura: FacturaAdmin
  onClose: () => void
  /** Llamado tras un pago exitoso (o factura ya pagada): el padre recarga + toast + cierra. */
  onPagoRegistrado: (mensaje: string) => void
}

const METODOS: FacturaMetodoPago[] = ['efectivo', 'transferencia', 'otro']

function formatearFechaLarga(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function DrawerFacturaAdmin({ factura, onClose, onPagoRegistrado }: Props) {
  const [pagando, setPagando] = useState(false)         // modo formulario de pago
  const [metodo, setMetodo] = useState<FacturaMetodoPago>('efectivo')
  const [fecha, setFecha] = useState<string>(fechaHoyISO())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cerrar con Escape (accesibilidad, patrón del proyecto).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && !enviando) onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, enviando])

  const estadoVisual = estaVencida(factura) && factura.estado === 'pendiente' ? 'vencida' : factura.estado
  const puedePagar = puedeMarcarsePagada(factura.estado)

  async function confirmarPago() {
    setEnviando(true)
    setError(null)
    const res = await registrarPagoFactura(factura.id, metodo, fecha)
    setEnviando(false)

    if (!res.ok) {
      setError(res.error ?? 'No se pudo registrar el pago.')
      return
    }
    // Éxito o idempotencia (ya pagada): el padre recarga, muestra toast y cierra.
    onPagoRegistrado(res.mensaje)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={() => { if (!enviando) onClose() }}
      />
      <aside
        className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-fade-in-down"
        role="dialog"
        aria-label="Detalle de factura"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-warm-100">
          <div>
            <p className="font-display text-xl font-semibold text-primary-900">
              {LABEL_FACTURA_TIPO[factura.tipo]}
            </p>
            <p className="text-sm text-warm-400">{formatearPeriodo(factura.periodo)}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
              {LABEL_FACTURA_ESTADO[estadoVisual]}
            </span>
            <button
              type="button"
              onClick={() => { if (!enviando) onClose() }}
              className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <p className="font-display text-4xl font-bold text-primary-900 leading-none mb-2">
            {formatearMonto(factura.monto)}
          </p>

          <Fila label="Residente" valor={factura.residente ? `${factura.residente.nombre} ${factura.residente.apellido}` : '—'} />
          <Fila label="N° de factura" valor={factura.numero ?? '—'} mono />
          <Fila label="Período" valor={formatearPeriodo(factura.periodo)} />
          <Fila label="Emisión" valor={formatearFechaLarga(factura.fecha_emision)} />
          <Fila label="Vencimiento" valor={formatearFechaLarga(factura.vencimiento)} resaltado={estadoVisual === 'vencida'} />
          {factura.descripcion && <Fila label="Descripción" valor={factura.descripcion} />}

          {/* Datos del pago (si ya está pagada) */}
          {factura.estado === 'pagada' && (
            <div className="pt-3 mt-3 border-t border-warm-100 space-y-4">
              <Fila label="Fecha de pago" valor={factura.fecha_pago ? formatearFechaLarga(factura.fecha_pago) : '—'} />
              <Fila label="Método de pago" valor={factura.metodo_pago ? LABEL_METODO_PAGO[factura.metodo_pago] : '—'} />
            </div>
          )}

          {/* Formulario de pago */}
          {pagando && puedePagar && (
            <div className="pt-4 mt-2 border-t border-warm-100 space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-medium text-primary-900 mb-1.5">Método de pago</label>
                <select
                  value={metodo}
                  onChange={e => setMetodo(e.target.value as FacturaMetodoPago)}
                  disabled={enviando}
                  className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
                >
                  {METODOS.map(m => <option key={m} value={m}>{LABEL_METODO_PAGO[m]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary-900 mb-1.5">Fecha de pago</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  disabled={enviando}
                  className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
            </div>
          )}
        </div>

        {/* Pie con acciones */}
        {puedePagar && (
          <div className="p-6 border-t border-warm-100">
            {!pagando ? (
              <button
                type="button"
                onClick={() => setPagando(true)}
                className="w-full h-11 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
              >
                Marcar como pagada
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setPagando(false); setError(null) }}
                  disabled={enviando}
                  className="flex-1 h-11 text-sm font-medium text-warm-500 border border-warm-300 rounded-xl hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmarPago}
                  disabled={enviando}
                  className="flex-1 h-11 text-sm font-semibold text-white bg-primary-600 rounded-xl hover:bg-primary-700 transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {enviando && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  {enviando ? 'Registrando…' : 'Confirmar pago'}
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function Fila({ label, valor, mono, resaltado }: { label: string; valor: string; mono?: boolean; resaltado?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <p className="text-sm text-warm-400 shrink-0">{label}</p>
      <p className={`text-sm text-right ${resaltado ? 'text-error font-medium' : 'text-primary-900'} ${mono ? 'font-mono' : ''}`}>
        {valor}
      </p>
    </div>
  )
}
