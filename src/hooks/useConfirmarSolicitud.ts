// HU-MANT-07 SPRINT-4
// Lógica de confirmación/rechazo de solicitudes resueltas por el residente.
// Toda transición pasa por el helper centralizado `cambiarEstadoSolicitud()`
// que orquesta UPDATE + historial + audit.
//
// Flujos:
//   confirmar  : estado='cerrada', confirmada_por_residente=true
//   rechazar   : estado='en_progreso', intentos_resolucion+=1
//   escalada   : si intentos_resolucion >= MAX_INTENTOS_RESOLUCION tras el
//                rechazo, el estado pasa a 'pendiente' (vuelve al admin).

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  cambiarEstadoSolicitud,
  pathFotoRechazo,
  appendFotoARechazo,
  validarImagen,
  BUCKET_FOTOS,
} from '../lib/solicitudes'
import type { Solicitud } from '../types/database'

// HU-MANT-07 SPRINT-4 — Umbral de escalada al admin
export const MAX_INTENTOS_RESOLUCION = 3
export const NOTA_RECHAZO_MIN = 20
export const NOTA_RECHAZO_MAX = 500

export type ResultadoConfirmacion = {
  ok: boolean
  escalada?: boolean   // true si intentos >= MAX tras rechazar
  error?: string
}

// ─── Confirmar solución ──────────────────────────────────────────────────────

/**
 * HU-MANT-07 SPRINT-4
 * El residente confirma que la solicitud fue resuelta correctamente.
 * Transición: resuelta → cerrada, confirmada_por_residente = true
 */
export async function confirmarSolicitud(
  solicitudId: string,
  residenteId: string,
): Promise<ResultadoConfirmacion> {
  const resultado = await cambiarEstadoSolicitud({
    solicitudId,
    estadoAnterior: 'resuelta',
    estadoNuevo: 'cerrada',
    nota: 'Residente confirmó la solución.',
    usuarioId: residenteId,
    accionAudit: 'confirmar_solicitud',
    camposExtraSolicitud: { confirmada_por_residente: true },
  })

  return resultado.ok
    ? { ok: true }
    : { ok: false, error: resultado.error }
}

// ─── Rechazar solución ───────────────────────────────────────────────────────

/**
 * HU-MANT-07 SPRINT-4 (+ Sprint 5 · PBI-S4-E04: foto opcional)
 * El residente rechaza la solución del técnico.
 * - Valida nota mínima de 20 chars
 * - Sube la foto opcional al bucket solicitudes-fotos (path con prefijo rechazo_)
 * - Incrementa intentos_resolucion
 * - Si >= MAX_INTENTOS_RESOLUCION → estado='pendiente' (escalada al admin)
 * - Si < MAX → estado='en_progreso'
 */
