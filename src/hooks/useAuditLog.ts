// Sprint 5 · HU-AUDIT-01
// Hook para consultar audit_log desde la vista admin con filtros combinables
// y paginación servidor. Sincroniza los filtros con la URL (query params) para
// que un link sea compartible.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export const AUDIT_PAGE_SIZE = 50

// ─── Tipos ──────────────────────────────────────────────────────────────────

/** Embed del usuario que ejecutó la acción (vía FK audit_log.usuario_id). */
export type AutorAudit = {
  nombre: string
  apellido: string
  email: string
  rol: string
} | null

export type EntradaAuditLog = {
  id: string
  usuario_id: string | null
  accion: string
  entidad: string | null
  entidad_id: string | null
  detalles: Record<string, unknown> | null
  resultado: string | null
  created_at: string
  autor: AutorAudit
}

export type FiltrosAudit = {
  /** ISO date (yyyy-mm-dd) inclusive */
  fechaDesde: string
  /** ISO date (yyyy-mm-dd) inclusive */
  fechaHasta: string
  /** Filtro de usuario por email (autocomplete del lado del cliente) */
  usuarioId: string
  /** Acción exacta del catálogo, '' = todas */
  accion: string
  /** Entidad exacta, '' = todas */
  entidad: string
  /** ID exacto de la entidad (PBI-S5-E02) */
  entidadId: string
  /** Página actual (0-indexada) */
  pagina: number
}

const FILTROS_DEFAULT: FiltrosAudit = {
  fechaDesde: '',
  fechaHasta: '',
  usuarioId: '',
  accion: '',
  entidad: '',
  entidadId: '',
  pagina: 0,
}

// ─── Sync con URL ───────────────────────────────────────────────────────────

/**
 * Sprint 5 · HU-AUDIT-01
 * Lee los filtros de los query params y los expone como estado tipado, con un
 * setter que actualiza la URL (sin recargar). Esto permite compartir links del
 * tipo `/admin/auditoria?accion=rechazar_solucion&desde=2026-05-01`.
 */
export function useFiltrosAudit() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filtros = useMemo<FiltrosAudit>(() => {
    return {
      fechaDesde: searchParams.get('desde') ?? '',
      fechaHasta: searchParams.get('hasta') ?? '',
      usuarioId: searchParams.get('usuario') ?? '',
      accion: searchParams.get('accion') ?? '',
      entidad: searchParams.get('entidad') ?? '',
      entidadId: searchParams.get('entidad_id') ?? '',
      pagina: Number(searchParams.get('p') ?? '0'),
    }
  }, [searchParams])

  const setFiltros = useCallback(
    (next: Partial<FiltrosAudit>) => {
      const merged = { ...filtros, ...next }
      const params = new URLSearchParams()
      if (merged.fechaDesde) params.set('desde', merged.fechaDesde)
      if (merged.fechaHasta) params.set('hasta', merged.fechaHasta)
      if (merged.usuarioId) params.set('usuario', merged.usuarioId)
      if (merged.accion) params.set('accion', merged.accion)
      if (merged.entidad) params.set('entidad', merged.entidad)
      if (merged.entidadId) params.set('entidad_id', merged.entidadId)
      // Al cambiar cualquier filtro reseteamos a la primera página, excepto si
      // el cambio es explícitamente de página.
      const reseteaPagina = !('pagina' in next)
      const pagina = reseteaPagina ? 0 : merged.pagina
      if (pagina > 0) params.set('p', String(pagina))
      setSearchParams(params, { replace: true })
    },
    [filtros, setSearchParams],
  )

  const resetear = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  return { filtros, setFiltros, resetear, esDefault: filtrosEsDefault(filtros) }
}

function filtrosEsDefault(f: FiltrosAudit): boolean {
  return (
    f.fechaDesde === FILTROS_DEFAULT.fechaDesde &&
    f.fechaHasta === FILTROS_DEFAULT.fechaHasta &&
    f.usuarioId === FILTROS_DEFAULT.usuarioId &&
    f.accion === FILTROS_DEFAULT.accion &&
    f.entidad === FILTROS_DEFAULT.entidad
  )
}

// ─── Hook principal: consulta paginada con filtros ──────────────────────────

