import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNotificaciones } from '../../contexts/NotificacionesContext'
import { tiempoTranscurrido } from '../../lib/format'
import type { Notificacion, Rol, TipoNotificacion } from '../../types/database'

// HU-NOTIF-01 — Vista de solicitudes por rol para abrir el detalle al hacer click.
const RUTA_SOLICITUDES: Record<Rol, string> = {
  admin: '/admin/solicitudes',
  residente: '/residente',
  tecnico: '/tecnico',
}

function getIconForTipo(tipo: TipoNotificacion) {
  switch (tipo) {
    case 'nueva_solicitud':
      return (
        <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      )
    case 'estado_cambio':
      return (
        <svg className="w-5 h-5 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    case 'alerta_rechazo':
      // PBI-S4-E01 — icono de alerta naranja para distinguirla de notificaciones rutinarias.
      return (
        <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )
    case 'asignacion':
      return (
        <svg className="w-5 h-5 text-accent-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    default:
      return (
        <svg className="w-5 h-5 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

export default function CampanaNotificaciones() {
  const { profile } = useAuth()
  const { notificaciones, noLeidasCount, marcarComoLeida } = useNotificaciones()
  const navigate = useNavigate()

  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // HU-NOTIF-01 (accesibilidad) — cerrar con click fuera y con la tecla Escape.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // HU-NOTIF-01 — click en item: marca como leída y navega al detalle de la solicitud.
  function handleAbrir(notif: Notificacion) {
    setIsOpen(false)
    if (!notif.leida) void marcarComoLeida(notif.id)
    if (notif.solicitud_id && profile?.rol) {
      navigate(`${RUTA_SOLICITUDES[profile.rol]}?solicitud_id=${notif.solicitud_id}`)
    }
  }

  const topNotificaciones = notificaciones.slice(0, 10)

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-warm-500 hover:text-primary-700 hover:bg-primary-50 rounded-full transition-colors cursor-pointer"
        aria-label={noLeidasCount > 0 ? `Notificaciones, ${noLeidasCount} sin leer` : 'Notificaciones'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {noLeidasCount > 0 && (
          <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-white shadow-sm ring-2 ring-white animate-pulse-once">
            {noLeidasCount > 99 ? '99+' : noLeidasCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-[calc(100vw-1rem)] sm:w-96 bg-white border border-warm-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-down"
          role="dialog"
          aria-label="Centro de notificaciones"
        >
          <div className="px-4 py-3 bg-warm-50 border-b border-warm-200">
            <h3 className="font-semibold text-primary-900">Notificaciones</h3>
          </div>

          <ul className="max-h-[28rem] overflow-y-auto divide-y divide-warm-100" aria-live="polite">
            {topNotificaciones.length === 0 ? (
              <li className="px-4 py-8 text-center">
                <div className="mx-auto w-12 h-12 bg-warm-100 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-sm text-warm-500 font-medium">Aún no tienes notificaciones</p>
              </li>
            ) : (
              topNotificaciones.map(notif => (
                <li key={notif.id}>
                  <button
                    type="button"
                    onClick={() => handleAbrir(notif)}
                    className={`w-full text-left p-4 flex gap-3 hover:bg-warm-50 focus:bg-warm-50 focus:outline-none transition-colors cursor-pointer ${!notif.leida ? 'bg-primary-50/40' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">
                      <div className={`p-2 rounded-full ${!notif.leida ? 'bg-white shadow-sm ring-1 ring-warm-200' : 'bg-warm-100'}`}>
                        {getIconForTipo(notif.tipo)}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${!notif.leida ? 'font-semibold text-primary-900' : 'font-medium text-warm-700'}`}>
                        {notif.titulo}
                      </p>
                      <p className="text-xs text-warm-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.mensaje}
                      </p>
                      <p className="text-[0.6875rem] text-warm-400 mt-1.5 font-medium">
                        {tiempoTranscurrido(notif.created_at)}
                      </p>
                    </div>
                    {!notif.leida && (
                      <div className="shrink-0 flex items-center">
                        <div className="w-2 h-2 bg-primary-500 rounded-full" />
                      </div>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="px-4 py-3 bg-warm-50 border-t border-warm-200 text-center">
            <Link
              to="/notificaciones"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-primary-600 hover:text-primary-800 uppercase tracking-wider"
            >
              Ver todas
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
