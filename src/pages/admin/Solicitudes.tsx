import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell from '../../components/admin/AdminShell'
import FiltrosSolicitudes from '../../components/admin/solicitudes/FiltrosSolicitudes'
import TablaSolicitudes from '../../components/admin/solicitudes/TablaSolicitudes'
import DrawerSolicitud from '../../components/admin/solicitudes/DrawerSolicitud'
import {
  useSolicitudesAdmin,
  type FiltrosAdmin,
} from '../../hooks/useSolicitudesAdmin'
import { useFotosFirmadas } from '../../hooks/useSolicitudes'

export default function AdminSolicitudes() {
  const [filtros, setFiltros] = useState<FiltrosAdmin>({ estado: '', tipo: '' })
  const { solicitudes, loading, error, refetch } = useSolicitudesAdmin(filtros)

  const paths = useMemo(() => solicitudes.map(s => s.imagen_url), [solicitudes])
  const fotosUrls = useFotosFirmadas(paths)

  // La selección la guardamos por id; los datos completos los derivamos del
  // array `solicitudes`. Así, tras un refetch la `seleccionada` queda
  // automáticamente sincronizada con los nuevos valores (prioridad, estado).
  // HU-NOTIF-01 / PBI-S4-E01 — la solicitud abierta vive en la URL (?solicitud_id):
  // la campana puede abrir el drawer y el enlace resultante es compartible.
  const [searchParams, setSearchParams] = useSearchParams()
  const idSeleccionada = searchParams.get('solicitud_id')
  const seleccionada = useMemo(
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

  const subtitulo = `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''} ${solicitudes.length !== 1 ? 'encontradas' : 'encontrada'}`

  return (
    <AdminShell title="Solicitudes" subtitle={subtitulo}>
      {error && (
        <div className="mb-4 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 sm:mb-6 animate-fade-in delay-1">
        <FiltrosSolicitudes filtros={filtros} onChange={setFiltros} />
      </div>

      <div className="bg-white rounded-xl border border-warm-200 overflow-hidden animate-fade-in delay-2">
        <TablaSolicitudes
          solicitudes={solicitudes}
          loading={loading}
          fotosUrls={fotosUrls}
          onAbrir={s => abrirDrawer(s.id)}
        />
      </div>

      {/* HU-MANT-02 SPRINT-4 — onAsignacionRealizada refresca la lista tras asignar/reasignar */}
      {seleccionada && (
        <DrawerSolicitud
          solicitud={seleccionada}
          fotoUrl={seleccionada.imagen_url ? fotosUrls.get(seleccionada.imagen_url) : undefined}
          onCerrar={cerrarDrawer}
          onPrioridadActualizada={refetch}
          onAsignacionRealizada={refetch}
        />
      )}
    </AdminShell>
  )
}
