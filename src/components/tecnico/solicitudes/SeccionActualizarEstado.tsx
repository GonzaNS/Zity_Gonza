// HU-MANT-04 SPRINT-4
// Sección de actualización de estado dentro del DrawerDetalleTecnico.
// Muestra el botón de transición válida (solo 1 posible por estado),
// textarea para la nota (obligatoria para "resuelta"), y spinner + error.
// Si no hay transición disponible (solicitud resuelta), muestra mensaje
// de solo lectura.

import { useState } from 'react'
import {
  estadoDestinoValido,
  actualizarEstadoTecnico,
  NOTA_RESUELTA_MIN,
  NOTA_RESUELTA_MAX,
  NOTA_EN_PROGRESO_MAX,
} from '../../../hooks/useActualizarEstadoTecnico'
import { subirFotoCierre, serializarNotaCierre } from '../../../hooks/useSolicitudesTecnico'
import { useAuth } from '../../../contexts/AuthContext'
import UploadFoto from '../../residente/UploadFoto'
import type { EstadoSolicitud } from '../../../types/database'

// HU-MANT-04 SPRINT-4 — Etiquetas legibles para cada estado
const LABEL_ESTADO: Partial<Record<EstadoSolicitud, string>> = {
  en_progreso: 'Iniciar trabajo',
  resuelta: 'Marcar como resuelta',
}

const LABEL_ESTADO_DESTINO: Partial<Record<EstadoSolicitud, string>> = {
  en_progreso: 'En progreso',
  resuelta: 'Resuelta',
}

type Props = {
  solicitudId: string
  residenteId?: string
  estadoActual: EstadoSolicitud
  onEstadoActualizado: () => void
}

export default function SeccionActualizarEstado({
  solicitudId,
  estadoActual,
  onEstadoActualizado,
}: Props) {
  // HU-MANT-04 SPRINT-4
  const { user } = useAuth()
  const estadoDestino = estadoDestinoValido(estadoActual)

  const [nota, setNota] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  // Nota obligatoria solo al resolver
  const notaObligatoria = estadoDestino === 'resuelta'
  const notaTrim = nota.trim()
  const maxNota = notaObligatoria ? NOTA_RESUELTA_MAX : NOTA_EN_PROGRESO_MAX

  // HU-MANT-04 SPRINT-4 — Botón deshabilitado si nota no cumple mínimo
  const botonDeshabilitado =
    guardando ||
    (notaObligatoria && notaTrim.length < NOTA_RESUELTA_MIN)

  async function handleGuardar() {
    if (!estadoDestino || !user || botonDeshabilitado) return

    setGuardando(true)
    setError(null)
    setExito(false)

    try {
      let finalNota = nota

      if (estadoDestino === 'resuelta' && fotoFile) {
        // En lugar de residenteId, usamos user.id para cumplir con la RLS de Supabase Storage
        const filePath = await subirFotoCierre(fotoFile, user.id, solicitudId)
        finalNota = serializarNotaCierre(nota, filePath)
      }

      const resultado = await actualizarEstadoTecnico({
        solicitudId,
        estadoAnterior: estadoActual,
        estadoNuevo: estadoDestino,
        nota: finalNota,
        tecnicoId: user.id,
      })

      if (!resultado.ok) {
        setError(resultado.error ?? 'Error al actualizar el estado.')
        return
      }

      setExito(true)
      setNota('')
      setFotoFile(null)
      onEstadoActualizado()
    } catch (err) {
      setError((err as Error).message || 'Error al subir la foto o actualizar el estado.')
    } finally {
      setGuardando(false)
    }
  }

  // Sin transición disponible (ya resuelta)
  if (!estadoDestino) {
    return (
      <div className="border-t border-warm-200 pt-5">
        <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400 mb-2">
          Estado
        </p>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-success/10 border border-success/20">
          <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-success font-medium">Solicitud resuelta</p>
        </div>
        <p className="mt-2 text-xs text-warm-400">
          Esta solicitud queda pendiente de confirmación por el residente.
        </p>
      </div>
    )
  }

  return (
    <div className="border-t border-warm-200 pt-5 space-y-4">
      <p className="text-[0.6875rem] uppercase tracking-wider text-warm-400">
        Actualizar estado
      </p>

      {/* Indicador de transición */}
      {/* HU-MANT-04 SPRINT-4 — Solo muestra la transición válida */}
      <div className="flex items-center gap-2 text-sm">
        <span className="px-2.5 py-1 rounded-full bg-warm-100 text-warm-500 text-xs font-medium capitalize">
          {estadoActual.replace('_', ' ')}
        </span>
        <svg className="w-4 h-4 text-warm-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${estadoDestino === 'resuelta'
            ? 'bg-success/10 text-success'
            : 'bg-primary-100 text-primary-700'
          }`}>
          {LABEL_ESTADO_DESTINO[estadoDestino]}
        </span>
      </div>

      {/* Textarea de nota */}
      {/* HU-MANT-04 SPRINT-4 — Obligatoria para resuelta, opcional para en_progreso */}
      <div>
        <label htmlFor="nota-estado-tecnico" className="block text-sm font-medium text-primary-900 mb-1.5">
          Nota de trabajo
          {notaObligatoria
            ? <span className="ml-1 text-error text-xs">* obligatoria (mín. {NOTA_RESUELTA_MIN} caracteres)</span>
            : <span className="ml-1 font-normal text-warm-400">(opcional)</span>
          }
        </label>
        <textarea
          id="nota-estado-tecnico"
          value={nota}
          onChange={e => {
            if (e.target.value.length <= maxNota) setNota(e.target.value)
          }}
          disabled={guardando}
          rows={4}
          placeholder={
            notaObligatoria
              ? 'Describe el trabajo realizado para resolver la solicitud…'
              : 'Describe brevemente el trabajo iniciado (opcional)…'
          }
          className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm text-primary-900 placeholder:text-warm-300 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
        />
        <div className="flex items-center justify-between mt-1">
          {notaObligatoria && notaTrim.length > 0 && notaTrim.length < NOTA_RESUELTA_MIN ? (
            <p className="text-xs text-error">
              Faltan {NOTA_RESUELTA_MIN - notaTrim.length} caracteres
            </p>
          ) : <span />}
          <p className={`text-xs ml-auto ${nota.length >= maxNota ? 'text-error' : 'text-warm-400'}`}>
            {nota.length}/{maxNota}
          </p>
        </div>
      </div>

      {/* Upload Foto (Opcional) */}
      {estadoDestino === 'resuelta' && (
        <div className="mt-4">
          <p className="text-sm font-medium text-primary-900 mb-2">Foto de cierre (Opcional)</p>
          <UploadFoto
            archivo={fotoFile}
            onCambio={setFotoFile}
            disabled={guardando}
          />
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-error/10 border border-error/20">
          <svg className="w-4 h-4 text-error shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {/* Éxito efímero */}
      {exito && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
          <svg className="w-4 h-4 text-success shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm text-success">Estado actualizado correctamente.</p>
        </div>
      )}

      {/* Botón de acción */}
      {/* HU-MANT-04 SPRINT-4 — Spinner durante guardado, deshabilitado si nota inválida */}
      <button
        id="btn-actualizar-estado-tecnico"
        type="button"
        onClick={handleGuardar}
        disabled={botonDeshabilitado}
        className="w-full min-h-11 flex items-center justify-center gap-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {guardando && (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {LABEL_ESTADO[estadoDestino] ?? `Cambiar a ${estadoDestino}`}
      </button>
    </div>
  )
}
