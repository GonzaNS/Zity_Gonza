// HU-MANT-03 SPRINT-4
// Hook que carga las solicitudes asignadas al técnico actualmente logueado.
// Une la tabla `solicitudes` con `asignaciones` (para obtener nota del admin
// y fecha de asignación) y con `usuarios` (para mostrar datos del residente).
// El RLS de Supabase ya filtra las asignaciones por auth.uid(), por lo que
// el frontend no necesita hardcodear el tecnico_id.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { EstadoSolicitud } from '../types/database'

const QUERY_TIMEOUT_MS = 8000

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ResidenteResumenTecnico = {
  nombre: string
  apellido: string
  email: string
  telefono: string | null
  piso: string | null
  departamento: string | null
}

export type SolicitudAsignadaTecnico = {
  // Solicitud base
  id: string
  codigo: string | null
  tipo: string
  categoria: string
  descripcion: string
  estado: EstadoSolicitud
  prioridad: string
  imagen_url: string | null
  piso: string | null
  departamento: string | null
  created_at: string
  updated_at: string
  // Asignación
  asignacion_id: string | null
  nota_admin: string | null
  fecha_asignacion: string | null
  // Residente
  residente: ResidenteResumenTecnico | null
  residente_id: string
}

// HU-MANT-03 SPRINT-4 — Filtros para la vista del técnico
export type FiltrosTecnico = {
  estado: EstadoSolicitud | ''
  prioridad: 'normal' | 'urgente' | ''
}

// ─── useSolicitudesTecnico ───────────────────────────────────────────────────

/**
 * HU-MANT-03 SPRINT-4
 * Retorna las solicitudes asignadas al técnico logueado.
 * La query une asignaciones → solicitudes → residente en dos pasos:
 *   1. Trae las asignaciones del técnico (RLS filtra por auth.uid())
 *   2. Para cada asignación, incluye la solicitud y el residente embebidos
 *
 * Los filtros de estado y prioridad se aplican en el cliente para evitar
 * joins complejos multi-tabla que PostgREST no siempre resuelve en una sola
 * query con filtros cruzados.
 */
export function useSolicitudesTecnico(filtros: FiltrosTecnico) {
  const [solicitudes, setSolicitudes] = useState<SolicitudAsignadaTecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const controllerRef = useRef<AbortController | null>(null)

  const fetchSolicitudes = useCallback(async () => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    const timeoutId = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

    setLoading(true)
    setError(null)

    try {
      // HU-MANT-03 SPRINT-4 — Traer asignaciones del técnico logueado
      // con la solicitud y el residente embebidos
      const { data, error: fetchError } = await supabase
        .from('asignaciones')
        .select(`
          id,
          notas,
          fecha_asignacion,
          solicitud:solicitudes (
            id, codigo, residente_id, tipo, categoria, descripcion,
            estado, prioridad, imagen_url, piso, departamento,
            created_at, updated_at,
            residente:usuarios!solicitudes_residente_id_fkey (
              nombre, apellido, email, telefono, piso, departamento
            )
          )
        `)
        .order('fecha_asignacion', { ascending: false })
        .abortSignal(controller.signal)

      if (controller.signal.aborted) return

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      // Normalizar y aplanar la respuesta
      const normalizadas: SolicitudAsignadaTecnico[] = []

      for (const row of data ?? []) {
        const sol = Array.isArray(row.solicitud)
          ? row.solicitud[0]
          : row.solicitud

        if (!sol) continue

        const resRaw = Array.isArray(sol.residente)
          ? sol.residente[0]
          : sol.residente

        const residente: ResidenteResumenTecnico | null = resRaw
          ? {
            nombre: resRaw.nombre,
            apellido: resRaw.apellido,
            email: resRaw.email,
            telefono: resRaw.telefono ?? null,
            piso: resRaw.piso ?? null,
            departamento: resRaw.departamento ?? null,
          }
          : null

        normalizadas.push({
          id: sol.id,
          codigo: sol.codigo ?? null,
          tipo: sol.tipo,
          categoria: sol.categoria,
          descripcion: sol.descripcion,
          estado: sol.estado as EstadoSolicitud,
          prioridad: sol.prioridad,
          imagen_url: sol.imagen_url ?? null,
          piso: sol.piso ?? null,
          departamento: sol.departamento ?? null,
          created_at: sol.created_at,
          updated_at: sol.updated_at,
          asignacion_id: row.id ?? null,
          nota_admin: (row.notas as string | null) ?? null,
          fecha_asignacion: (row.fecha_asignacion as string | null) ?? null,
          residente,
          residente_id: sol.residente_id,
        })
      }

      // HU-MANT-03 SPRINT-4 — Filtros aplicados en cliente
      const filtradas = normalizadas.filter(s => {
        if (filtros.estado && s.estado !== filtros.estado) return false
        if (filtros.prioridad && s.prioridad !== filtros.prioridad) return false
        return true
      })

      setSolicitudes(filtradas)
    } catch (err) {
      if (!controller.signal.aborted) {
        setError((err as Error).message || 'Error al cargar solicitudes')
      }
    } finally {
      clearTimeout(timeoutId)
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setLoading(false)
      }
    }
  }, [filtros.estado, filtros.prioridad])

  useEffect(() => {
    fetchSolicitudes()
    return () => {
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [fetchSolicitudes])

  return { solicitudes, loading, error, refetch: fetchSolicitudes }
}

// ─── PBI-S3-E01 Funciones de cierre ──────────────────────────────────────────

// PBI-S3-E01 — Sube la foto de cierre del técnico al bucket solicitudes-fotos.
// El primer segmento del path DEBE ser el uid de quien sube (el técnico): la
// storage policy `solicitudes_fotos_insert_propio` exige
// (storage.foldername(name))[1] = auth.uid(). Por eso `propietarioId` es el
// técnico, no el residente. La lectura funciona porque el SELECT del bucket es
// para cualquier usuario autenticado.
export async function subirFotoCierre(file: File, propietarioId: string, solicitud_id: string): Promise<string> {
  const timestamp = Date.now()
  const nombreSeguro = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto'
  const filePath = `${propietarioId}/${solicitud_id}/cierre_${timestamp}_${nombreSeguro}`

  const { error } = await supabase.storage.from('solicitudes-fotos').upload(filePath, file)
  if (error) throw error

  return filePath
}

export function serializarNotaCierre(textoOriginal: string, filePath: string): string {
  return `${textoOriginal} [cierre: ${filePath}]`
}

export function parsearNotaCierre(nota: string | null): { texto: string; pathFoto: string | null } {
  if (!nota) return { texto: '', pathFoto: null }
  const regex = /(.*?) \[cierre: (.*?)\]$/s
  const match = regex.exec(nota)
  if (match && match[1] !== undefined && match[2] !== undefined) {
    return { texto: match[1].trim(), pathFoto: match[2].trim() }
  }
  return { texto: nota, pathFoto: null }
}
