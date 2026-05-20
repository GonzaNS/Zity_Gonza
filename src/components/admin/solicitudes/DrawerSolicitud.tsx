// HU-MANT-02 SPRINT-4
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { type SolicitudConResidente } from '../../../hooks/useSolicitudesAdmin'
import { actualizarPrioridadSolicitud } from '../../../hooks/useSolicitudes'
import { labelCategoria, labelTipo } from '../../../lib/solicitudes'
import { tiempoTranscurrido } from '../../../lib/format'
import { BadgeEstadoSolicitud, BadgePrioridad } from './BadgeSolicitud'
// HU-MANT-02 SPRINT-4 — Modal de asignación de técnico
import ModalAsignarTecnico from './ModalAsignarTecnico'
// HU-MANT-05 SPRINT-4 — Componente reutilizable de historial de estados
import HistorialEstados from '../../shared/HistorialEstados'
import { useAuth } from '../../../contexts/AuthContext'

type Props = {
  solicitud: SolicitudConResidente
  fotoUrl: string | undefined
  onCerrar: () => void
  onPrioridadActualizada: () => void
  // HU-MANT-02 SPRINT-4 — Callback que dispara refetch tras asignar/reasignar
  onAsignacionRealizada: () => void
}

export default function DrawerSolicitud({ solicitud, fotoUrl, onCerrar, onPrioridadActualizada, onAsignacionRealizada }: Props) {
  // HU-MANT-05 SPRINT-4 — userId para la privacidad del autor en el historial
  const { user } = useAuth()

  // La prioridad la leemos directamente de la prop. Tras un cambio exitoso,
  // disparamos onPrioridadActualizada() — el padre hace refetch y nos vuelve
  // a renderizar con la prioridad nueva ya en `solicitud.prioridad`.
  const prioridadActual = solicitud.prioridad
  const [actualizando, setActualizando] = useState(false)
  const [errorPrioridad, setErrorPrioridad] = useState<string | null>(null)
  // HU-MANT-02 SPRINT-4 — Controla la apertura del modal de asignación
  const [modalAsignarAbierto, setModalAsignarAbierto] = useState(false)

  useModalBehavior(onCerrar, actualizando)

  async function handleCambiarPrioridad(nueva: 'normal' | 'urgente') {
    if (nueva === prioridadActual || actualizando) return
    setActualizando(true)
    setErrorPrioridad(null)
    const { ok, error } = await actualizarPrioridadSolicitud(solicitud.id, nueva)
    setActualizando(false)
    if (!ok) {
      setErrorPrioridad(error ?? 'No pudimos actualizar la prioridad')
      return
    }
    onPrioridadActualizada()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-solicitud-titulo"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={actualizando ? undefined : onCerrar}
      />
      <aside className="relative z-10 bg-white shadow-2xl w-full sm:w-[32rem] lg:w-[36rem] max-w-full h-full flex flex-col animate-fade-in-right">
        <div className="shrink-0 px-5 sm:px-6 py-4 border-b border-warm-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-warm-400">{solicitud.codigo}</p>
            <h3 id="drawer-solicitud-titulo" className="font-display text-lg font-semibold text-primary-900 truncate">
              {labelTipo(solicitud.tipo)} · {labelCategoria(solicitud.categoria)}
            </h3>
          </div>
          <button
            onClick={onCerrar}
            disabled={actualizando}
            aria-label="Cerrar detalle"
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-warm-400 hover:text-primary-700 transition-colors rounded-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* Foto en tamaño completo */}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Estado</p>
              <BadgeEstadoSolicitud estado={solicitud.estado} />
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Prioridad actual</p>
              <BadgePrioridad prioridad={prioridadActual} />
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Creada</p>
              <p className="text-sm text-primary-900">{tiempoTranscurrido(solicitud.created_at)}</p>
            </div>
            <div>
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-0.5">Unidad</p>
              <p className="text-sm text-primary-900">
                {solicitud.piso && solicitud.departamento
                  ? `Piso ${solicitud.piso} — ${solicitud.departamento}`
                  : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-1">Descripción</p>
            <p className="text-sm text-primary-800 whitespace-pre-wrap leading-relaxed">
              {solicitud.descripcion}
            </p>
          </div>

          {/* Cambio de prioridad por admin */}
          <div className="border-t border-warm-200 pt-5">
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-2">
              Cambiar prioridad
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'urgente'] as const).map(p => {
                const activo = prioridadActual === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleCambiarPrioridad(p)}
                    disabled={actualizando || activo}
                    className={`min-h-11 capitalize text-sm font-medium rounded-lg border-[1.5px] transition-colors cursor-pointer disabled:cursor-not-allowed ${
                      activo
                        ? p === 'urgente'
                          ? 'border-error bg-error/10 text-error'
                          : 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-warm-200 text-warm-400 hover:border-primary-300 hover:text-primary-700'
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
            {errorPrioridad && (
              <p className="mt-2 text-xs text-error">{errorPrioridad}</p>
            )}
          </div>

          {/* ── Asignar / Reasignar técnico ── */}
          {/* HU-MANT-02 SPRINT-4 — Botón Asignar si estado=pendiente, Reasignar si ya tiene técnico */}
          <div className="border-t border-warm-200 pt-5">
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-2">
              {solicitud.estado === 'pendiente' ? 'Asignar técnico' : 'Técnico asignado'}
            </p>
            <button
              id="btn-abrir-asignar-tecnico"
              type="button"
              onClick={() => setModalAsignarAbierto(true)}
              disabled={actualizando}
              className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg border-[1.5px] border-primary-400 text-primary-700 text-sm font-medium hover:bg-primary-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {solicitud.estado === 'pendiente' ? 'Asignar técnico' : 'Reasignar técnico'}
            </button>
          </div>


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
                  <p className="text-warm-400 text-xs">{solicitud.residente.telefono}</p>
                )}
              </div>
            </div>
          )}

          {/* Historial de estados */}
          {/* HU-MANT-05 SPRINT-4 — Componente reutilizable con autor, badges, paginación */}
          <div className="border-t border-warm-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400">
                Historial de estados
              </p>
              {/* PBI-S5-E02 — Link al log de auditoría filtrado por esta solicitud */}
              <Link
                to={`/admin/auditoria?entidad=solicitudes&entidad_id=${solicitud.id}`}
                className="text-[0.6875rem] font-semibold text-primary-600 hover:text-primary-800 transition-colors uppercase tracking-wider"
              >
                Ver auditoría
              </Link>
            </div>
            <HistorialEstados
              solicitudId={solicitud.id}
              rolObservador="admin"
              userId={user?.id ?? ''}
            />
          </div>
        </div>
      </aside>

      {/* HU-MANT-02 SPRINT-4 — Modal de asignación, renderizado sobre el drawer */}
      {modalAsignarAbierto && (
        <ModalAsignarTecnico
          solicitud={solicitud}
          fotoUrl={fotoUrl}
          onCerrar={() => setModalAsignarAbierto(false)}
          onAsignada={() => {
            setModalAsignarAbierto(false)
            onAsignacionRealizada()
          }}
        />
      )}
    </div>
  )
}
