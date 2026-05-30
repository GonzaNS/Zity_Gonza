// HU-MANT-02 SPRINT-4
// Modal que permite al admin asignar o reasignar un técnico a una solicitud.
// Muestra:
//   - Información de la solicitud en solo lectura (ID, tipo, categoría,
//     prioridad, descripción y foto si existe)
//   - Selector de técnico agrupado por empresa
//   - Textarea de nota de asignación (máx. 300 caracteres con contador)
//   - Botón "Asignar" o "Reasignar" según el estado actual de la solicitud

import { useRef, useState } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import {
  useTecnicosActivos,
  asignarTecnico,
  CARGA_TECNICO_ALTA,
} from '../../../hooks/useAsignarTecnico'
import { useAuth } from '../../../contexts/AuthContext'
import { labelCategoria, labelTipo } from '../../../lib/solicitudes'
import { BadgeEstadoSolicitud, BadgePrioridad } from './BadgeSolicitud'
import type { SolicitudConResidente } from '../../../hooks/useSolicitudesAdmin'

const NOTA_MAX = 300

type Props = {
  solicitud: SolicitudConResidente
  fotoUrl: string | undefined
  onCerrar: () => void
  onAsignada: () => void
}

export default function ModalAsignarTecnico({
  solicitud,
  fotoUrl,
  onCerrar,
  onAsignada,
}: Props) {
  // HU-MANT-02 SPRINT-4
  const { user } = useAuth()
  const { grupos, loading: cargandoTecnicos, error: errorTecnicos } = useTecnicosActivos()

  // tecnicoIdSeleccionado guarda SOLO la elección explícita del admin (vacío
  // antes de que toque el select). Para evitar un useEffect que llame
  // setState cuando los grupos cargan (cascading render), derivamos el id
  // efectivo: si el admin aún no eligió, usamos el primer técnico disponible.
  const [tecnicoIdSeleccionado, setTecnicoIdSeleccionado] = useState('')
  const [nota, setNota] = useState('')
  const [asignando, setAsignando] = useState(false)
  const [errorAsignacion, setErrorAsignacion] = useState<string | null>(null)

  useModalBehavior(onCerrar, asignando)
  // Atrapar el foco dentro del modal (accesibilidad).
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const tecnicoId = tecnicoIdSeleccionado || grupos[0]?.tecnicos[0]?.id || ''

  // Determinar empresa del técnico seleccionado para el payload
  const tecnicoSeleccionado = grupos
    .flatMap(g => g.tecnicos)
    .find(t => t.id === tecnicoId)

  // Sprint 5 · PBI-S4-E02 — el admin ve un aviso explícito si el técnico
  // seleccionado tiene carga > CARGA_TECNICO_ALTA. No bloquea la asignación,
  // solo la advierte.
  const tecnicoSobrecargado =
    tecnicoSeleccionado != null && tecnicoSeleccionado.cargaActiva > CARGA_TECNICO_ALTA

  const esReasignacion = solicitud.estado !== 'pendiente'

  async function handleConfirmar() {
    if (!tecnicoId || !user) return
    setAsignando(true)
    setErrorAsignacion(null)

    // HU-MANT-02 SPRINT-4 — Ejecutar asignación con rollback automático.
    // Pasamos estadoActual para que el historial registre la transición
    // exacta (pendiente→asignada en asignación nueva, X→asignada en
    // reasignación) y para que el audit_log marque es_reasignacion.
    const resultado = await asignarTecnico({
      solicitudId: solicitud.id,
      tecnicoId,
      asignadoPor: user.id,
      nota,
      empresaTercero: tecnicoSeleccionado?.empresa_tercero ?? null,
      estadoActual: solicitud.estado,
    })

    setAsignando(false)

    if (!resultado.ok) {
      setErrorAsignacion(resultado.error ?? 'Error al asignar técnico.')
      return
    }

    onAsignada()
    onCerrar()
  }

  return (
    <div
      ref={panelRef as React.RefObject<HTMLDivElement>}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-asignar-titulo"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      {/* Fondo oscuro */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={asignando ? undefined : onCerrar}
      />

      {/* Panel del modal */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-fade-in max-h-[90vh] overflow-hidden">

        {/* Cabecera */}
        <div className="shrink-0 px-6 py-4 border-b border-warm-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs text-warm-400">{solicitud.codigo}</p>
            <h2
              id="modal-asignar-titulo"
              className="font-display text-lg font-semibold text-primary-900 leading-tight"
            >
              {esReasignacion ? 'Reasignar técnico' : 'Asignar técnico'}
            </h2>
          </div>
          <button
            onClick={onCerrar}
            disabled={asignando}
            aria-label="Cerrar modal"
            className="min-w-10 min-h-10 -mr-1 flex items-center justify-center text-warm-400 hover:text-primary-700 transition-colors rounded-md cursor-pointer disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* ── Información de la solicitud (solo lectura) ── */}
          {/* HU-MANT-02 SPRINT-4 — Campos: ID, tipo, categoría, prioridad, descripción y foto */}
          <section className="bg-warm-50 border border-warm-200 rounded-xl p-4 space-y-3">
            <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 font-medium">
              Información de la solicitud
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[0.6875rem] text-warm-400 mb-0.5">Tipo</p>
                <p className="text-sm font-medium text-primary-900">{labelTipo(solicitud.tipo)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-warm-400 mb-0.5">Categoría</p>
                <p className="text-sm font-medium text-primary-900">{labelCategoria(solicitud.categoria)}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] text-warm-400 mb-0.5">Prioridad</p>
                <BadgePrioridad prioridad={solicitud.prioridad} />
              </div>
              <div>
                <p className="text-[0.6875rem] text-warm-400 mb-0.5">Estado</p>
                <BadgeEstadoSolicitud estado={solicitud.estado} />
              </div>
            </div>

            {solicitud.descripcion && (
              <div>
                <p className="text-[0.6875rem] text-warm-400 mb-0.5">Descripción</p>
                <p className="text-sm text-primary-800 leading-relaxed line-clamp-3">
                  {solicitud.descripcion}
                </p>
              </div>
            )}

            {solicitud.imagen_url && fotoUrl && (
              <img
                src={fotoUrl}
                alt={`Foto de la solicitud ${solicitud.codigo}`}
                className="w-full max-h-40 object-cover rounded-lg border border-warm-200"
              />
            )}
          </section>

          {/* ── Selector de técnico ── */}
          {/* HU-MANT-02 SPRINT-4 — Dropdown agrupado por empresa_tercero */}
          <div>
            <label
              htmlFor="select-tecnico"
              className="block text-sm font-medium text-primary-900 mb-1.5"
            >
              Técnico
            </label>

            {cargandoTecnicos ? (
              <div className="flex items-center gap-2 text-sm text-warm-400 py-2">
                <div className="w-4 h-4 border-2 border-warm-200 border-t-primary-500 rounded-full animate-spin" />
                Cargando técnicos…
              </div>
            ) : errorTecnicos ? (
              <p className="text-sm text-error">{errorTecnicos}</p>
            ) : grupos.length === 0 ? (
              <p className="text-sm text-warm-400">
                No hay técnicos activos disponibles.
              </p>
            ) : (
              <select
                id="select-tecnico"
                value={tecnicoId}
                onChange={e => setTecnicoIdSeleccionado(e.target.value)}
                disabled={asignando}
                className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 cursor-pointer"
              >
                {grupos.map(grupo => (
                  <optgroup key={grupo.empresa} label={grupo.empresa}>
                    {grupo.tecnicos.map(t => {
                      // Sprint 5 · PBI-S4-E02 — etiqueta con carga activa
                      const sobrecargado = t.cargaActiva > CARGA_TECNICO_ALTA
                      const cargaLabel =
                        t.cargaActiva === 0
                          ? '(libre)'
                          : `(${t.cargaActiva} activa${t.cargaActiva === 1 ? '' : 's'})${sobrecargado ? ' ⚠' : ''}`
                      return (
                        <option key={t.id} value={t.id}>
                          {t.nombre} {t.apellido}
                          {t.empresa_tercero ? ` · ${t.empresa_tercero}` : ''}
                          {' · '}
                          {cargaLabel}
                        </option>
                      )
                    })}
                  </optgroup>
                ))}
              </select>
            )}

            {/* Sprint 5 · PBI-S4-E02 — aviso de sobrecarga */}
            {tecnicoSobrecargado && (
              <p className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-warning/10 border border-warning/30 rounded-md px-2.5 py-2">
                <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <span>
                  {tecnicoSeleccionado.nombre} ya tiene {tecnicoSeleccionado.cargaActiva} solicitudes activas.
                  Considera asignar a otro técnico para no sobrecargarlo.
                </span>
              </p>
            )}
          </div>

          {/* ── Nota de asignación ── */}
          {/* HU-MANT-02 SPRINT-4 — Textarea opcional, máx. 300 chars, contador visible */}
          <div>
            <label
              htmlFor="textarea-nota"
              className="block text-sm font-medium text-primary-900 mb-1.5"
            >
              Nota de asignación
              <span className="ml-1 font-normal text-warm-400">(opcional)</span>
            </label>
            <textarea
              id="textarea-nota"
              value={nota}
              onChange={e => {
                if (e.target.value.length <= NOTA_MAX) setNota(e.target.value)
              }}
              disabled={asignando}
              rows={3}
              placeholder="Instrucciones para el técnico…"
              className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm text-primary-900 placeholder:text-warm-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
            />
            <p className={`text-right text-xs mt-1 ${nota.length >= NOTA_MAX ? 'text-error' : 'text-warm-400'}`}>
              {nota.length}/{NOTA_MAX}
            </p>
          </div>

          {/* Error de asignación */}
          {errorAsignacion && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-error/10 border border-error/20">
              <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-sm text-error">{errorAsignacion}</p>
            </div>
          )}
        </div>

        {/* Footer de acciones */}
        <div className="shrink-0 px-6 py-4 border-t border-warm-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCerrar}
            disabled={asignando}
            className="h-10 px-4 rounded-lg border border-warm-200 text-sm text-warm-500 hover:text-primary-700 hover:border-primary-300 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            id="btn-confirmar-asignacion"
            onClick={handleConfirmar}
            disabled={asignando || !tecnicoId || grupos.length === 0}
            className="h-10 px-5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {asignando && (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
            {esReasignacion ? 'Reasignar' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  )
}
