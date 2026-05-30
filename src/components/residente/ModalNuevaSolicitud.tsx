import { useMemo, useState, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCrearSolicitud } from '../../hooks/useSolicitudes'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import {
  TIPOS_SOLICITUD,
  categoriasParaTipo,
  DESCRIPCION_MAX,
  labelTipo,
  labelCategoria,
} from '../../lib/solicitudes'
import UploadFoto from './UploadFoto'
import type {
  CategoriaSolicitud,
  Solicitud,
  TipoSolicitud,
} from '../../types/database'

type Props = {
  onCreada: (solicitud: Solicitud) => void
  onCerrar: () => void
}

type Errores = Partial<Record<'tipo' | 'categoria' | 'descripcion' | 'imagen', string>>

export default function ModalNuevaSolicitud({ onCreada, onCerrar }: Props) {
  const { user, profile } = useAuth()
  const { crear, enviando, progreso, error: errorEnvio } = useCrearSolicitud()

  const [tipo, setTipo] = useState<TipoSolicitud>('mantenimiento')
  const [categoria, setCategoria] = useState<CategoriaSolicitud>('plomeria')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState<'normal' | 'urgente'>('normal')
  const [imagen, setImagen] = useState<File | null>(null)
  const [errores, setErrores] = useState<Errores>({})
  const [confirmacion, setConfirmacion] = useState<Solicitud | null>(null)

  useModalBehavior(onCerrar, enviando)
  // Atrapar el foco dentro del modal (accesibilidad).
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const categoriasDisponibles = useMemo(() => categoriasParaTipo(tipo), [tipo])

  // Cuando cambia el tipo, si la categoría actual ya no es válida en el nuevo
  // tipo (ej. plomería → sugerencia), reseteamos a la primera del listado en
  // el mismo handler. Evita el setState dentro de un effect derivado.
  function handleTipoChange(nuevoTipo: TipoSolicitud) {
    const cats = categoriasParaTipo(nuevoTipo)
    setTipo(nuevoTipo)
    if (!cats.some(c => c.value === categoria)) {
      setCategoria(cats[0]?.value ?? 'otro')
    }
  }

  const restantes = DESCRIPCION_MAX - descripcion.length
  const puedeEnviar = Boolean(imagen) && descripcion.trim().length > 0 && !enviando

  function validar(): Errores {
    const e: Errores = {}
    if (!descripcion.trim()) e.descripcion = 'Describe brevemente el problema.'
    else if (descripcion.length > DESCRIPCION_MAX)
      e.descripcion = `Máximo ${DESCRIPCION_MAX} caracteres.`
    if (!imagen) e.imagen = 'La foto del problema es obligatoria.'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !profile || !imagen) return

    const errs = validar()
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      return
    }
    setErrores({})

    const resultado = await crear({
      residente_id: user.id,
      tipo,
      categoria,
      descripcion: descripcion.trim(),
      prioridad,
      piso: profile.piso || null,
      departamento: profile.departamento || null,
      imagen,
    })

    if (resultado.ok && resultado.solicitud) {
      setConfirmacion(resultado.solicitud)
    }
  }

  function handleCerrarConfirmacion() {
    if (confirmacion) onCreada(confirmacion)
    onCerrar()
  }

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nueva-solicitud-titulo"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={enviando ? undefined : onCerrar}
      />
      <div className="relative z-10 bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-xl max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-scale-in">
        <div className="sm:hidden w-10 h-1 rounded-full bg-warm-300 mx-auto mt-2.5 mb-1" />
        <div className="shrink-0 px-5 sm:px-6 pt-3 sm:pt-6 pb-3 border-b border-warm-200 flex items-center justify-between">
          <h3 id="modal-nueva-solicitud-titulo" className="font-display text-lg font-semibold text-primary-900">
            {confirmacion ? 'Solicitud enviada' : 'Nueva solicitud'}
          </h3>
          <button
            onClick={onCerrar}
            disabled={enviando}
            aria-label="Cerrar"
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-warm-400 hover:text-primary-700 transition-colors rounded-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {confirmacion ? (
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-4">
            <div className="rounded-lg bg-success/10 border border-success/20 p-4 flex items-start gap-3">
              <svg className="w-6 h-6 text-success shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary-900">
                  Solicitud {confirmacion.codigo ?? '(sin código)'} creada
                </p>
                <p className="text-xs text-warm-400 mt-1">
                  Estado: <span className="font-medium text-primary-700">Pendiente</span>. El administrador revisará tu solicitud y te avisará cuando se asigne un técnico.
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-warm-400 mb-0.5">Tipo</dt>
                <dd className="text-primary-900">{labelTipo(confirmacion.tipo)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-warm-400 mb-0.5">Categoría</dt>
                <dd className="text-primary-900">{labelCategoria(confirmacion.categoria)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-warm-400 mb-0.5">Prioridad</dt>
                <dd className="text-primary-900 capitalize">{confirmacion.prioridad}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-warm-400 mb-0.5">Unidad</dt>
                <dd className="text-primary-900">
                  {confirmacion.piso && confirmacion.departamento
                    ? `Piso ${confirmacion.piso} — ${confirmacion.departamento}`
                    : '—'}
                </dd>
              </div>
            </dl>

            <div>
              <dt className="text-xs uppercase tracking-wider text-warm-400 mb-1">Descripción</dt>
              <dd className="text-sm text-primary-800 whitespace-pre-wrap leading-relaxed">
                {confirmacion.descripcion}
              </dd>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleCerrarConfirmacion}
                className="btn-primary sm:w-auto! sm:px-6 cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <>
            <form
              id="form-nueva-solicitud"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4"
            >
              {errorEnvio && (
                <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                  {errorEnvio}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sol-tipo" className="block text-sm font-medium text-primary-800 mb-1.5">
                    Tipo <span className="text-error">*</span>
                  </label>
                  <select
                    id="sol-tipo"
                    value={tipo}
                    onChange={e => handleTipoChange(e.target.value as TipoSolicitud)}
                    disabled={enviando}
                    className="input-field"
                  >
                    {TIPOS_SOLICITUD.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="sol-categoria" className="block text-sm font-medium text-primary-800 mb-1.5">
                    Categoría <span className="text-error">*</span>
                  </label>
                  <select
                    id="sol-categoria"
                    value={categoria}
                    onChange={e => setCategoria(e.target.value as CategoriaSolicitud)}
                    disabled={enviando}
                    className="input-field"
                  >
                    {categoriasDisponibles.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="sol-desc" className="block text-sm font-medium text-primary-800">
                    Descripción <span className="text-error">*</span>
                  </label>
                  <span
                    className={`text-xs ${restantes < 30 ? 'text-error' : 'text-warm-400'}`}
                    aria-live="polite"
                  >
                    {restantes} restantes
                  </span>
                </div>
                <textarea
                  id="sol-desc"
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value.slice(0, DESCRIPCION_MAX))}
                  placeholder="Describe brevemente el problema (qué pasó, dónde, desde cuándo)…"
                  rows={4}
                  disabled={enviando}
                  className={`input-field resize-none ${errores.descripcion ? 'error' : ''}`}
                  maxLength={DESCRIPCION_MAX}
                />
                {errores.descripcion && (
                  <p className="mt-1 text-xs text-error">{errores.descripcion}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-800 mb-2">
                  Prioridad
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['normal', 'urgente'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPrioridad(p)}
                      disabled={enviando}
                      className={`min-h-11 capitalize text-sm font-medium rounded-lg border-[1.5px] transition-colors cursor-pointer ${
                        prioridad === p
                          ? p === 'urgente'
                            ? 'border-error bg-error/10 text-error'
                            : 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-warm-200 text-warm-400 hover:border-primary-300 hover:text-primary-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg bg-warm-50 border border-warm-200 px-4 py-3">
                <p className="text-xs uppercase tracking-wider text-warm-400 mb-1">Unidad</p>
                <p className="text-sm text-primary-900">
                  {profile?.piso && profile?.departamento
                    ? `Piso ${profile.piso} — Depto. ${profile.departamento}`
                    : 'Tu unidad no está configurada. Contacta al administrador.'}
                </p>
                <p className="text-[0.6875rem] text-warm-400 mt-1">
                  Se toma de tu perfil; no se puede modificar aquí.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-800 mb-2">
                  Foto del problema <span className="text-error">*</span>
                </label>
                <UploadFoto archivo={imagen} onCambio={setImagen} disabled={enviando} />
                {errores.imagen && !imagen && (
                  <p className="mt-2 text-xs text-error">{errores.imagen}</p>
                )}
              </div>

              {enviando && (
                <div className="rounded-lg bg-primary-50 border border-primary-100 p-3 flex items-center gap-3">
                  <span className="spinner !border-primary-300 !border-t-primary-600" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary-900 font-medium">
                      {progreso < 70 ? 'Subiendo imagen…' : 'Guardando solicitud…'}
                    </p>
                    <div className="mt-1.5 h-1.5 bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 transition-all duration-300"
                        style={{ width: `${Math.max(8, progreso)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </form>

            <div className="shrink-0 border-t border-warm-200 px-5 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row gap-3 sm:justify-end bg-white">
              <button
                type="button"
                onClick={onCerrar}
                disabled={enviando}
                className="btn-secondary sm:w-auto! sm:px-5 text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-nueva-solicitud"
                disabled={!puedeEnviar}
                className="btn-primary sm:w-auto! sm:px-5 text-sm cursor-pointer"
              >
                {enviando ? <span className="spinner" /> : 'Enviar solicitud'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
