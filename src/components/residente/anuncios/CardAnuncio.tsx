// Sprint 12 · HU-ANUNCIO-03 — Tarjeta de un comunicado en el feed del residente.
//
// Muestra título, categoría (color), prioridad, fecha y extracto; badge 'Nuevo'
// si el residente aún no lo ha leído. Los fijados se distinguen con un borde.

import {
  labelCategoria,
  BADGE_CATEGORIA,
  BADGE_PRIORIDAD,
  esPdf,
  extracto,
  type AnuncioConLectura,
} from '../../../lib/anuncios'
import { tiempoTranscurrido } from '../../../lib/format'

type Props = {
  anuncio: AnuncioConLectura
  adjuntoUrl?: string
  onAbrir: (a: AnuncioConLectura) => void
}

export default function CardAnuncio({ anuncio: a, adjuntoUrl, onAbrir }: Props) {
  const tieneImagen = !!adjuntoUrl && !esPdf(a.imagen_url)

  return (
    <li
      onClick={() => onAbrir(a)}
      className={`bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-all cursor-pointer ${
        a.fijado ? 'border-primary-300 ring-1 ring-primary-100' : 'border-warm-200 hover:border-primary-300'
      }`}
    >
      {tieneImagen && (
        <div className="aspect-[16/9] bg-warm-100 overflow-hidden">
          <img src={adjuntoUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {a.fijado && (
              <span className="text-primary-600" title="Fijado" aria-label="Fijado">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.5 2a1 1 0 011 1v6.5l2.6 2.6a1 1 0 01.29.7V14a1 1 0 01-1 1h-3v3a1 1 0 11-2 0v-3h-3a1 1 0 01-1-1v-1.2a1 1 0 01.3-.7L6.5 9.5V3a1 1 0 011-1h2z" /></svg>
              </span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${BADGE_CATEGORIA[a.categoria]}`}>
              {labelCategoria(a.categoria)}
            </span>
            {BADGE_PRIORIDAD[a.prioridad] && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold border ${BADGE_PRIORIDAD[a.prioridad]!.clases}`}>
                {BADGE_PRIORIDAD[a.prioridad]!.label}
              </span>
            )}
          </div>
          {!a.leido && (
            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-bold bg-primary-600 text-white uppercase tracking-wide">
              Nuevo
            </span>
          )}
        </div>

        <h3 className="font-medium text-primary-900">{a.titulo}</h3>
        <p className="mt-1 text-sm text-warm-400 line-clamp-2">{extracto(a.cuerpo)}</p>

        <div className="mt-3 flex items-center justify-between text-xs text-warm-400">
          <span>{tiempoTranscurrido(a.created_at)}</span>
          {esPdf(a.imagen_url) && (
            <span className="inline-flex items-center gap-1 text-error font-medium">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              PDF
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
