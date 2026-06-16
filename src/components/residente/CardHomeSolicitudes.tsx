// Sprint 13 · HU-HOME-02 — Tarjeta de solicitudes activas del dashboard home.
//
// Muestra hasta 5 solicitudes activas del residente:
//   • Badge del estado actual
//   • Mini timeline con los últimos 3 cambios de estado (datos de vw_home_solicitudes)
//   • Clic en cada fila → navega a /residente/solicitudes?solicitud_id=<id>
//   • Clic en "Ver todas" → navega a /residente/solicitudes
//
// Los datos provienen de useHomeSolicitudes (vw_home_solicitudes, security_invoker).

import { Link, useNavigate } from 'react-router-dom'
import { useHomeSolicitudes, type SolicitudHome, type MiniEstado } from '../../hooks/useHomeSolicitudes'
import { labelTipo, labelCategoria } from '../../lib/solicitudes'
import { tiempoTranscurrido } from '../../lib/format'
import type { EstadoSolicitud } from '../../types/database'

// ─── Paletas de estado ────────────────────────────────────────────────────────

const ESTADO_BADGE: Record<EstadoSolicitud, string> = {
  pendiente:   'bg-accent-100 text-accent-700 border-accent-300/60',
  asignada:    'bg-primary-100 text-primary-700 border-primary-200',
  en_progreso: 'bg-primary-50 text-primary-600 border-primary-200',
  resuelta:    'bg-[#4a7c59]/15 text-[#2d5f3f] border-[#4a7c59]/25',
  cerrada:     'bg-warm-100 text-warm-400 border-warm-200',
}

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  pendiente:   'Pendiente',
  asignada:    'Asignada',
  en_progreso: 'En progreso',
  resuelta:    'Resuelta',
  cerrada:     'Cerrada',
}

