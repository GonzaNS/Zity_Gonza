// Sprint 10 · HU-TIENDA-02 — Hook del catálogo de la tienda para el admin.
//
// Lista TODOS los productos (activos e inactivos, RLS admin) y firma las fotos
// del bucket productos-fotos para mostrarlas. Las mutaciones (alta/edición/baja/
// reactivación + subida de foto) se exponen como funciones que la página
// orquesta. La auditoría la registra el trigger after_producto_cambio en BD
// (no el cliente), igual que crear_solicitud (S3) y registrar_pago_factura (S9).

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  BUCKET_PRODUCTOS,
  pathFotoProducto,
  type Producto,
  type ProductoInsert,
} from '../lib/tienda'

/** TTL de la URL firmada de la foto, 1 hora (igual que solicitudes-fotos). */
const SIGNED_URL_TTL = 60 * 60

export type UseTiendaAdminResult = {
  productos: Producto[]
  /** Mapa path → URL firmada para mostrar las fotos. */
  fotos: Map<string, string>
  loading: boolean
  error: string | null
  recargar: () => void
}

/** Firma una lista de paths del bucket productos-fotos (TTL 1 h). */
export async function firmarFotosProductos(paths: Array<string | null>): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const relativas = [...new Set(paths.filter((p): p is string => !!p))]
  if (relativas.length === 0) return result

  const { data } = await supabase.storage
    .from(BUCKET_PRODUCTOS)
    .createSignedUrls(relativas, SIGNED_URL_TTL)

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl)
  }
  return result
}

export function useTiendaAdmin(): UseTiendaAdminResult {
  const [productos, setProductos] = useState<Producto[]>([])
  const [fotos, setFotos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Admin ve activos e inactivos; los activos primero, luego por nombre.
    const { data, error: err } = await supabase
      .from('productos')
      .select('*')
      .order('activo', { ascending: false })
      .order('nombre', { ascending: true })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const prods = (data ?? []) as Producto[]
    setProductos(prods)
    setFotos(await firmarFotosProductos(prods.map(p => p.imagen_url)))
    setLoading(false)
  }, [])

  useEffect(() => {
    // setState de reset síncrono dentro de cargar(): patrón del proyecto
    // (ver useFacturasAdmin). Falso positivo de set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  return { productos, fotos, loading, error, recargar: cargar }
}

// ─── Mutaciones del catálogo ────────────────────────────────────────────────
// No son hooks: las invoca la página dentro de sus handlers. Devuelven un
// Result discriminado para mostrar toasts precisos. La auditoría es automática
// (trigger after_producto_cambio).

export type ResultadoMutacion = { ok: true; id?: string } | { ok: false; error: string }

/** Alta de un producto. Devuelve el id para subir la foto a su carpeta. */
export async function crearProducto(datos: ProductoInsert): Promise<ResultadoMutacion> {
  const { data, error } = await supabase
    .from('productos')
    .insert({ ...datos, descripcion: datos.descripcion || null })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id as string }
}

/** Edición de un producto (campos parciales). */
export async function actualizarProducto(
  id: string,
  datos: Partial<ProductoInsert>,
): Promise<ResultadoMutacion> {
  const payload = 'descripcion' in datos ? { ...datos, descripcion: datos.descripcion || null } : datos
  const { error } = await supabase.from('productos').update(payload).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** Baja lógica (activo=false) o reactivación (activo=true). Nunca DELETE. */
export async function cambiarActivoProducto(id: string, activo: boolean): Promise<ResultadoMutacion> {
  const { error } = await supabase.from('productos').update({ activo }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** Sube la foto a productos-fotos y devuelve el PATH (lo que se guarda en imagen_url). */
export async function subirFotoProducto(
  file: File,
  productoId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const path = pathFotoProducto(productoId, file)
  const { error } = await supabase.storage
    .from(BUCKET_PRODUCTOS)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}