export async function rechazarSolicitud(
  solicitudId: string,
  residenteId: string,
  nota: string,
  intentosActuales: number,
  fotoFile?: File | null,
): Promise<ResultadoConfirmacion> {
  const notaTrim = nota.trim()

  // Validación cliente
  if (notaTrim.length < NOTA_RECHAZO_MIN) {
    return {
      ok: false,
      error: `La nota de rechazo debe tener al menos ${NOTA_RECHAZO_MIN} caracteres.`,
    }
  }
  if (notaTrim.length > NOTA_RECHAZO_MAX) {
    return {
      ok: false,
      error: `La nota de rechazo no puede superar ${NOTA_RECHAZO_MAX} caracteres.`,
    }
  }

  // Sprint 5 · PBI-S4-E04 — Subir la foto antes del cambio de estado.
  // Si falla, abortamos sin tocar el estado (la BD queda consistente).
  let fotoPath: string | null = null
  if (fotoFile) {
    const validacionFoto = validarImagen(fotoFile)
    if (!validacionFoto.ok) {
      return { ok: false, error: validacionFoto.mensaje }
    }
    fotoPath = pathFotoRechazo(residenteId, solicitudId, fotoFile)
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_FOTOS)
      .upload(fotoPath, fotoFile, {
        contentType: fotoFile.type,
        upsert: false,
      })
    if (uploadError) {
      return { ok: false, error: `No se pudo subir la foto: ${uploadError.message}` }
    }
  }

  const nuevosIntentos = intentosActuales + 1
  // HU-MANT-07 SPRINT-4 — Escalada si >= MAX_INTENTOS_RESOLUCION
  const escalada = nuevosIntentos >= MAX_INTENTOS_RESOLUCION
  const estadoNuevo = escalada ? 'pendiente' : 'en_progreso'

  const notaBase = escalada
    ? `[ESCALADA] Rechazo #${nuevosIntentos}: ${notaTrim}`
    : `Rechazo #${nuevosIntentos}: ${notaTrim}`
  const notaHistorial = fotoPath ? appendFotoARechazo(notaBase, fotoPath) : notaBase

  const resultado = await cambiarEstadoSolicitud({
    solicitudId,
    estadoAnterior: 'resuelta',
    estadoNuevo,
    nota: notaHistorial,
    usuarioId: residenteId,
    accionAudit: escalada ? 'escalada_solicitud' : 'rechazar_solucion',
    detallesAudit: {
      intentos: nuevosIntentos,
      escalada,
      con_foto: fotoPath !== null,
    },
    camposExtraSolicitud: { intentos_resolucion: nuevosIntentos },
  })

  if (!resultado.ok) {
    // Si falla el cambio de estado tras haber subido la foto, intentamos
    // borrarla para no dejar huérfana en storage.
    if (fotoPath) {
      await supabase.storage.from(BUCKET_FOTOS).remove([fotoPath]).catch(() => { })
    }
    return { ok: false, error: resultado.error, escalada }
  }

  // PBI-S4-E01 — La alerta a los administradores (tipo 'alerta_rechazo') la
  // genera el trigger `after_solicitud_estado_changed` al detectar la transición
  // resuelta -> en_progreso/pendiente. Ya no se inserta desde el cliente: la RLS
  // `insert_own` impide crear notificaciones para otros usuarios (los admins).
  return { ok: true, escalada }
}

// ─── Hook de solicitudes pendientes de confirmación ─────────────────────────

const COLS = `
  id, codigo, residente_id, tipo, categoria, descripcion,
  estado, prioridad, imagen_url, piso, departamento,
  confirmada_por_residente, intentos_resolucion, created_at, updated_at
`

/**
 * HU-MANT-07 SPRINT-4
 * Carga las solicitudes del residente en estado 'resuelta' con
 * confirmada_por_residente = false (pendientes de su confirmación).
 * Si las columnas aún no existen en Supabase (migración pendiente),
 * devuelve array vacío sin mostrar error al usuario.
 */
export function useSolicitudesPendientesConfirmacion(residenteId: string | undefined) {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  const fetch = useCallback(async () => {
    if (!residenteId) {
      setSolicitudes([])
      setLoading(false)
      return
    }

    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('solicitudes')
        .select(COLS)
        .eq('residente_id', residenteId)
        .eq('estado', 'resuelta')
        .eq('confirmada_por_residente', false)
        .order('updated_at', { ascending: false })
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return

      // HU-MANT-07 SPRINT-4 — Si la columna no existe aún (migración pendiente),
      // devolvemos array vacío silenciosamente en lugar de mostrar error al usuario.
      if (fetchError) {
        const esMigracionPendiente =
          fetchError.message.includes('confirmada_por_residente') ||
          fetchError.message.includes('intentos_resolucion') ||
          fetchError.message.includes('does not exist')
        if (!esMigracionPendiente) setError(fetchError.message)
        setSolicitudes([])
        return
      }

      setSolicitudes((data ?? []) as Solicitud[])
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message || 'Error al cargar solicitudes')
      }
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setLoading(false)
      }
    }
  }, [residenteId])

  useEffect(() => {
    fetch()
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [fetch])

  return { solicitudes, loading, error, refetch: fetch }
}
