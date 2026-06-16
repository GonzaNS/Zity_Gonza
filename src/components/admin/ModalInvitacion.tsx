import { useState, useRef } from 'react'
import { useInvitacion } from '../../hooks/useInvitacion'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { EMAIL_REGEX } from '../../lib/validators'

type Errores = Partial<Record<'email' | 'nombre' | 'rol', string>>

type Props = {
  onEnviado: (email: string) => void
  onCerrar: () => void
}

export default function ModalInvitacion({ onEnviado, onCerrar }: Props) {
  const { enviarInvitacion, cargando, error: hookError } = useInvitacion()

  const [form, setForm] = useState({
    email: '',
    nombre: '',
    // Sprint 14 · HU-EJEC-01 — 'observador' no puede invitarse desde este formulario.
    // El admin lo asigna directamente en Supabase. Usamos un subtipo explícito.
    rol: 'residente' as 'residente' | 'tecnico' | 'admin',
    piso: '',
    departamento: '',
    empresa_tercero: '',
  })
  const [errores, setErrores] = useState<Errores>({})

  useModalBehavior(onCerrar, cargando)
  // Atrapar el foco dentro del modal (accesibilidad).
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  function validar(): Errores {
    const e: Errores = {}
    if (!form.email) e.email = 'El email es requerido'
    else if (!EMAIL_REGEX.test(form.email)) e.email = 'El email es inválido'
    if (!form.nombre.trim()) e.nombre = 'El nombre es requerido'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validar()
    if (Object.keys(errs).length > 0) {
      setErrores(errs)
      return
    }
    setErrores({})

    const ok = await enviarInvitacion({
      email: form.email,
      rol: form.rol,
      nombre: form.nombre,
      piso: form.piso,
      departamento: form.departamento,
      empresa_tercero: form.rol === 'tecnico' ? form.empresa_tercero : undefined,
    })

    if (ok) onEnviado(form.email)
  }

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-invitacion-titulo"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={cargando ? undefined : onCerrar} />
      <div className="relative z-10 bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col animate-scale-in">
        <div className="sm:hidden w-10 h-1 rounded-full bg-warm-300 mx-auto mt-2.5 mb-1" />
        <div className="shrink-0 px-5 sm:px-6 pt-3 sm:pt-6 pb-3 border-b border-warm-200 flex items-center justify-between">
          <h3 id="modal-invitacion-titulo" className="font-display text-lg font-semibold text-primary-900">
            Invitar usuario
          </h3>
          <button
            onClick={onCerrar}
            disabled={cargando}
            aria-label="Cerrar"
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-warm-400 hover:text-primary-700 transition-colors rounded-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-4"
          id="form-invitacion"
        >
          {hookError && (
            <div className="p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
              {hookError}
            </div>
          )}

          <div>
            <label htmlFor="inv-email" className="block text-sm font-medium text-primary-800 mb-1.5">
              Email <span className="text-error">*</span>
            </label>
            <input
              id="inv-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="correo@ejemplo.com"
              className={`input-field ${errores.email ? 'error' : ''}`}
              aria-label="email"
            />
            {errores.email && (
              <p className="mt-1 text-xs text-error">{errores.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="inv-nombre" className="block text-sm font-medium text-primary-800 mb-1.5">
              Nombre <span className="text-error">*</span>
            </label>
            <input
              id="inv-nombre"
              type="text"
              autoComplete="given-name"
              value={form.nombre}
              onChange={e => setForm(prev => ({ ...prev, nombre: e.target.value }))}
              placeholder="Laura"
              className={`input-field ${errores.nombre ? 'error' : ''}`}
              aria-label="nombre"
            />
            {errores.nombre && (
              <p className="mt-1 text-xs text-error">{errores.nombre}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-800 mb-1.5">
              Rol <span className="text-error">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['residente', 'tecnico', 'admin'] as const).map(rol => (
                <button
                  key={rol}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, rol }))}
                  className={`min-h-11 capitalize text-sm font-medium rounded-lg border-[1.5px] transition-colors cursor-pointer ${
                    form.rol === rol
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-warm-200 text-warm-400 hover:border-primary-300 hover:text-primary-700'
                  }`}
                >
                  {rol}
                </button>
              ))}
            </div>
          </div>

          {form.rol === 'tecnico' && (
            <div>
              <label htmlFor="inv-empresa" className="block text-sm font-medium text-primary-800 mb-1.5">
                Empresa tercero <span className="text-warm-400 font-normal">(opcional)</span>
              </label>
              <input
                id="inv-empresa"
                type="text"
                value={form.empresa_tercero}
                onChange={e => setForm(prev => ({ ...prev, empresa_tercero: e.target.value }))}
                placeholder="TecnoEdif SAC"
                className="input-field"
                aria-label="empresa"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="inv-piso" className="block text-sm font-medium text-primary-800 mb-1.5">
                Piso
              </label>
              <input
                id="inv-piso"
                type="text"
                value={form.piso}
                onChange={e => setForm(prev => ({ ...prev, piso: e.target.value }))}
                placeholder="4"
                className="input-field"
              />
            </div>
            <div>
              <label htmlFor="inv-depto" className="block text-sm font-medium text-primary-800 mb-1.5">
                Departamento
              </label>
              <input
                id="inv-depto"
                type="text"
                value={form.departamento}
                onChange={e => setForm(prev => ({ ...prev, departamento: e.target.value }))}
                placeholder="4B"
                className="input-field"
              />
            </div>
          </div>
        </form>

        <div className="shrink-0 border-t border-warm-200 px-5 sm:px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row gap-3 sm:justify-end bg-white">
          <button type="button" onClick={onCerrar} disabled={cargando} className="btn-secondary sm:w-auto! sm:px-5 text-sm cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit"
            form="form-invitacion"
            disabled={cargando}
            className="btn-primary sm:w-auto! sm:px-5 text-sm cursor-pointer"
          >
            {cargando ? <span className="spinner" /> : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Enviar invitación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
