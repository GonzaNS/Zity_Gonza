// Sprint 10 · HU-TIENDA-05/06 — Hook del catálogo de la tienda para el residente.
//
// Carga productos activos (la RLS ya filtra activo=true para no-admin) con
// paginación lazy (24 en 24), filtros por categoría y disponibilidad, y búsqueda
// por nombre — todo en servidor, apoyado en el índice (categoria, activo). El
// debounce de la búsqueda lo aplica la página antes de pasar el término aquí.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { firmarFotosProductos } from './useTiendaAdmin'
import {
  CATALOGO_PAGE_SIZE,
  type Producto,
  type FiltroCategoria,
  type FiltroDisponibilidad,
} from '../lib/tienda'

export type FiltrosCatalogo = {
  categoria: FiltroCategoria
  disponibilidad: FiltroDisponibilidad
  /** Término de búsqueda ya "debounced" por la página. */
  busqueda: string
}

export type UseTiendaResidenteResult = {
  productos: Producto[]
  fotos: Map<string, string>
  loading: boolean
  loadingMore: boolean
  error: string | null
  hayMas: boolean
  cargarMas: () => void
}

export function useTiendaResidente({ categoria, disponibilidad, busqueda }: FiltrosCatalogo): UseTiendaResidenteResult {
  const [productos, setProductos] = useState<Producto[]>([])
  const [fotos, setFotos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const offsetRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  // Construye la query con los filtros activos (server-side, usa el índice).
  const construirQuery = useCallback((desde: number, hasta: number, signal?: AbortSignal) => {
    let q = supabase.from('productos').select('*').eq('activo', true)
    if (categoria !== 'todas') q = q.eq('categoria', categoria)
    if (disponibilidad === 'en_stock') q = q.gt('stock', 0)
    else if (disponibilidad === 'agotado') q = q.eq('stock', 0)
    const term = busqueda.trim()
    if (term) q = q.ilike('nombre', `%${term}%`)
    q = q.order('nombre', { ascending: true }).range(desde, hasta)
    if (signal) q = q.abortSignal(signal)
    return q
  }, [categoria, disponibilidad, busqueda])

  const cargarPrimera = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError(null)
    offsetRef.current = 0

    const { data, error: err } = await construirQuery(0, CATALOGO_PAGE_SIZE - 1, controller.signal)
    if (controller.signal.aborted) return

    if (err) {
      // Un cambio de filtro aborta la query previa: no es un error real.
      const isAbort = err.name === 'AbortError' || /abort/i.test(err.message ?? '')
      if (!isAbort) setError(err.message)
      setLoading(false)
      return
    }

    const items = (data ?? []) as Producto[]
    setProductos(items)
    setHayMas(items.length === CATALOGO_PAGE_SIZE)
    offsetRef.current = items.length
    setFotos(await firmarFotosProductos(items.map(p => p.imagen_url)))
    setLoading(false)
  }, [construirQuery])

  useEffect(() => {
    // Reset síncrono antes del fetch (patrón del proyecto, ver useFacturasResidente).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarPrimera()
    return () => { abortRef.current?.abort() }
  }, [cargarPrimera])

  const cargarMas = useCallback(async () => {
    if (loadingMore || !hayMas) return
    setLoadingMore(true)
    const desde = offsetRef.current
    const hasta = desde + CATALOGO_PAGE_SIZE - 1

    const { data, error: err } = await construirQuery(desde, hasta)
    if (err) {
      setError(err.message)
      setLoadingMore(false)
      return
    }

    const nuevas = (data ?? []) as Producto[]
    setProductos(prev => [...prev, ...nuevas])
    setHayMas(nuevas.length === CATALOGO_PAGE_SIZE)
    offsetRef.current += nuevas.length
    const nuevasUrls = await firmarFotosProductos(nuevas.map(p => p.imagen_url))
    setFotos(prev => new Map([...prev, ...nuevasUrls]))
    setLoadingMore(false)
  }, [construirQuery, loadingMore, hayMas])

  return { productos, fotos, loading, loadingMore, error, hayMas, cargarMas }
}
