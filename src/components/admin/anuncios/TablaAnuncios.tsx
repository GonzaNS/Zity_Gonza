// Sprint 12 · HU-ANUNCIO-02 — Listado de comunicados para el admin.
//
// Muestra todos los anuncios (vigentes, vencidos y archivados) con sus badges
// de categoría/prioridad y chips de estado, más las acciones: editar, fijar /
// desfijar y archivar / restaurar (baja lógica, nunca DELETE).

import {
  labelCategoria,
  BADGE_CATEGORIA,
  BADGE_PRIORIDAD,
  esPdf,
  extracto,
  hoyLimaISO,
  type Anuncio,
} from '../../../lib/anuncios'
import { tiempoTranscurrido } from '../../../lib/format'

type Props = {
  anuncios: Anuncio[]
  adjuntos: Map<string, string>
  onEditar: (a: Anuncio) => void
  onArchivar: (a: Anuncio) => void
  onFijar: (a: Anuncio) => void
  procesandoId: string | null
}

export default function TablaAnuncios({ anuncios, adjuntos, onEditar, onArchivar, onFijar, procesandoId }: Props) {
  const hoy = hoyLimaISO()

  return (
    <ul className="space-y-3">
      {anuncios.map(a => {
        const vencido = !a.archivado && !!a.vigente_hasta && a.vigente_hasta < hoy
        const procesando = procesandoId === a.id
        const adjuntoUrl = a.imagen_url ? adjuntos.get(a.imagen_url) : undefined

        return (
          <li
            key={a.id}
            className={`bg-white rounded-xl border p-4 sm:p-5 transition-colors ${
              a.archivado ? 'border-warm-200 opacity-70' : 'border-warm-200 hover:border-primary-300'
            }`}
          >
            <div className="flex items-start gap-4">
              {/* Miniatura del adjunto (si es imagen) */}
              {adjuntoUrl && !esPdf(a.imagen_url) && (
                <img src={adjuntoUrl} alt="" className="hidden sm:block w-16 h-16 rounded-lg object-cover border border-warm-200 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {a.fijado && !a.archivado && (
                    <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-primary-700">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.5 2a1 1 0 011 1v6.5l2.6 2.6a1 1 0 01.29.7V14a1 1 0 01-1 1h-3v3a1 1 0 11-2 0v-3h-3a1 1 0 01-1-1v-1.2a1 1 0 01.3-.7L6.5 9.5V3a1 1 0 011-1h2z" /></svg>
                      Fijado
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
                  {a.archivado && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold bg-warm-200 text-warm-500">Archivado</span>
                  )}
                  {vencido && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-semibold bg-warm-100 text-warm-400 border border-warm-200">Vencido</span>
                  )}
                  {esPdf(a.imagen_url) && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.65rem] font-medium bg-error/10 text-error">PDF</span>
                  )}
                </div>

                <h3 className="font-medium text-primary-900 truncate">{a.titulo}</h3>
                <p className="mt-0.5 text-sm text-warm-400 line-clamp-2">{extracto(a.cuerpo)}</p>
                <p className="mt-1.5 text-xs text-warm-400">
                  {tiempoTranscurrido(a.created_at)}
                  {a.vigente_hasta && !vencido && !a.archivado && ` · vigente hasta ${a.vigente_hasta}`}
                </p>
              </div>

              {/* Acciones */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onEditar(a)}
                  className="text-xs font-medium text-primary-600 hover:text-primary-800 px-2 py-1 rounded hover:bg-primary-50 transition-colors cursor-pointer"
                >
                  Editar
                </button>
                {!a.archivado && (
                  <button
                    type="button"
                    onClick={() => onFijar(a)}
                    disabled={procesando}
                    className="text-xs font-medium text-warm-500 hover:text-primary-700 px-2 py-1 rounded hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {a.fijado ? 'Desfijar' : 'Fijar'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onArchivar(a)}
                  disabled={procesando}
                  className={`text-xs font-medium px-2 py-1 rounded transition-colors cursor-pointer disabled:opacity-50 ${
                    a.archivado ? 'text-success hover:bg-success/10' : 'text-error hover:bg-error/10'
                  }`}
                >
                  {a.archivado ? 'Restaurar' : 'Archivar'}
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
