import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSolicitudes, useFotosFirmadas } from '../hooks/useSolicitudes'
import ModalNuevaSolicitud from '../components/residente/ModalNuevaSolicitud'
// HU-MANT-05 SPRINT-4 — Drawer de detalle con historial para el residente
import DrawerDetalleSolicitudResidente from '../components/residente/DrawerDetalleSolicitudResidente'
// HU-MANT-07 SPRINT-4 — Sección de confirmación de solicitudes resueltas
import { useSolicitudesPendientesConfirmacion } from '../hooks/useConfirmarSolicitud'
import CardConfirmacion from '../components/residente/solicitudes/CardConfirmacion'
import { labelCategoria, labelTipo } from '../lib/solicitudes'
import { tiempoTranscurrido } from '../lib/format'
import zityLogo from '../assets/zity_logo.png'
import CampanaNotificaciones from '../components/shared/CampanaNotificaciones'
import type { EstadoSolicitud, Solicitud } from '../types/database'

const ESTADO_BADGE: Record<EstadoSolicitud, string> = {
  pendiente: 'bg-accent-100 text-accent-700 border-accent-300/60',
  asignada: 'bg-primary-100 text-primary-700 border-primary-200',
  en_progreso: 'bg-primary-50 text-primary-600 border-primary-200',
  resuelta: 'bg-[#4a7c59]/15 text-[#2d5f3f] border-[#4a7c59]/25',
  cerrada: 'bg-warm-100 text-warm-400 border-warm-200',
}

const ESTADO_LABEL: Record<EstadoSolicitud, string> = {
  pendiente: 'Pendiente',
  asignada: 'Asignada',
  en_progreso: 'En progreso',
  resuelta: 'Resuelta',
  cerrada: 'Cerrada',
}

