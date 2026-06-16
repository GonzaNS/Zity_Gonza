// Sprint 13 · HU-PAGO-02 — Panel 'Mis tarjetas' del perfil del residente.
//
// Muestra:
//   • Lista de tarjetas tokenizadas: **** 1234 · Marca · Vence MM/YY · ★ predeterminada
//   • Formulario de alta: alias, titular, número (máscara + Luhn + detección de marca),
//     expiración, CVV (se pide pero NO se persiste)
//   • Acciones: marcar predeterminada, eliminar (con confirmación)
//
// Política no-PII:
//   • El PAN se formatea solo para la UI (máscara de grupos de 4).
//   • El CVV nunca se almacena ni se registra.
//   • Tras tokenizar, el PAN desaparece del estado del componente.

import { useState } from 'react'
import { useMetodosPago, type FormTarjeta } from '../../hooks/useMetodosPago'
import {
  mascaraTarjeta,
  formatearExpiracion,
  detectarMarca,
  luhnValido,
  LABEL_MARCA,
  COLOR_MARCA,
  type TarjetaMarca,
} from '../../lib/metodos-pago'
import type { MetodoPago } from '../../lib/metodos-pago'

// ─── Constantes ───────────────────────────────────────────────────────────────

const ANIO_ACTUAL = new Date().getFullYear()
const MESES = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1
  return { value: String(m).padStart(2, '0'), label: `${String(m).padStart(2, '0')} – ${new Intl.DateTimeFormat('es', { month: 'long' }).format(new Date(2000, i, 1))}` }
})

const FORM_INICIAL: FormTarjeta = {
  alias: '', titular: '', pan: '', expMes: '01',
  expAnio: String(ANIO_ACTUAL), cvv: '', predeterminada: false,
}

// ─── Icono de marca ───────────────────────────────────────────────────────────

