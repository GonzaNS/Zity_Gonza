// HU-MANT-03 SPRINT-4
// Vista principal del técnico: lista de solicitudes asignadas con filtros
// por estado y prioridad, cards responsivas y drawer de detalle completo.
// Reemplaza el placeholder anterior que mostraba solo un mensaje estático.

import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TecnicoShell from '../components/tecnico/TecnicoShell'
import FiltrosTecnico from '../components/tecnico/solicitudes/FiltrosTecnico'
import CardSolicitudTecnico from '../components/tecnico/solicitudes/CardSolicitudTecnico'
import DrawerDetalleTecnico from '../components/tecnico/solicitudes/DrawerDetalleTecnico'
import { useSolicitudesTecnico, type FiltrosTecnico as FiltrosTecnicoType, type SolicitudAsignadaTecnico } from '../hooks/useSolicitudesTecnico'
import { useFotosFirmadas } from '../hooks/useSolicitudes'

export default function TecnicoDashboard() {
  // HU-MANT-03 SPRINT-4 — Estado de filtros y solicitud seleccionada
  const [filtros, setFiltros] = useState<FiltrosTecnicoType>({ estado: '', prioridad: '' })
  const { solicitudes, loading, error, refetch } = useSolicitudesTecnico(filtros)

  // Fotos firmadas para todas las solicitudes visibles
  const paths = useMemo(() => solicitudes.map(s => s.imagen_url), [solicitudes])
  const fotosUrls = useFotosFirmadas(paths)

  // Selección por id para sincronizar con refetch
  // HU-NOTIF-01 — la solicitud abierta vive en la URL (?solicitud_id): permite
  // abrir el drawer desde la campana y compartir el enlace.
  const [searchParams, setSearchParams] = useSearchParams()
  const idSeleccionada = searchParams.get('solicitud_id')
  const seleccionada: SolicitudAsignadaTecnico | null = useMemo(
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

  const subtitulo = loading
    ? 'Cargando…'
    : `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} asignada${solicitudes.length !== 1 ? 's' : ''}`

  return (
    <TecnicoShell title="Mis solicitudes asignadas" subtitle={subtitulo}>

      {/* Error de carga */}
      {error && (
        <div className="mb-4 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm flex items-start gap-2">
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {error}
          <button onClick={refetch} className="ml-auto text-xs underline cursor-pointer">Reintentar</button>
        </div>
      )}

      {/* Filtros */}
      {/* HU-MANT-03 SPRINT-4 — Filtros por estado y prioridad */}
      <div className="mb-4 animate-fade-in delay-1">
        <FiltrosTecnico filtros={filtros} onChange={setFiltros} total={solicitudes.length} />
      </div>

      {/* Spinner de carga */}
      {loading && (
        <div className="flex justify-center py-16" data-testid="tecnico-loading">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      )}

      {/* Estado vacío */}
      {/* HU-MANT-03 SPRINT-4 — Pantalla vacía amigable si no hay solicitudes */}
      {!loading && solicitudes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-warm-100 flex items-center justify-center mb-5">
            <svg className="w-9 h-9 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <p className="text-primary-800 font-medium text-lg">Sin solicitudes asignadas</p>
          <p className="text-sm text-warm-400 mt-2 max-w-xs">
            {filtros.estado || filtros.prioridad
              ? 'No hay solicitudes con los filtros seleccionados.'
              : 'Cuando un administrador te asigne una solicitud, aparecerá aquí.'}
          </p>
          {(filtros.estado || filtros.prioridad) && (
            <button
              onClick={() => setFiltros({ estado: '', prioridad: '' })}
              className="mt-4 text-sm text-primary-600 underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Lista de cards */}
      {/* HU-MANT-03 SPRINT-4 — Cards responsivas: columna en mobile, tabla opcional en desktop */}
      {!loading && solicitudes.length > 0 && (
        <div className="space-y-3 animate-fade-in delay-2">
          {solicitudes.map(s => (
            <CardSolicitudTecnico
              key={s.id}
              solicitud={s}
              fotoUrl={s.imagen_url ? fotosUrls.get(s.imagen_url) : undefined}
              onClick={() => abrirDrawer(s.id)}
            />
          ))}
        </div>
      )}

      {/* Drawer de detalle */}
      {/* HU-MANT-03 SPRINT-4 — Panel lateral con detalle completo */}
      {/* HU-MANT-04 SPRINT-4 — onEstadoActualizado refetch tras cambio de estado */}
      {seleccionada && (
        <DrawerDetalleTecnico
          solicitud={seleccionada}
          fotoUrl={seleccionada.imagen_url ? fotosUrls.get(seleccionada.imagen_url) : undefined}
          onCerrar={cerrarDrawer}
          onEstadoActualizado={refetch}
        />
      )}
    </TecnicoShell>
  )
}
