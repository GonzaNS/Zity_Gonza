// Sprint 13 · HU-PAGO-03 — Modal de pago mejorado con tarjetas guardadas.
//
// Extiende el ModalPagoSimulado del Sprint 10 (misma Props API: { factura, onClose, onPagado })
// añadiendo soporte para tarjetas tokenizadas. La API de uso en Facturas.tsx NO cambia.
//
// Flujo:
//   • Carga las tarjetas guardadas del residente (RLS garantiza solo las suyas).
//   • Si tiene tarjetas: precarga la predeterminada; permite elegir otra o "Nueva tarjeta".
//   • Si no tiene tarjetas: cae al formulario manual del S10 (compatibilidad total).
//   • El CVV se pide en cada pago, se valida en memoria y NUNCA se persiste.
//   • Al confirmar: llama pagar_factura_residente(factura_id) — misma RPC del S10.
//   • El efecto Realtime de S8/S9 actualiza el estado de la factura en tiempo real.
//
// Política no-PII (OWASP A02):
//   • El CVV nunca sale de la memoria del componente.
//   • Si el residente guarda la nueva tarjeta, se tokeniza (sin PAN ni CVV) via HU-PAGO-01/02.

import { useRef, useState, useEffect } from 'react'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  formatearMonto,
  formatearPeriodo,
  pagarFacturaResidente,
  LABEL_FACTURA_TIPO,
  type Factura,
} from '../../lib/facturas'
import {
  listarMetodosPago,
  agregarMetodoPago,
  luhnValido,
  tokenizarTarjeta,
  detectarMarca,
  mascaraTarjeta,
  formatearExpiracion,
  LABEL_MARCA,
  COLOR_MARCA,
  type MetodoPago,
  type TarjetaMarca,
} from '../../lib/metodos-pago'
import { useAuth } from '../../contexts/AuthContext'

// ─── Props (sin cambios respecto al S10) ─────────────────────────────────────

type Props = {
  factura: Factura
  onClose: () => void
  onPagado: (mensaje: string) => void
}

// ─── Modo del formulario ─────────────────────────────────────────────────────

type Modo = 'guardada' | 'nueva'

