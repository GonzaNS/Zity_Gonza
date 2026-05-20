import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificaciones } from '../contexts/NotificacionesContext'
import RangoDeFechas from '../components/shared/RangoDeFechas'
import { tiempoTranscurrido } from '../lib/format'
import type { TipoNotificacion } from '../types/database'

// HU-NOTIF-01 — paginación del centro de notificaciones.
const PAGE_SIZE = 25

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

export default function Notificaciones() {
  const navigate = useNavigate()
  const { notificaciones, noLeidasCount, loading, marcarComoLeida, marcarTodasComoLeidas } = useNotificaciones()

  const [filtroEstado, setFiltroEstado] = useState<'todas' | 'leidas' | 'no_leidas'>('todas')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [pagina, setPagina] = useState(0)
  const [confirmarTodas, setConfirmarTodas] = useState(false)
  const [toast, setToast] = useState<{ tipo: 'error' | 'success'; msg: string } | null>(null)

  function mostrarToast(tipo: 'error' | 'success', msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const filtradas = useMemo(() => {
    return notificaciones.filter(n => {
      if (filtroEstado === 'leidas' && !n.leida) return false
      if (filtroEstado === 'no_leidas' && n.leida) return false

      if (fechaDesde) {
        const d = new Date(fechaDesde)
        d.setHours(0, 0, 0, 0)
        if (new Date(n.created_at) < d) return false
      }
      if (fechaHasta) {
        const h = new Date(fechaHasta)
        h.setHours(23, 59, 59, 999)
        if (new Date(n.created_at) > h) return false
      }
      return true
    })
  }, [notificaciones, filtroEstado, fechaDesde, fechaHasta])

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const visibles = filtradas.slice(paginaSegura * PAGE_SIZE, paginaSegura * PAGE_SIZE + PAGE_SIZE)

  async function handleMarcarLeida(id: string) {
    const { ok } = await marcarComoLeida(id)
    if (!ok) mostrarToast('error', 'No se pudo marcar como leída. Intenta de nuevo.')
  }

  async function handleConfirmarTodas() {
    setConfirmarTodas(false)
    const { ok } = await marcarTodasComoLeidas()
    if (!ok) mostrarToast('error', 'No se pudieron marcar todas como leídas. Intenta de nuevo.')
  }

  return (
    <div className="min-h-screen bg-warm-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-warm-400 hover:text-primary-700 hover:bg-warm-100 rounded-full transition-colors cursor-pointer"
              aria-label="Volver"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="font-display text-2xl font-semibold text-primary-900">Centro de Notificaciones</h1>
          </div>
          {noLeidasCount > 0 && (
            <button
              onClick={() => setConfirmarTodas(true)}
              className="text-sm font-medium text-primary-600 hover:text-primary-800 bg-primary-50 px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl shadow-xs border border-warm-200 p-4 sm:p-5 mb-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            <div>
              <label className="block text-xs font-medium text-primary-900 mb-2">Estado</label>
              <div className="flex gap-2 p-1 bg-warm-100 rounded-lg">
                {(['todas', 'no_leidas', 'leidas'] as const).map(estado => (
                  <button
                    key={estado}
                    onClick={() => { setFiltroEstado(estado); setPagina(0) }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      filtroEstado === estado
                        ? 'bg-white text-primary-900 shadow-xs'
                        : 'text-warm-500 hover:text-primary-700'
                    }`}
                  >
                    {estado === 'todas' ? 'Todas' : estado === 'no_leidas' ? 'No leídas' : 'Leídas'}
                  </button>
                ))}
              </div>
            </div>

            <RangoDeFechas
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              onChangeDesde={v => { setFechaDesde(v); setPagina(0) }}
              onChangeHasta={v => { setFechaHasta(v); setPagina(0) }}
            />
          </div>
        </div>

        {/* Lista */}
        <div className="bg-white rounded-xl shadow-xs border border-warm-200 overflow-hidden animate-fade-in">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-primary-800 font-medium">Aún no tienes notificaciones</p>
              <p className="text-sm text-warm-400 mt-1 max-w-sm">
                No tienes notificaciones que coincidan con los filtros.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-warm-100">
              {visibles.map(notif => (
                <li
                  key={notif.id}
                  className={`p-4 sm:p-6 flex gap-4 transition-colors ${!notif.leida ? 'bg-primary-50/30' : 'hover:bg-warm-50/50'}`}
                >
                  <div className="shrink-0 mt-1">
                    <div className={`p-3 rounded-full ${!notif.leida ? 'bg-white shadow-sm ring-1 ring-warm-200' : 'bg-warm-100'}`}>
                      {getIconForTipo(notif.tipo)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-4 mb-1">
                      <p className={`text-base ${!notif.leida ? 'font-semibold text-primary-900' : 'font-medium text-warm-700'}`}>
                        {notif.titulo}
                      </p>
                      <span className="text-xs text-warm-400 shrink-0">
                        {new Date(notif.created_at).toLocaleString('es')} ({tiempoTranscurrido(notif.created_at)})
                      </span>
                    </div>
                    <p className="text-sm text-warm-600 mt-1 leading-relaxed">{notif.mensaje}</p>

                    {!notif.leida && (
                      <div className="mt-4 flex">
                        <button
                          onClick={() => handleMarcarLeida(notif.id)}
                          className="text-xs font-medium text-primary-600 hover:text-primary-800 bg-white border border-primary-200 shadow-sm px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                        >
                          Marcar como leída
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Paginación */}
        {!loading && filtradas.length > PAGE_SIZE && (
          <nav className="mt-5 flex items-center justify-between text-sm">
            <p className="text-xs text-warm-500">
              Página {paginaSegura + 1} de {totalPaginas} · {filtradas.length} en total · {PAGE_SIZE} por página
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPagina(p => Math.max(0, p - 1))}
                disabled={paginaSegura === 0}
                className="h-9 px-3 rounded-lg border border-warm-300 text-primary-700 text-sm font-medium hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>
              <button
                type="button"
                onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
                disabled={paginaSegura + 1 >= totalPaginas}
                className="h-9 px-3 rounded-lg border border-warm-300 text-primary-700 text-sm font-medium hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente →
              </button>
            </div>
          </nav>
        )}
      </div>

      {/* HU-NOTIF-02 — Modal de confirmación para marcar todas como leídas */}
      {confirmarTodas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setConfirmarTodas(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <h2 className="font-display text-lg font-semibold text-primary-900">Marcar todas como leídas</h2>
            <p className="mt-2 text-sm text-warm-600">
              Esto marcará {noLeidasCount} notificación{noLeidasCount === 1 ? '' : 'es'} como leída{noLeidasCount === 1 ? '' : 's'}. ¿Continuar?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmarTodas(false)}
                className="h-10 px-4 rounded-lg border border-warm-300 text-warm-600 text-sm font-medium hover:bg-warm-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmarTodas}
                className="h-10 px-4 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer"
              >
                Sí, marcar todas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast (rollback de error / éxito) */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in text-white ${toast.tipo === 'error' ? 'bg-error' : 'bg-success'}`}
          role="status"
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
