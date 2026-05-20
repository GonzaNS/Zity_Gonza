// Sprint 5 · HU-AUDIT-01 · Vista admin del audit_log con filtros y paginación.
// Filtros: rango de fechas, usuario (autocomplete), acción (select del catálogo),
// entidad (select). Conserva los filtros en query params para que un link sea
// compartible.

import { useState } from 'react'
import AdminShell from '../../components/admin/AdminShell'
import {
  useAuditLog,
  useFiltrosAudit,
  AUDIT_PAGE_SIZE,
  type EntradaAuditLog,
} from '../../hooks/useAuditLog'
import {
  ACCIONES_AUDIT_COMPLETO,
  ENTIDADES_AUDIT_FILTRO,
  labelAccion,
} from '../../lib/audit'
import { tiempoTranscurrido } from '../../lib/format'
import FiltroUsuario from '../../components/admin/auditoria/FiltroUsuario'
import ModalDetalleAudit from '../../components/admin/auditoria/ModalDetalleAudit'
import RangoDeFechas from '../../components/shared/RangoDeFechas'

export default function AdminAuditoria() {
  const { filtros, setFiltros, resetear, esDefault } = useFiltrosAudit()
  const { entradas, total, totalPaginas, loading, error } = useAuditLog(filtros)
  const [seleccionada, setSeleccionada] = useState<EntradaAuditLog | null>(null)

  const subtitulo = loading
    ? 'Cargando…'
    : `${total} acción${total === 1 ? '' : 'es'} ${esDefault ? 'registradas' : 'según los filtros'}`

  return (
    <AdminShell title="Auditoría del sistema" subtitle={subtitulo}>

      {/* Filtros — desktop horizontal, móvil columna */}
      <section className="bg-white border border-warm-200 rounded-xl p-4 sm:p-5 mb-5 animate-fade-in">
        <h2 className="text-xs uppercase tracking-wider text-warm-400 font-medium mb-3">Filtros</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2 lg:col-span-2">
            <RangoDeFechas
              fechaDesde={filtros.fechaDesde}
              fechaHasta={filtros.fechaHasta}
              onChangeDesde={val => setFiltros({ fechaDesde: val })}
              onChangeHasta={val => setFiltros({ fechaHasta: val })}
            />
          </div>

          {/* Acción */}
          <div>
            <label htmlFor="f-accion" className="block text-xs font-medium text-primary-900 mb-1">
              Acción
            </label>
            <select
              id="f-accion"
              value={filtros.accion}
              onChange={e => setFiltros({ accion: e.target.value })}
              className="w-full h-10 px-2.5 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
            >
              <option value="">Todas</option>
              {ACCIONES_AUDIT_COMPLETO.map(a => (
                <option key={a} value={a}>{labelAccion(a)}</option>
              ))}
            </select>
          </div>

          {/* Entidad */}
          <div>
            <label htmlFor="f-entidad" className="block text-xs font-medium text-primary-900 mb-1">
              Entidad
            </label>
            <select
              id="f-entidad"
              value={filtros.entidad}
              onChange={e => setFiltros({ entidad: e.target.value })}
              className="w-full h-10 px-2.5 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
            >
              <option value="">Todas</option>
              {ENTIDADES_AUDIT_FILTRO.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Usuario — fila aparte porque puede ser más ancho */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-primary-900 mb-1">
            Usuario
          </label>
          <FiltroUsuario
            usuarioIdActual={filtros.usuarioId}
            onSeleccion={id => setFiltros({ usuarioId: id })}
          />
        </div>

        {!esDefault && (
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={resetear}
              className="text-xs text-primary-600 hover:text-primary-800 font-medium cursor-pointer"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </section>

      {/* Tabla / estado de carga / error / vacío */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : entradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-warm-200 rounded-xl animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-primary-800 font-medium">Sin actividad registrada</p>
          <p className="text-sm text-warm-400 mt-1 max-w-sm">
            {esDefault
              ? 'Aún no hay acciones críticas registradas en el sistema.'
              : 'No hay registros que coincidan con los filtros seleccionados.'}
          </p>
          {!esDefault && (
            <button
              type="button"
              onClick={resetear}
              className="mt-4 text-sm text-primary-600 hover:text-primary-800 underline cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tabla desktop */}
          <div className="hidden sm:block bg-white border border-warm-200 rounded-xl overflow-hidden animate-fade-in">
            <table className="w-full text-sm">
              <thead className="bg-warm-50 border-b border-warm-200">
                <tr>
                  <th className="text-left text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Cuando</th>
                  <th className="text-left text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Usuario</th>
                  <th className="text-left text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Acción</th>
                  <th className="text-left text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Entidad</th>
                  <th className="text-left text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Resultado</th>
                  <th className="text-right text-[0.6875rem] uppercase tracking-wider text-warm-500 font-semibold px-4 py-3">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {entradas.map(e => (
                  <FilaAudit key={e.id} entrada={e} onVerDetalles={() => setSeleccionada(e)} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards móvil */}
          <div className="sm:hidden space-y-3 animate-fade-in">
            {entradas.map(e => (
              <CardAuditMobile key={e.id} entrada={e} onVerDetalles={() => setSeleccionada(e)} />
            ))}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <nav className="mt-5 flex items-center justify-between text-sm">
              <p className="text-xs text-warm-500">
                Página {filtros.pagina + 1} de {totalPaginas} ·
                {' '}{total} en total ·
                {' '}{AUDIT_PAGE_SIZE} por página
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFiltros({ pagina: filtros.pagina - 1 })}
                  disabled={filtros.pagina === 0}
                  className="h-9 px-3 rounded-lg border border-warm-300 text-primary-700 text-sm font-medium hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setFiltros({ pagina: filtros.pagina + 1 })}
                  disabled={filtros.pagina + 1 >= totalPaginas}
                  className="h-9 px-3 rounded-lg border border-warm-300 text-primary-700 text-sm font-medium hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente →
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {/* Modal de detalles JSON */}
      {seleccionada && (
        <ModalDetalleAudit
          entrada={seleccionada}
          onCerrar={() => setSeleccionada(null)}
        />
      )}
    </AdminShell>
  )
}

// ─── Sub-componentes locales ────────────────────────────────────────────────

function FilaAudit({ entrada, onVerDetalles }: { entrada: EntradaAuditLog; onVerDetalles: () => void }) {
  return (
    <tr className="hover:bg-warm-50/60 transition-colors">
      <td className="px-4 py-3 align-top">
        <span
          className="text-xs text-primary-800 cursor-default whitespace-nowrap"
          title={new Date(entrada.created_at).toLocaleString('es')}
        >
          {tiempoTranscurrido(entrada.created_at)}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        {entrada.autor ? (
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary-900 truncate">
              {entrada.autor.nombre} {entrada.autor.apellido}
            </p>
            <p className="text-[0.6875rem] text-warm-400 truncate">{entrada.autor.email}</p>
          </div>
        ) : (
          <span className="text-xs text-warm-400 italic">Sistema</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <span className="text-sm text-primary-900 whitespace-nowrap">
          {labelAccion(entrada.accion)}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-primary-800">{entrada.entidad ?? '—'}</span>
          {entrada.entidad_id && (
            <span className="text-[0.6rem] text-warm-400 font-mono truncate max-w-[120px]" title={entrada.entidad_id}>
              {entrada.entidad_id.slice(0, 8)}…
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <BadgeResultado resultado={entrada.resultado} />
      </td>
      <td className="px-4 py-3 align-top text-right">
        <button
          type="button"
          onClick={onVerDetalles}
          className="text-xs text-primary-600 hover:text-primary-800 font-medium cursor-pointer"
        >
          Ver detalles
        </button>
      </td>
    </tr>
  )
}

function CardAuditMobile({ entrada, onVerDetalles }: { entrada: EntradaAuditLog; onVerDetalles: () => void }) {
  return (
    <button
      type="button"
      onClick={onVerDetalles}
      className="block w-full text-left bg-white border border-warm-200 rounded-lg p-3 hover:border-primary-300 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-semibold text-primary-900 flex-1">
          {labelAccion(entrada.accion)}
        </p>
        <BadgeResultado resultado={entrada.resultado} />
      </div>
      {entrada.autor && (
        <p className="text-xs text-warm-500 truncate">
          {entrada.autor.nombre} {entrada.autor.apellido} · {entrada.autor.email}
        </p>
      )}
      <div className="mt-1.5 flex items-center justify-between text-[0.6875rem] text-warm-400">
        <span>{entrada.entidad ?? '—'}</span>
        <span>{tiempoTranscurrido(entrada.created_at)}</span>
      </div>
    </button>
  )
}

function BadgeResultado({ resultado }: { resultado: string | null }) {
  if (resultado === 'fallido') {
    return (
      <span className="inline-flex items-center text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-error/10 text-error border border-error/20">
        Fallido
      </span>
    )
  }
  return (
    <span className="inline-flex items-center text-[0.6875rem] font-semibold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">
      Exitoso
    </span>
  )
}
