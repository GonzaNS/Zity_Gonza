// HU-MANT-03 SPRINT-4
// HU-MANT-04 SPRINT-4 — Añade sección de actualización de estado
// HU-MANT-05 SPRINT-4 — Reemplaza historial inline por componente reutilizable

import { useRef } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { labelCategoria, labelTipo } from '../../../lib/solicitudes'
import { tiempoTranscurrido } from '../../../lib/format'
// HU-MANT-04 SPRINT-4 — Sección de actualización de estado del técnico
import SeccionActualizarEstado from './SeccionActualizarEstado'
// HU-MANT-05 SPRINT-4 — Componente reutilizable de historial
import HistorialEstados from '../../shared/HistorialEstados'
import { useAuth } from '../../../contexts/AuthContext'
import type { SolicitudAsignadaTecnico } from '../../../hooks/useSolicitudesTecnico'

// ─── Badges inline ───────────────────────────────────────────────────────────

function BadgePrioridad({ prioridad }: { prioridad: string }) {
  const esUrgente = prioridad === 'urgente'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${esUrgente
        ? 'bg-error/10 text-error border border-error/20'
        : 'bg-primary-50 text-primary-600 border border-primary-200'
      }`}>
      {esUrgente ? 'Urgente' : 'Normal'}
    </span>
  )
}

function BadgeEstado({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    asignada: 'bg-accent-100 text-accent-700 border-accent-200',
    en_progreso: 'bg-primary-100 text-primary-700 border-primary-200',
    resuelta: 'bg-success/10 text-success border-success/20',
  }
  const labels: Record<string, string> = {
    asignada: 'Asignada',
    en_progreso: 'En progreso',
    resuelta: 'Resuelta',
  }
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${map[estado] ?? 'bg-warm-100 text-warm-400 border-warm-200'}`}>
      {labels[estado] ?? estado}
    </span>
  )
}

// ─── Componente principal ────────────────────────────────────────────────────

type Props = {
  solicitud: SolicitudAsignadaTecnico
  fotoUrl: string | undefined
  onCerrar: () => void
  // HU-MANT-04 SPRINT-4 — Callback para refetch tras cambio de estado
  onEstadoActualizado: () => void
}

export default function DrawerDetalleTecnico({ solicitud, fotoUrl, onCerrar, onEstadoActualizado }: Props) {
  // HU-MANT-05 SPRINT-4 — userId para la privacidad del autor en el historial
  const { user } = useAuth()

  useModalBehavior(onCerrar, false)
  // Atrapar el foco dentro del drawer (accesibilidad).
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const unidad =
    solicitud.piso && solicitud.departamento
      ? `Piso ${solicitud.piso} — ${solicitud.departamento}`
      : solicitud.residente?.piso && solicitud.residente?.departamento
        ? `Piso ${solicitud.residente.piso} — ${solicitud.residente.departamento}`
        : '—'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-tecnico-titulo"
      className="fixed inset-0 z-50 flex justify-end"
    >
      {/* Fondo */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onCerrar}
      />

      <aside ref={panelRef} className="relative z-10 bg-white shadow-2xl w-full sm:w-[32rem] lg:w-[36rem] max-w-full h-full flex flex-col animate-fade-in-right">
        {/* Cabecera */}
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-warm-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-warm-400">{solicitud.codigo}</p>
            <h3 id="drawer-tecnico-titulo" className="font-display text-lg font-semibold text-primary-900 truncate">
              {labelTipo(solicitud.tipo as never)} · {labelCategoria(solicitud.categoria as never)}
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

          {/* Foto en grande */}
          {/* HU-MANT-03 SPRINT-4 — Foto completa al abrir el detalle */}
          {solicitud.imagen_url && (
            <div className="rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
              {fotoUrl ? (
                <img
                  src={fotoUrl}
                  alt={`Foto de la solicitud ${solicitud.codigo}`}
                  className="w-full max-h-[28rem] object-contain bg-warm-100"
                />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center text-warm-400 text-sm">
                  Cargando foto…
                </div>
              )}
            </div>
          )}

          {/* Badges estado y prioridad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Estado</p>
              <BadgeEstado estado={solicitud.estado} />
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Prioridad</p>
              <BadgePrioridad prioridad={solicitud.prioridad} />
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Unidad</p>
              <p className="text-sm text-primary-900">{unidad}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Asignada</p>
              <p className="text-sm text-primary-900">
                {solicitud.fecha_asignacion
                  ? tiempoTranscurrido(solicitud.fecha_asignacion)
                  : tiempoTranscurrido(solicitud.created_at)}
              </p>
            </div>
          </div>

          {/* Descripción completa */}
          <div>
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-1">Descripción</p>
            <p className="text-sm text-primary-800 whitespace-pre-wrap leading-relaxed">
              {solicitud.descripcion}
            </p>
          </div>

          {/* Nota del admin */}
          {/* HU-MANT-03 SPRINT-4 — Nota de asignación del admin visible al técnico */}
          {solicitud.nota_admin && (
            <div className="border-t border-warm-200 pt-5">
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-2">
                Nota del administrador
              </p>
              <div className="bg-accent-50 border border-accent-200 rounded-lg px-4 py-3">
                <p className="text-sm text-accent-900 leading-relaxed">{solicitud.nota_admin}</p>
              </div>
            </div>
          )}

          {/* Datos del residente */}
          {/* HU-MANT-03 SPRINT-4 — Nombre, depto y teléfono del residente */}
          {solicitud.residente && (
            <div className="border-t border-warm-200 pt-5">
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-2">
                Residente
              </p>
              <div className="space-y-1 text-sm">
                <p className="font-medium text-primary-900">
                  {solicitud.residente.nombre} {solicitud.residente.apellido}
                </p>
                <p className="text-warm-400 text-xs">{solicitud.residente.email}</p>
                {solicitud.residente.telefono && (
                  <p className="text-warm-400 text-xs flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {solicitud.residente.telefono}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Actualizar estado */}
          {/* HU-MANT-04 SPRINT-4 — Sección de transición de estado para el técnico */}
          <SeccionActualizarEstado
            solicitudId={solicitud.id}
            residenteId={solicitud.residente_id}
            estadoActual={solicitud.estado}
            onEstadoActualizado={onEstadoActualizado}
          />

          {/* Historial de estados */}
          {/* HU-MANT-05 SPRINT-4 — Componente reutilizable con autor, badges, paginación */}
          <div className="border-t border-warm-200 pt-5">
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-3">
              Historial de estados
            </p>
            <HistorialEstados
              solicitudId={solicitud.id}
              rolObservador="tecnico"
              userId={user?.id ?? ''}
              fotoOriginalUrl={fotoUrl}
            />
          </div>
        </div>
      </aside>
    </div>
  )
}
