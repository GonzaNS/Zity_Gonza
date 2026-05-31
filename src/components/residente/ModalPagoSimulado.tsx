// Sprint 10 · HU-FACT-09 — Modal de pago en línea SIMULADO.
//
// Muestra el monto y un formulario de tarjeta ficticia (número / vencimiento /
// CVV) con un aviso claro de demostración. Los datos de la tarjeta NO se envían
// a ningún proveedor ni se guardan: el "pago" solo invoca la RPC
// pagar_factura_residente con el id de la factura. Migrar a una pasarela real
// (Culqi/Izipay) implica reemplazar esta confirmación por su SDK + webhook.

import { useRef, useState } from 'react'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  formatearMonto,
  formatearPeriodo,
  pagarFacturaResidente,
  LABEL_FACTURA_TIPO,
  type Factura,
} from '../../lib/facturas'

type Props = {
  factura: Factura
  onClose: () => void
  onPagado: (mensaje: string) => void
}

export default function ModalPagoSimulado({ factura, onClose, onPagado }: Props) {
  const [numero, setNumero] = useState('')
  const [vencimiento, setVencimiento] = useState('')
  const [cvv, setCvv] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useModalBehavior(onClose, enviando)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const formCompleto =
    numero.replace(/\s/g, '').length >= 13 && vencimiento.length === 5 && cvv.length >= 3

  function onNumero(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 16)
    setNumero(digits.replace(/(.{4})/g, '$1 ').trim())
  }
  function onVenc(v: string) {
    const digits = v.replace(/\D/g, '').slice(0, 4)
    setVencimiento(digits.length <= 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`)
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    if (!formCompleto) {
      setError('Completa los datos de la tarjeta de demostración.')
      return
    }
    setEnviando(true)
    setError(null)
    const res = await pagarFacturaResidente(factura.id)
    setEnviando(false)
    if (!res.ok) {
      setError(res.error ?? 'No se pudo procesar el pago. Intenta de nuevo.')
      return
    }
    onPagado(res.mensaje || 'Pago realizado correctamente')
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={() => { if (!enviando) onClose() }}
      />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Pago en línea de factura"
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 animate-fade-in"
        >
          <form onSubmit={handlePagar} noValidate>
            {/* Cabecera */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-warm-100">
              <h2 className="font-display text-lg font-semibold text-primary-900">Pagar factura</h2>
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

            <div className="px-6 py-5 space-y-5">
              {/* Resumen del cobro */}
              <div className="flex items-center justify-between bg-warm-50 border border-warm-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-primary-900">{LABEL_FACTURA_TIPO[factura.tipo]}</p>
                  <p className="text-xs text-warm-400">{formatearPeriodo(factura.periodo)}</p>
                </div>
                <p className="font-display text-2xl font-bold text-primary-900">{formatearMonto(factura.monto)}</p>
              </div>

              {/* Aviso de demostración */}
              <div className="flex items-start gap-2.5 bg-accent-50 border border-accent-200 rounded-lg px-3.5 py-3">
                <svg className="w-5 h-5 text-accent-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-accent-800">
                  <strong>Pago de demostración.</strong> No se realiza ningún cobro real ni se guardan
                  datos de tarjeta. Usa cualquier número ficticio.
                </p>
              </div>

              {/* Formulario de tarjeta ficticia */}
              <div>
                <label className="block text-sm font-medium text-primary-900 mb-1.5">Número de tarjeta</label>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  value={numero}
                  onChange={e => onNumero(e.target.value)}
                  placeholder="4111 1111 1111 1111"
                  className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-primary-900 mb-1.5">Vencimiento</label>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={vencimiento}
                    onChange={e => onVenc(e.target.value)}
                    placeholder="MM/AA"
                    className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-primary-900 mb-1.5">CVV</label>
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="123"
                    className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>

              {error && <p className="text-sm text-error" role="alert">{error}</p>}
            </div>

            {/* Pie */}
            <div className="flex gap-3 justify-end px-6 py-5 border-t border-warm-100">
              <button
                type="button"
                onClick={() => { if (!enviando) onClose() }}
                disabled={enviando}
                className="px-4 py-2 text-sm font-medium text-warm-500 hover:text-primary-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando || !formCompleto}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {enviando && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {enviando ? 'Procesando…' : `Pagar ${formatearMonto(factura.monto)}`}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}
