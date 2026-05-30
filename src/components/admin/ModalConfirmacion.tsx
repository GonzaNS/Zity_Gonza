import { useRef } from 'react'
import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useFocusTrap } from '../../hooks/useFocusTrap'

type Props = {
  titulo: string
  mensaje: string
  labelConfirmar: string
  variante: 'peligro' | 'primario'
  cargando: boolean
  onConfirmar: () => void
  onCancelar: () => void
}

export default function ModalConfirmacion({
  titulo,
  mensaje,
  labelConfirmar,
  variante,
  cargando,
  onConfirmar,
  onCancelar,
}: Props) {
  useModalBehavior(onCancelar, cargando)
  // Atrapar el foco dentro del modal (accesibilidad).
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-confirmacion-titulo"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={cargando ? undefined : onCancelar}
      />
      <div className="relative z-10 bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md p-5 sm:p-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-6 animate-scale-in">
        {/* Grabber para look mobile */}
        <div className="sm:hidden w-10 h-1 rounded-full bg-warm-300 mx-auto mb-4" />
        <h3 id="modal-confirmacion-titulo" className="font-display text-lg font-semibold text-primary-900 mb-2">
          {titulo}
        </h3>
        <p className="text-sm text-warm-400 leading-relaxed mb-6">{mensaje}</p>
        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancelar}
            disabled={cargando}
            className="btn-secondary sm:w-auto! sm:px-6 text-sm cursor-pointer"
          >
            Cancelar
          </button>
          {variante === 'peligro' ? (
            <button
              onClick={onConfirmar}
              disabled={cargando}
              className="flex items-center justify-center gap-2 w-full sm:w-auto min-w-[8rem] px-6 py-3 sm:py-2.5 text-sm font-semibold rounded-lg bg-error text-white shadow-[0_2px_8px_rgba(200,75,49,0.25)] hover:bg-error/90 hover:shadow-[0_4px_16px_rgba(200,75,49,0.35)] active:translate-y-0 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargando ? <span className="spinner" /> : labelConfirmar}
            </button>
          ) : (
            <button
              onClick={onConfirmar}
              disabled={cargando}
              className="btn-primary sm:w-auto! sm:px-6 min-w-[8rem] text-sm cursor-pointer"
            >
              {cargando ? <span className="spinner" /> : labelConfirmar}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