export default function ResidenteDashboard() {
  const { profile, signOut, user } = useAuth()
  const navigate = useNavigate()

  const [mostrarModal, setMostrarModal] = useState(false)
  const [confirmacionId, setConfirmacionId] = useState<string | null>(null)
  // HU-MANT-05 SPRINT-4 / HU-NOTIF-01 — la solicitud abierta vive en la URL
  // (?solicitud_id): permite abrir el drawer desde la campana y compartir el link.
  const [searchParams, setSearchParams] = useSearchParams()
  const idSeleccionada = searchParams.get('solicitud_id')

  const { solicitudes, loading, error, refetch } = useSolicitudes({ residente_id: user?.id })
  const fotosUrls = useFotosFirmadas(solicitudes.map(s => s.imagen_url))

  // HU-MANT-07 SPRINT-4 — Solicitudes resueltas pendientes de confirmación
  const {
    solicitudes: pendientesConfirmacion,
    refetch: refetchPendientes,
  } = useSolicitudesPendientesConfirmacion(user?.id)
  const fotosPendientes = useFotosFirmadas(pendientesConfirmacion.map(s => s.imagen_url))

  function handleActualizadaPendiente() {
    refetchPendientes()
    refetch()
  }

  const seleccionada: Solicitud | null = useMemo(
    () => solicitudes.find(s => s.id === idSeleccionada) ?? null,
    [solicitudes, idSeleccionada],
  )

  function abrirDrawer(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('solicitud_id', id)
      return next
    })
  }

  function cerrarDrawer() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('solicitud_id')
      return next
    }, { replace: true })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  function handleCreada(solicitud: Solicitud) {
    setConfirmacionId(solicitud.codigo ?? solicitud.id)
    refetch()
    setTimeout(() => setConfirmacionId(null), 6000)
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={zityLogo} alt="Zity" className="h-9 w-auto" />
            <span className="text-xs font-semibold bg-accent-500 text-white px-2.5 py-1 rounded-full tracking-wider uppercase">
              Residente
            </span>
          </div>
          <div className="flex items-center gap-4">
            <CampanaNotificaciones />
            
            {/* Sprint 5 · PBI-S2-E03 — link a perfil propio */}
            <Link
              to="/perfil"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
              title="Editar mi perfil"
            >
              {profile?.nombre} {profile?.apellido}
            </Link>
            {/* Sprint 8 · HU-FACT-03 — link a facturas */}
            <Link
              to="/residente/facturas"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
              title="Ver mis facturas"
            >
              Mis facturas
            </Link>
            {/* Sprint 10 · HU-TIENDA-05 — link a la tienda */}
            <Link
              to="/residente/tienda"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
              title="Ver la tienda del edificio"
            >
              Tienda
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
              Hola, {profile?.nombre}
            </h2>
            <p className="mt-1 text-warm-400 text-sm">
              {profile?.piso && profile?.departamento
                ? `Piso ${profile.piso}, Depto. ${profile.departamento}`
                : 'Tu unidad aún no está configurada.'}
            </p>
          </div>

          <button
            onClick={() => setMostrarModal(true)}
            className="btn-primary sm:w-auto! sm:px-5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva solicitud
          </button>
        </div>

        {confirmacionId && (
          <div className="mt-6 p-4 bg-success/10 border border-success/20 rounded-lg text-success text-sm animate-scale-in flex items-start gap-2">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Solicitud <strong className="font-semibold">{confirmacionId}</strong> registrada. El administrador la revisará pronto.</span>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* HU-MANT-07 SPRINT-4 — Sección "Pendientes de tu confirmación" */}
        {pendientesConfirmacion.length > 0 && (
          <section className="mt-8 animate-fade-in">
            <h3 className="font-display text-lg sm:text-xl font-semibold text-error mb-1">
              Pendientes de tu confirmación
              <span className="ml-2 text-sm font-normal text-warm-400">
                ({pendientesConfirmacion.length})
              </span>
            </h3>
            <p className="text-sm text-warm-400 mb-4">
              Revisa si el trabajo fue realizado correctamente y confirma o rechaza la solución.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendientesConfirmacion.map(s => (
                <CardConfirmacion
                  key={s.id}
                  solicitud={s}
                  fotoUrl={s.imagen_url ? fotosPendientes.get(s.imagen_url) : undefined}
                  notaTecnico={null}
                  onActualizada={handleActualizadaPendiente}
                />
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 animate-fade-in delay-2">
          <h3 className="font-display text-lg sm:text-xl font-semibold text-primary-900 mb-4">
            Mis solicitudes
            {!loading && solicitudes.length > 0 && (
              <span className="ml-2 text-sm font-normal text-warm-400">
                ({solicitudes.length})
              </span>
            )}
          </h3>

          {loading ? (
            <div className="flex justify-center py-12" data-testid="solicitudes-loading">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="bg-white rounded-xl border border-warm-200 p-8 sm:p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-primary-800 font-medium">Aún no tienes solicitudes</p>
              <p className="text-sm text-warm-400 mt-1">
                Crea la primera con el botón "Nueva solicitud".
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {solicitudes.map(s => (
                <li
                  key={s.id}
                  className="bg-white rounded-xl border border-warm-200 overflow-hidden hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                  onClick={() => abrirDrawer(s.id)}
                >
                  {s.imagen_url && (
                    <div className="aspect-[16/9] bg-warm-100 overflow-hidden">
                      {fotosUrls.get(s.imagen_url) ? (
                        <img
                          src={fotosUrls.get(s.imagen_url)}
                          alt={`Foto de la solicitud ${s.codigo}`}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-warm-400">
                          <span className="text-xs">Cargando foto…</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <span className="font-mono text-xs text-warm-400">{s.codigo}</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border ${ESTADO_BADGE[s.estado]}`}
                      >
                        {ESTADO_LABEL[s.estado]}
                      </span>
                    </div>
                    <p className="font-medium text-primary-900">
                      {labelTipo(s.tipo)} · {labelCategoria(s.categoria)}
                    </p>
                    <p className="mt-1.5 text-sm text-warm-400 line-clamp-2">
                      {s.descripcion}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs text-warm-400">
                      <span className="capitalize">
                        Prioridad: <span className={s.prioridad === 'urgente' ? 'text-error font-semibold' : 'text-primary-700'}>{s.prioridad}</span>
                      </span>
                      <span>{tiempoTranscurrido(s.created_at)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {mostrarModal && (
        <ModalNuevaSolicitud
          onCreada={handleCreada}
          onCerrar={() => setMostrarModal(false)}
        />
      )}

      {/* HU-MANT-05 SPRINT-4 — Drawer de detalle con historial de estados para el residente */}
      {seleccionada && (
        <DrawerDetalleSolicitudResidente
          solicitud={seleccionada}
          fotoUrl={seleccionada.imagen_url ? fotosUrls.get(seleccionada.imagen_url) : undefined}
          onCerrar={cerrarDrawer}
        />
      )}
    </div>
  )
}