// Punto del timeline: color según el estado nuevo al que transicionó
const TIMELINE_DOT: Record<EstadoSolicitud, string> = {
  pendiente:   'bg-accent-400',
  asignada:    'bg-primary-400',
  en_progreso: 'bg-primary-500',
  resuelta:    'bg-[#4a7c59]',
  cerrada:     'bg-warm-300',
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CardHomeSolicitudes() {
  const { solicitudes, loading, error } = useHomeSolicitudes()
  const navigate = useNavigate()

  // Navegación al detalle de una solicitud: reutiliza el drawer existente de
  // /residente/solicitudes vía query-param ?solicitud_id=<id>
  function irADetalle(id: string) {
    navigate(`/residente/solicitudes?solicitud_id=${id}`)
  }

  return (
    <div className="bg-white rounded-2xl border border-warm-200 border-l-4 border-l-primary-500 flex flex-col overflow-hidden">
      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-primary-900 leading-tight">
              Mis solicitudes
            </h2>
            <p className="text-xs text-warm-400 mt-0.5">
              {loading ? '…' : solicitudes.length === 0 ? 'Sin solicitudes activas' : `${solicitudes.length} activa${solicitudes.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <Link
          to="/residente/solicitudes"
          id="card-solicitudes-ver-todas"
          className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {/* ── Contenido ── */}
      <div className="flex-1 px-5 pb-5">
        {/* Error */}
        {error && (
          <p className="text-xs text-error py-4">{error}</p>
        )}

        {/* Loading skeleton */}
        {loading && !error && (
          <ul className="space-y-3 animate-pulse">
            {[1, 2].map(i => (
              <li key={i} className="rounded-xl border border-warm-100 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="h-3.5 w-32 bg-warm-100 rounded" />
                  <div className="h-5 w-20 bg-warm-100 rounded-full" />
                </div>
                <div className="h-3 w-24 bg-warm-100 rounded" />
                <div className="mt-2 space-y-1.5">
                  <div className="h-2.5 w-48 bg-warm-100 rounded" />
                  <div className="h-2.5 w-40 bg-warm-100 rounded" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {!loading && !error && solicitudes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-warm-100 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-primary-800">Todo al día</p>
            <p className="text-xs text-warm-400 mt-1">No tienes solicitudes activas en este momento.</p>
            <Link
              to="/residente/solicitudes"
              className="mt-4 text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors"
            >
              + Nueva solicitud
            </Link>
          </div>
        )}

        {/* Lista de solicitudes activas */}
        {!loading && !error && solicitudes.length > 0 && (
          <ul className="space-y-3">
            {solicitudes.map((s, idx) => (
              <li key={s.id} className={`animate-fade-in delay-${idx + 1}`}>
                <FilaSolicitud solicitud={s} onDetalle={() => irADetalle(s.id)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer CTA ── */}
      <div className="border-t border-warm-100 px-5 py-3 flex items-center justify-between">
        <Link
          to="/residente/solicitudes"
          className="text-xs font-medium text-warm-400 hover:text-primary-600 transition-colors"
        >
          Historial completo
        </Link>
        <button
          type="button"
          onClick={() => navigate('/residente/solicitudes')}
          className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          + Nueva solicitud
        </button>
      </div>
    </div>
  )
}

// ─── Fila de una solicitud activa ─────────────────────────────────────────────

function FilaSolicitud({
  solicitud, onDetalle,
}: {
  solicitud: SolicitudHome
  onDetalle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onDetalle}
      className="w-full text-left rounded-xl border border-warm-100 p-3.5 hover:border-primary-200 hover:shadow-sm transition-all group cursor-pointer"
    >
      {/* Línea 1: título + badge de estado */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="font-mono text-[0.625rem] text-warm-400">{solicitud.codigo}</span>
          <p className="text-sm font-semibold text-primary-900 truncate leading-tight">
            {labelTipo(solicitud.tipo)} · {labelCategoria(solicitud.categoria)}
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold border shrink-0 ${ESTADO_BADGE[solicitud.estado]}`}
        >
          {ESTADO_LABEL[solicitud.estado]}
        </span>
      </div>

      {/* Descripción truncada */}
      <p className="text-xs text-warm-400 line-clamp-1 mb-2.5">
        {solicitud.descripcion}
      </p>

      {/* Mini timeline de los últimos estados */}
      {solicitud.ultimos_estados.length > 0 && (
        <MiniTimeline entradas={solicitud.ultimos_estados} />
      )}

      {/* Footer: prioridad + tiempo */}
      <div className="mt-2.5 flex items-center justify-between text-[0.6875rem] text-warm-400">
        <span className="capitalize">
          {solicitud.prioridad === 'urgente'
            ? <span className="text-error font-semibold">● Urgente</span>
            : 'Normal'}
        </span>
        <span className="group-hover:text-primary-600 transition-colors">
          {tiempoTranscurrido(solicitud.updated_at)}
        </span>
      </div>
    </button>
  )
}

// ─── Mini timeline de estados ─────────────────────────────────────────────────

function MiniTimeline({ entradas }: { entradas: MiniEstado[] }) {
  return (
    <ol className="relative pl-4 space-y-1.5 border-l border-warm-200">
      {entradas.map((e, i) => (
        <li key={i} className="relative">
          {/* Punto de la línea de tiempo */}
          <span
            className={`absolute -left-[1.125rem] top-[0.3125rem] w-2 h-2 rounded-full border-2 border-white ${TIMELINE_DOT[e.estado_nuevo] ?? 'bg-warm-300'}`}
            aria-hidden="true"
          />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-semibold text-primary-800">
              {ESTADO_LABEL[e.estado_nuevo]}
            </span>
            {e.estado_anterior && (
              <span className="text-[0.625rem] text-warm-400">
                desde {ESTADO_LABEL[e.estado_anterior as EstadoSolicitud] ?? e.estado_anterior}
              </span>
            )}
            <span className="text-[0.625rem] text-warm-400 ml-auto">
              {tiempoTranscurrido(e.created_at)}
            </span>
          </div>
          {/* Nota breve del cambio (si existe, truncada) */}
          {e.nota && (
            <p className="text-[0.625rem] text-warm-400 mt-0.5 truncate">{e.nota}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