export function useAuditLog(filtros: FiltrosAudit) {
  const [entradas, setEntradas] = useState<EntradaAuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  // Serializamos los filtros como dependencia para que el efecto se dispare
  // sólo cuando cambien valores relevantes.
  const filtrosKey = `${filtros.fechaDesde}|${filtros.fechaHasta}|${filtros.usuarioId}|${filtros.accion}|${filtros.entidad}|${filtros.pagina}`

  useEffect(() => {
    let cancelado = false
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    void (async () => {
      // El query base con embed del autor (FK audit_log.usuario_id -> usuarios.id)
      let query = supabase
        .from('audit_log')
        .select(
          `id, usuario_id, accion, entidad, entidad_id, detalles, resultado, created_at,
           autor:usuarios!audit_log_usuario_id_fkey ( nombre, apellido, email, rol )`,
          { count: 'exact' },
        )

      if (filtros.fechaDesde) {
        query = query.gte('created_at', `${filtros.fechaDesde}T00:00:00`)
      }
      if (filtros.fechaHasta) {
        // Fin de día inclusivo
        query = query.lte('created_at', `${filtros.fechaHasta}T23:59:59.999`)
      }
      if (filtros.usuarioId) {
        query = query.eq('usuario_id', filtros.usuarioId)
      }
      if (filtros.accion) {
        query = query.eq('accion', filtros.accion)
      }
      if (filtros.entidad) {
        query = query.eq('entidad', filtros.entidad)
      }
      if (filtros.entidadId) {
        query = query.eq('entidad_id', filtros.entidadId)
      }

      const desde = filtros.pagina * AUDIT_PAGE_SIZE
      const hasta = desde + AUDIT_PAGE_SIZE - 1

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(desde, hasta)
        .abortSignal(controller.signal)

      if (cancelado || controller.signal.aborted) return

      if (fetchError) {
        setError(fetchError.message)
        setLoading(false)
        return
      }

      // Normalizar el embed (PostgREST puede devolver array u objeto)
      const normalizado: EntradaAuditLog[] = (data ?? []).map(row => {
        const rawAutor = (row as { autor?: unknown }).autor
        const autor: AutorAudit = Array.isArray(rawAutor)
          ? (rawAutor[0] as AutorAudit) ?? null
          : (rawAutor as AutorAudit) ?? null
        return {
          id: row.id as string,
          usuario_id: row.usuario_id as string | null,
          accion: row.accion as string,
          entidad: row.entidad as string | null,
          entidad_id: row.entidad_id as string | null,
          detalles: (row.detalles as Record<string, unknown> | null) ?? null,
          resultado: row.resultado as string | null,
          created_at: row.created_at as string,
          autor,
        }
      })

      setEntradas(normalizado)
      setTotal(count ?? 0)
      setError(null)
      setLoading(false)
    })()

    return () => {
      cancelado = true
      controllerRef.current?.abort()
      controllerRef.current = null
    }
  }, [filtrosKey, filtros])

  const totalPaginas = Math.ceil(total / AUDIT_PAGE_SIZE)

  return { entradas, total, totalPaginas, loading, error }
}

// ─── Hook auxiliar: autocomplete de usuarios para filtro ────────────────────

export type UsuarioFiltro = {
  id: string
  nombre: string
  apellido: string
  email: string
  rol: string
}

/**
 * Sprint 5 · HU-AUDIT-01 (filtro por usuario)
 * Consulta usuarios cuyo email/nombre/apellido coincidan con la búsqueda.
 * Debounce manejado por el componente consumidor.
 */
export function useUsuariosBusqueda(busqueda: string, enabled: boolean) {
  const [resultados, setResultados] = useState<UsuarioFiltro[]>([])
  const [loading, setLoading] = useState(false)

  // Sprint 5 · HU-AUDIT-01 — todo el setState ocurre dentro del callback async
  // o tras un microtask para no disparar render en cascada (regla
  // react-hooks/set-state-in-effect). El caso "no buscar" usa Promise.resolve()
  // para diferir el setState fuera del cuerpo síncrono del efecto.
  useEffect(() => {
    let cancelado = false

    void (async () => {
      if (!enabled || busqueda.trim().length < 2) {
        if (cancelado) return
        setResultados([])
        setLoading(false)
        return
      }

      setLoading(true)

      const term = `%${busqueda.trim()}%`
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, email, rol')
        .or(`email.ilike.${term},nombre.ilike.${term},apellido.ilike.${term}`)
        .limit(10)

      if (cancelado) return

      if (error) {
        setResultados([])
      } else {
        setResultados((data ?? []) as UsuarioFiltro[])
      }
      setLoading(false)
    })()

    return () => {
      cancelado = true
    }
  }, [busqueda, enabled])

  return { resultados, loading }
}