const ANIO_ACTUAL = new Date().getFullYear()

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ModalPagoSimulado({ factura, onClose, onPagado }: Props) {
  const { profile } = useAuth()

  // ── Estado de carga de tarjetas ────────────────────────────────────────────
  const [tarjetas, setTarjetas] = useState<MetodoPago[]>([])
  const [cargandoTarjetas, setCargandoTarjetas] = useState(true)

  // ── Modo: 'guardada' | 'nueva' ─────────────────────────────────────────────
  const [modo, setModo] = useState<Modo>('guardada')
  const [tarjetaSelId, setTarjetaSelId] = useState<string | null>(null)

  // ── CVV (siempre requerido, nunca se persiste) ─────────────────────────────
  const [cvv, setCvv] = useState('')

  // ── Campos de nueva tarjeta ───────────────────────────────────────────────
  const [panRaw, setPanRaw]       = useState('')
  const [expMes, setExpMes]       = useState('01')
  const [expAnio, setExpAnio]     = useState(String(ANIO_ACTUAL))
  const [titular, setTitular]     = useState('')
  const [alias, setAlias]         = useState('')
  const [guardarTarjeta, setGuardarTarjeta] = useState(false)

  // ── Estado de envío ────────────────────────────────────────────────────────
  const [enviando, setEnviando] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useModalBehavior(onClose, enviando)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  // ── Cargar tarjetas al montar ──────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      setCargandoTarjetas(true)
      const { data } = await listarMetodosPago()
      setTarjetas(data)
      // Preseleccionar predeterminada
      const pred = data.find(t => t.predeterminada) ?? data[0] ?? null
      if (pred) setTarjetaSelId(pred.id)
      // Si no hay tarjetas, saltar directamente al modo nuevo
      if (data.length === 0) setModo('nueva')
      setCargandoTarjetas(false)
    })()
  }, [])

  // ── Computed ─────────────────────────────────────────────────────────────────
  const tarjetaSel   = tarjetas.find(t => t.id === tarjetaSelId) ?? null
  const digitosPan   = panRaw.replace(/\D/g, '')
  const panFormateado = digitosPan.replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
  const marcaDetectada: TarjetaMarca = detectarMarca(digitosPan)
  const panEsValido  = luhnValido(panRaw)

  const formCompleto = (() => {
    if (cvv.length < 3) return false
    if (modo === 'guardada') return tarjetaSel !== null
    // modo nueva
    return digitosPan.length >= 13 && panEsValido && titular.trim() !== ''
  })()

  // ── Handlers ──────────────────────────────────────────────────────────────
  function handlePanChange(v: string) {
    setPanRaw(v.replace(/\D/g, '').slice(0, 19))
  }

  async function handlePagar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!formCompleto) {
      setError('Completa todos los campos requeridos.')
      return
    }

    // Validación extra de vencimiento (solo modo nueva)
    if (modo === 'nueva') {
      const mes = parseInt(expMes, 10)
      const anio = parseInt(expAnio, 10)
      if (anio < ANIO_ACTUAL || (anio === ANIO_ACTUAL && mes < new Date().getMonth() + 1)) {
        setError('La tarjeta ha expirado.')
        return
      }
    }

    setEnviando(true)

    // Si el residente quiere guardar la nueva tarjeta, la tokenizamos ANTES de pagar.
    // CVV no participa en la tokenización ni en el guardado.
    if (modo === 'nueva' && guardarTarjeta && alias.trim() && profile?.id) {
      const { token, ultimos4 } = tokenizarTarjeta(panRaw)
      const marca = detectarMarca(digitosPan)
      // Fire-and-forget: si falla el guardado no bloqueamos el pago
      void agregarMetodoPago({
        residente_id:   profile.id,
        alias:          alias.trim() || `Mi ${LABEL_MARCA[marca]}`,
        marca,
        titular:        titular.trim(),
        ultimos4,
        exp_mes:        parseInt(expMes, 10),
        exp_anio:       parseInt(expAnio, 10),
        token_simulado: token,
        predeterminada: tarjetas.length === 0, // primera tarjeta → predeterminada
      })
    }

    // Ejecutar el pago (misma RPC del Sprint 10)
    // El token de la tarjeta se usaría aquí en producción; en simulación
    // la RPC solo necesita el factura_id (no valida el token en BD).
    const res = await pagarFacturaResidente(factura.id)
    setEnviando(false)

    if (!res.ok) {
      setError(res.error ?? 'No se pudo procesar el pago. Intenta de nuevo.')
      return
    }

    onPagado(res.mensaje || 'Pago realizado correctamente')
  }

  // ── Render ────────────────────────────────────────────────────────────────
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
                  <strong>Pago de demostración.</strong> No se realiza ningún cobro real.
                  El CVV se valida localmente y nunca se envía al servidor.
                </p>
              </div>

              {/* Skeleton de carga */}
              {cargandoTarjetas && (
                <div className="animate-pulse space-y-2">
                  <div className="h-4 w-32 bg-warm-100 rounded" />
                  <div className="h-12 bg-warm-100 rounded-xl" />
                </div>
              )}

              {/* ── Selector de tarjeta guardada ────────────────────────────── */}
              {!cargandoTarjetas && tarjetas.length > 0 && (
                <div className="space-y-3">
                  {/* Toggle modo */}
                  <div className="flex rounded-lg border border-warm-200 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setModo('guardada')}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        modo === 'guardada'
                          ? 'bg-primary-600 text-white'
                          : 'text-warm-600 hover:bg-warm-50'
                      }`}
                    >
                      Tarjeta guardada
                    </button>
                    <button
                      type="button"
                      onClick={() => setModo('nueva')}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        modo === 'nueva'
                          ? 'bg-primary-600 text-white'
                          : 'text-warm-600 hover:bg-warm-50'
                      }`}
                    >
                      Nueva tarjeta
                    </button>
                  </div>

                  {modo === 'guardada' && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-primary-900 uppercase tracking-wider">
                        Selecciona una tarjeta
                      </label>
                      <ul className="space-y-2">
                        {tarjetas.map(t => (
                          <li key={t.id}>
                            <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                              tarjetaSelId === t.id
                                ? 'border-primary-400 bg-primary-50'
                                : 'border-warm-200 hover:border-warm-300'
                            }`}>
                              <input
                                type="radio"
                                name="tarjeta-sel"
                                value={t.id}
                                checked={tarjetaSelId === t.id}
                                onChange={() => setTarjetaSelId(t.id)}
                                className="sr-only"
                              />
                              <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                tarjetaSelId === t.id
                                  ? 'border-primary-600 bg-primary-600'
                                  : 'border-warm-300'
                              }`}>
                                {tarjetaSelId === t.id && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm font-semibold text-primary-900">
                                    {mascaraTarjeta(t.ultimos4)}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[0.55rem] font-bold text-white uppercase tracking-wider ${COLOR_MARCA[t.marca]}`}>
                                    {LABEL_MARCA[t.marca]}
                                  </span>
                                  {t.predeterminada && (
                                    <span className="text-[0.6rem] text-primary-600 font-semibold">★ Predeterminada</span>
                                  )}
                                </div>
                                <p className="text-[0.65rem] text-warm-400 mt-0.5">
                                  {t.alias} · Vence {formatearExpiracion(t.exp_mes, t.exp_anio)}
                                </p>
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ── Formulario de nueva tarjeta ──────────────────────────────── */}
              {(!cargandoTarjetas && (modo === 'nueva' || tarjetas.length === 0)) && (
                <div className="space-y-3">
                  {tarjetas.length === 0 && (
                    <p className="text-xs text-warm-500">
                      No tienes tarjetas guardadas. Puedes ingresar una a continuación.
                    </p>
                  )}

                  {/* Número con detección de marca + Luhn */}
                  <div>
                    <label className="block text-sm font-medium text-primary-900 mb-1.5">
                      Número de tarjeta
                      {digitosPan.length > 5 && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[0.55rem] font-bold text-white uppercase ${COLOR_MARCA[marcaDetectada]}`}>
                          {LABEL_MARCA[marcaDetectada]}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        id="mp-pan-modal"
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        value={panFormateado}
                        onChange={e => handlePanChange(e.target.value)}
                        placeholder="4111 1111 1111 1111"
                        maxLength={19}
                        className={`w-full h-10 px-3 pr-9 rounded-lg border text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                          digitosPan.length >= 13 && !panEsValido
                            ? 'border-error bg-error/5'
                            : 'border-warm-300 text-primary-900'
                        }`}
                      />
                      {digitosPan.length >= 13 && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2">
                          {panEsValido
                            ? <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            : <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          }
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Titular */}
                  <div>
                    <label className="block text-sm font-medium text-primary-900 mb-1.5">
                      Nombre del titular
                    </label>
                    <input
                      type="text"
                      autoComplete="cc-name"
                      value={titular}
                      onChange={e => setTitular(e.target.value)}
                      placeholder="JUAN PÉREZ"
                      className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 uppercase focus:outline-none focus:ring-2 focus:ring-primary-400"
                    />
                  </div>

                  {/* Expiración */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-primary-900 mb-1.5">Mes</label>
                      <select
                        value={expMes}
                        onChange={e => setExpMes(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                      >
                        {Array.from({ length: 12 }, (_, i) => {
                          const m = String(i + 1).padStart(2, '0')
                          return <option key={m} value={m}>{m}</option>
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-primary-900 mb-1.5">Año</label>
                      <select
                        value={expAnio}
                        onChange={e => setExpAnio(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
                      >
                        {Array.from({ length: 10 }, (_, i) => ANIO_ACTUAL + i).map(y => (
                          <option key={y} value={String(y)}>{y}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Opción de guardar tarjeta */}
                  {tarjetas.length > 0 && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={guardarTarjeta}
                        onChange={e => setGuardarTarjeta(e.target.checked)}
                        className="w-4 h-4 rounded border-warm-300 text-primary-600 cursor-pointer"
                      />
                      <span className="text-sm text-primary-900">Guardar esta tarjeta para pagos futuros</span>
                    </label>
                  )}

                  {guardarTarjeta && (
                    <div>
                      <label className="block text-sm font-medium text-primary-900 mb-1.5">
                        Alias de la tarjeta
                      </label>
                      <input
                        type="text"
                        value={alias}
                        onChange={e => setAlias(e.target.value)}
                        placeholder="Mi Visa personal"
                        maxLength={50}
                        className="w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ── CVV (siempre requerido, nunca se persiste) ──────────────── */}
              {!cargandoTarjetas && (
                <div>
                  <label className="block text-sm font-medium text-primary-900 mb-1.5">
                    CVV
                    <span className="ml-1 text-[0.625rem] font-normal text-warm-400">(no se guarda)</span>
                  </label>
                  <input
                    id="modal-cvv"
                    type="password"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cvv}
                    onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="•••"
                    maxLength={4}
                    className="w-32 h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 font-mono focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              )}

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
                disabled={enviando || !formCompleto || cargandoTarjetas}
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