function ChipMarca({ marca }: { marca: TarjetaMarca }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[0.6rem] font-bold text-white tracking-wider uppercase ${COLOR_MARCA[marca]}`}>
      {LABEL_MARCA[marca]}
    </span>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MisTarjetas() {
  const { tarjetas, loading, error, guardando, agregarTarjeta, establecerPredeterminada, eliminarTarjeta } = useMetodosPago()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormTarjeta>(FORM_INICIAL)
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirmEliminar, setConfirmEliminar] = useState<string | null>(null) // id a eliminar

  // Pan formateado en grupos de 4 para la UI
  const panFormateado = form.pan.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim().slice(0, 19)
  const marcaDetectada: TarjetaMarca = detectarMarca(form.pan)
  const panValido = luhnValido(form.pan)
  const digitosPan = form.pan.replace(/\D/g, '')

  function mostrarToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function handlePanChange(raw: string) {
    // Solo dígitos, máx 16/19 (Amex 15)
    const soloDigitos = raw.replace(/\D/g, '').slice(0, 19)
    setForm(f => ({ ...f, pan: soloDigitos }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (!form.alias.trim())    return setFormError('El alias es obligatorio.')
    if (!form.titular.trim())  return setFormError('El nombre del titular es obligatorio.')
    if (digitosPan.length < 13) return setFormError('Ingresa el número de tarjeta completo.')
    if (!panValido)            return setFormError('Número de tarjeta inválido. Verifica los dígitos.')
    if (!form.cvv.trim())      return setFormError('Ingresa el CVV.')
    const mes = parseInt(form.expMes, 10)
    const anio = parseInt(form.expAnio, 10)
    if (anio < ANIO_ACTUAL || (anio === ANIO_ACTUAL && mes < new Date().getMonth() + 1)) {
      return setFormError('La tarjeta ha expirado.')
    }

    const result = await agregarTarjeta({ ...form })
    if (!result.ok) {
      setFormError(result.error ?? 'Error al guardar la tarjeta.')
      return
    }

    setForm(FORM_INICIAL)
    setMostrarForm(false)
    mostrarToast('Tarjeta guardada correctamente.')
  }

  async function handlePredeterminada(id: string) {
    const result = await establecerPredeterminada(id)
    if (!result.ok) mostrarToast(`Error: ${result.error}`)
    else mostrarToast('Tarjeta predeterminada actualizada.')
  }

  async function handleEliminar() {
    if (!confirmEliminar) return
    const result = await eliminarTarjeta(confirmEliminar)
    setConfirmEliminar(null)
    if (!result.ok) mostrarToast(`Error: ${result.error}`)
    else mostrarToast('Tarjeta eliminada.')
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-primary-900">Mis tarjetas</h3>
          <p className="text-xs text-warm-400 mt-0.5">
            Solo guardamos los últimos 4 dígitos y un token seguro. Nunca el número completo ni el CVV.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setMostrarForm(v => !v); setFormError(null) }}
          className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d={mostrarForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
          </svg>
          {mostrarForm ? 'Cancelar' : 'Agregar tarjeta'}
        </button>
      </div>

      {/* Formulario de alta */}
      {mostrarForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-warm-200 bg-warm-50 p-5 space-y-4 animate-fade-in"
          noValidate
        >
          <p className="text-xs font-semibold text-primary-900 uppercase tracking-wider">Nueva tarjeta</p>

          {/* Número de tarjeta + detección de marca */}
          <div>
            <label htmlFor="mp-pan" className="block text-sm font-medium text-primary-900 mb-1.5">
              Número de tarjeta
              {digitosPan.length > 5 && (
                <ChipMarca marca={marcaDetectada} />
              )}
            </label>
            <div className="relative">
              <input
                id="mp-pan"
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={panFormateado}
                onChange={e => handlePanChange(e.target.value)}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                required
                aria-describedby="mp-pan-hint"
                className={`w-full h-11 px-3 pr-10 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                  digitosPan.length >= 13 && !panValido
                    ? 'border-error bg-error/5 text-error'
                    : 'border-warm-300 text-primary-900'
                }`}
              />
              {/* Indicador Luhn */}
              {digitosPan.length >= 13 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {panValido
                    ? <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : <svg className="w-4 h-4 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  }
                </div>
              )}
            </div>
            <p id="mp-pan-hint" className="text-[0.625rem] text-warm-400 mt-1">
              El número se valida localmente (Luhn) y se tokeniza — nunca se envía al servidor.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Titular */}
            <div>
              <label htmlFor="mp-titular" className="block text-sm font-medium text-primary-900 mb-1.5">
                Nombre del titular
              </label>
              <input
                id="mp-titular"
                type="text"
                autoComplete="cc-name"
                value={form.titular}
                onChange={e => setForm(f => ({ ...f, titular: e.target.value }))}
                placeholder="JUAN PÉREZ"
                required
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 uppercase"
              />
            </div>

            {/* Alias */}
            <div>
              <label htmlFor="mp-alias" className="block text-sm font-medium text-primary-900 mb-1.5">
                Alias
              </label>
              <input
                id="mp-alias"
                type="text"
                value={form.alias}
                onChange={e => setForm(f => ({ ...f, alias: e.target.value }))}
                placeholder="Mi Visa personal"
                maxLength={50}
                required
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Mes expiración */}
            <div>
              <label htmlFor="mp-exp-mes" className="block text-sm font-medium text-primary-900 mb-1.5">
                Mes
              </label>
              <select
                id="mp-exp-mes"
                value={form.expMes}
                onChange={e => setForm(f => ({ ...f, expMes: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                {MESES.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Año expiración */}
            <div>
              <label htmlFor="mp-exp-anio" className="block text-sm font-medium text-primary-900 mb-1.5">
                Año
              </label>
              <select
                id="mp-exp-anio"
                value={form.expAnio}
                onChange={e => setForm(f => ({ ...f, expAnio: e.target.value }))}
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => ANIO_ACTUAL + i).map(y => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* CVV */}
            <div>
              <label htmlFor="mp-cvv" className="block text-sm font-medium text-primary-900 mb-1.5">
                CVV
                <span className="ml-1 text-[0.625rem] text-warm-400 font-normal">(no se guarda)</span>
              </label>
              <input
                id="mp-cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                value={form.cvv}
                onChange={e => setForm(f => ({ ...f, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                placeholder="•••"
                maxLength={4}
                required
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Predeterminada */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.predeterminada}
              onChange={e => setForm(f => ({ ...f, predeterminada: e.target.checked }))}
              className="w-4 h-4 rounded border-warm-300 text-primary-600 cursor-pointer"
            />
            <span className="text-sm text-primary-900">Establecer como tarjeta predeterminada</span>
          </label>

          {/* Error de formulario */}
          {formError && (
            <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
              {formError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setMostrarForm(false); setForm(FORM_INICIAL); setFormError(null) }}
              className="h-10 px-4 rounded-lg border border-warm-300 text-sm text-warm-600 hover:bg-warm-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="h-10 px-5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {guardando && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Guardar tarjeta
            </button>
          </div>
        </form>
      )}

      {/* Error global */}
      {error && (
        <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">{error}</div>
      )}

      {/* Skeleton */}
      {loading && (
        <ul className="space-y-3 animate-pulse">
          {[1, 2].map(i => (
            <li key={i} className="rounded-xl border border-warm-200 p-4 flex items-center gap-4">
              <div className="w-12 h-8 bg-warm-100 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-40 bg-warm-100 rounded" />
                <div className="h-3 w-24 bg-warm-100 rounded" />
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Empty state */}
      {!loading && !error && tarjetas.length === 0 && !mostrarForm && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-warm-100 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-primary-800">Sin tarjetas guardadas</p>
          <p className="text-xs text-warm-400 mt-1">Agrega una tarjeta para pagar más rápido.</p>
        </div>
      )}

      {/* Lista de tarjetas */}
      {!loading && tarjetas.length > 0 && (
        <ul className="space-y-3">
          {tarjetas.map((t) => (
            <TarjetaItem
              key={t.id}
              tarjeta={t}
              guardando={guardando}
              onPredeterminada={() => handlePredeterminada(t.id)}
              onEliminar={() => setConfirmEliminar(t.id)}
            />
          ))}
        </ul>
      )}

      {/* Modal de confirmación de eliminación */}
      {confirmEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-primary-900">¿Eliminar tarjeta?</h3>
            <p className="text-sm text-warm-500 mt-1">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setConfirmEliminar(null)}
                className="flex-1 h-10 rounded-lg border border-warm-300 text-sm text-warm-600 hover:bg-warm-100 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEliminar}
                disabled={guardando}
                className="flex-1 h-10 rounded-lg bg-error text-white text-sm font-medium hover:bg-error/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {guardando ? '...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in">
          ✓ {toast}
        </div>
      )}
    </div>
  )
}

// ─── Item de tarjeta ──────────────────────────────────────────────────────────

function TarjetaItem({
  tarjeta, guardando, onPredeterminada, onEliminar,
}: {
  tarjeta: MetodoPago
  guardando: boolean
  onPredeterminada: () => void
  onEliminar: () => void
}) {
  return (
    <li className={`rounded-xl border p-4 flex items-start gap-4 transition-colors ${
      tarjeta.predeterminada
        ? 'border-primary-300 bg-primary-50/50'
        : 'border-warm-200 bg-white hover:border-warm-300'
    }`}>
      {/* Número y marca */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-mono text-sm font-semibold text-primary-900">
            {mascaraTarjeta(tarjeta.ultimos4)}
          </p>
          <ChipMarca marca={tarjeta.marca} />
          {tarjeta.predeterminada && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-semibold bg-primary-100 text-primary-700 border border-primary-200">
              ★ Predeterminada
            </span>
          )}
        </div>
        <p className="text-xs text-warm-500 mt-0.5">
          {tarjeta.alias} · Titular: {tarjeta.titular} · Vence {formatearExpiracion(tarjeta.exp_mes, tarjeta.exp_anio)}
        </p>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-2 shrink-0">
        {!tarjeta.predeterminada && (
          <button
            type="button"
            onClick={onPredeterminada}
            disabled={guardando}
            title="Marcar como predeterminada"
            className="h-8 w-8 rounded-lg border border-warm-300 flex items-center justify-center text-warm-400 hover:text-primary-600 hover:border-primary-300 transition-colors cursor-pointer disabled:opacity-40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onEliminar}
          disabled={guardando}
          title="Eliminar tarjeta"
          className="h-8 w-8 rounded-lg border border-warm-300 flex items-center justify-center text-warm-400 hover:text-error hover:border-error/40 transition-colors cursor-pointer disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  )
}
