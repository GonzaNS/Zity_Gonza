// Sprint 12 · HU-ANUNCIO-03 — Detalle de un comunicado para el residente.
//
// Panel lateral con el cuerpo (markdown sanitizado, MarkdownSeguro) y el adjunto
// (imagen embebida o enlace al PDF). Abrir el detalle ya registró la lectura
// (la página llama marcarLeido); aquí solo se muestra el comunicado completo.

import { useRef } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import {
  labelCategoria,
  BADGE_CATEGORIA,
  BADGE_PRIORIDAD,
  esPdf,
  type AnuncioConLectura,
} from '../../../lib/anuncios'
import { tiempoTranscurrido } from '../../../lib/format'
import MarkdownSeguro from '../../shared/MarkdownSeguro'

type Props = {
  anuncio: AnuncioConLectura
  adjuntoUrl?: string
  onCerrar: () => void
}

export default function DrawerAnuncio({ anuncio: a, adjuntoUrl, onCerrar }: Props) {
  useModalBehavior(onCerrar, false)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const adjuntoEsPdf = esPdf(a.imagen_url)

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={onCerrar}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={a.titulo}
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-2xl animate-fade-in-right flex flex-col"
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-warm-100">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${BADGE_CATEGORIA[a.categoria]}`}>
              {labelCategoria(a.categoria)}
            </span>
            {BADGE_PRIORIDAD[a.prioridad] && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${BADGE_PRIORIDAD[a.prioridad]!.clases}`}>
                {BADGE_PRIORIDAD[a.prioridad]!.label}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <h2 className="font-display text-xl font-semibold text-primary-900 leading-snug">{a.titulo}</h2>
          <p className="mt-1 text-xs text-warm-400">Publicado {tiempoTranscurrido(a.created_at)}</p>

          {/* Adjunto */}
          {adjuntoUrl && (
            adjuntoEsPdf ? (
              <a
                href={adjuntoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center gap-3 p-3 rounded-lg border border-warm-200 bg-warm-50 hover:border-primary-300 transition-colors"
              >
                <span className="w-10 h-10 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-sm font-medium text-primary-800">Abrir documento adjunto (PDF)</span>
              </a>
            ) : (
              <img src={adjuntoUrl} alt="Adjunto del comunicado" className="mt-4 w-full rounded-lg border border-warm-200" />
            )
          )}

          {/* Cuerpo markdown sanitizado */}
          <div className="mt-4 text-sm text-primary-800">
            <MarkdownSeguro>{a.cuerpo}</MarkdownSeguro>
          </div>
        </div>

        {/* Pie */}
        <div className="px-5 py-3 border-t border-warm-100 flex items-center gap-2 text-xs text-success">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Marcado como leído
        </div>
      </section>
    </>
  )
}
