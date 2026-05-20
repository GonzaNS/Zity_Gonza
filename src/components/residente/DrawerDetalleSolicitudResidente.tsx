// HU-MANT-05 SPRINT-4
// Drawer de detalle de una solicitud para el residente.
// Muestra foto, estado, descripción, y el historial de estados reutilizable
// con privacidad de autor para rol=residente.

import { useModalBehavior } from '../../hooks/useModalBehavior'
import { useAuth } from '../../contexts/AuthContext'
import { labelCategoria, labelTipo } from '../../lib/solicitudes'
import { tiempoTranscurrido } from '../../lib/format'
// HU-MANT-05 SPRINT-4 — Historial reutilizable
import HistorialEstados from '../shared/HistorialEstados'
import type { Solicitud, EstadoSolicitud } from '../../types/database'

// ─── Badges ──────────────────────────────────────────────────────────────────

const BADGE_ESTADO: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-accent-100 text-accent-700 border-accent-300/60',
  asignada: 'bg-primary-100 text-primary-700 border-primary-200',
  en_progreso: 'bg-primary-50 text-primary-600 border-primary-200',
  resuelta: 'bg-[#4a7c59]/15 text-[#2d5f3f] border-[#4a7c59]/25',
  cerrada: 'bg-warm-100 text-warm-400 border-warm-200',
}

const BADGE_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_progreso: 'En progreso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  solicitud: Solicitud
  fotoUrl: string | undefined
  onCerrar: () => void
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function DrawerDetalleSolicitudResidente({
  solicitud,
  fotoUrl,
  onCerrar,
}: Props) {
  // HU-MANT-05 SPRINT-4 — userId para la privacidad del autor en el historial
  const { user } = useAuth()
  useModalBehavior(onCerrar, false)

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-residente-titulo"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Fondo */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onCerrar}
      />

      <aside className="relative z-10 bg-white shadow-2xl w-full sm:w-[32rem] lg:w-[36rem] max-w-full h-full flex flex-col animate-fade-in-right">

        {/* Cabecera */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-warm-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-warm-400">{solicitud.codigo}</p>
            <h3
              id="drawer-residente-titulo"
              className="font-display text-lg font-semibold text-primary-900 truncate"
            >
              {labelTipo(solicitud.tipo)} · {labelCategoria(solicitud.categoria)}
            </h3>
          </div>
          <button
            onClick={onCerrar}
            aria-label="Cerrar detalle"
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-warm-400 hover:text-primary-700 transition-colors rounded-md cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">

          {/* Foto */}
          {solicitud.imagen_url && (
            <div className="rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt={`Foto de la solicitud ${solicitud.codigo}`}
                  className="w-full max-h-[24rem] object-contain bg-warm-100"
                />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center text-warm-400 text-sm">
                  Cargando foto…
                </div>
              )}
            </div>
          )}

          {/* Estado y prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Estado</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border ${BADGE_ESTADO[solicitud.estado]}`}>
                {BADGE_LABEL[solicitud.estado]}
              </span>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Prioridad</p>
              <span className={`text-sm font-semibold capitalize ${solicitud.prioridad === 'urgente' ? 'text-error' : 'text-primary-700'}`}>
                {solicitud.prioridad}
              </span>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Enviada</p>
              <p className="text-sm text-primary-900">{tiempoTranscurrido(solicitud.created_at)}</p>
            </div>
            {(solicitud.piso || solicitud.departamento) && (
              <div>
                <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Unidad</p>
                <p className="text-sm text-primary-900">
                  {solicitud.piso && solicitud.departamento
                    ? `Piso ${solicitud.piso} — ${solicitud.departamento}`
                    : '—'}
                </p>
              </div>
            )}
          </div>

          {/* Descripción */}
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-1">Descripción</p>
            <p className="text-sm text-primary-800 whitespace-pre-wrap leading-relaxed">
              {solicitud.descripcion}
            </p>
          </div>

          {/* Historial */}
          {/* HU-MANT-05 SPRINT-4 — Historial con privacidad para rol=residente */}
          <div className="border-t border-warm-200 pt-5">
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-3">
              Historial de estados
            </p>
            <HistorialEstados
              solicitudId={solicitud.id}
              rolObservador="residente"
              userId={user?.id ?? ''}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}
