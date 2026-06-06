// Sprint 12 · HU-ANUNCIO-02 — Hook del tablón de anuncios para el admin.
//
// Lista TODOS los anuncios (vigentes, vencidos y archivados; RLS admin) y firma
// los adjuntos del bucket anuncios-adjuntos. Las mutaciones (alta/edición/
// archivado/fijado + subida del adjunto) se exponen como funciones que la página
// orquesta. La sanitización del contenido (A03) y la auditoría las hace la BD
// (triggers before_anuncio_sanitizar / after_anuncio_cambio), no el cliente.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  BUCKET_ANUNCIOS,
  pathAdjuntoAnuncio,
  type Anuncio,
  type AnuncioInsert,
} from '../lib/anuncios'

/** TTL de la URL firmada del adjunto, 1 hora (igual que productos-fotos). */
const SIGNED_URL_TTL = 60 * 60

/** Firma una lista de paths del bucket anuncios-adjuntos (TTL 1 h). */
export async function firmarAdjuntos(paths: Array<string | null>): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const relativas = [...new Set(paths.filter((p): p is string => !!p))]
  if (relativas.length === 0) return result

  const { data } = await supabase.storage
    .from(BUCKET_ANUNCIOS)
    .createSignedUrls(relativas, SIGNED_URL_TTL)

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) result.set(item.path, item.signedUrl)
  }
  return result
}

export type UseAnunciosAdminResult = {
  anuncios: Anuncio[]
  /** Mapa path → URL firmada del adjunto. */
  adjuntos: Map<string, string>
  loading: boolean
  error: string | null
  recargar: () => void
}

export function useAnunciosAdmin(): UseAnunciosAdminResult {
  const [anuncios, setAnuncios] = useState<Anuncio[]>([])
  const [adjuntos, setAdjuntos] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Admin ve todo: vigentes primero (no archivados), fijados arriba, luego fecha.
    const { data, error: err } = await supabase
      .from('anuncios')
      .select('*')
      .order('archivado', { ascending: true })
      .order('fijado', { ascending: false })
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    const items = (data ?? []) as Anuncio[]
    setAnuncios(items)
    setAdjuntos(await firmarAdjuntos(items.map(a => a.imagen_url)))
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  return { anuncios, adjuntos, loading, error, recargar: cargar }
}

// ─── Mutaciones del tablón ───────────────────────────────────────────────────
// No son hooks: las invoca la página en sus handlers. Devuelven un Result
// discriminado para toasts precisos. La auditoría es automática (trigger).

export type ResultadoMutacion = { ok: true; id?: string } | { ok: false; error: string }

/** Alta de un anuncio. Devuelve el id para subir el adjunto a su carpeta. */
export async function crearAnuncio(datos: AnuncioInsert): Promise<ResultadoMutacion> {
  const { data, error } = await supabase
    .from('anuncios')
    .insert({
      ...datos,
      imagen_url: datos.imagen_url ?? null,
      vigente_hasta: datos.vigente_hasta || null,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id as string }
}

/** Edición de un anuncio (campos parciales). */
export async function actualizarAnuncio(
  id: string,
  datos: Partial<AnuncioInsert>,
): Promise<ResultadoMutacion> {
  const payload = { ...datos }
  if ('vigente_hasta' in payload) payload.vigente_hasta = payload.vigente_hasta || null
  const { error } = await supabase.from('anuncios').update(payload).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** Archiva (baja lógica) o restaura un anuncio. Nunca DELETE. */
export async function archivarAnuncio(id: string, archivado: boolean): Promise<ResultadoMutacion> {
  const { error } = await supabase.from('anuncios').update({ archivado }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** Fija o desfija un anuncio (lo destaca arriba del tablón). */
export async function fijarAnuncio(id: string, fijado: boolean): Promise<ResultadoMutacion> {
  const { error } = await supabase.from('anuncios').update({ fijado }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true, id }
}

/** Sube el adjunto a anuncios-adjuntos y devuelve el PATH (se guarda en imagen_url). */
export async function subirAdjuntoAnuncio(
  file: File,
  anuncioId: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const path = pathAdjuntoAnuncio(anuncioId, file)
  const { error } = await supabase.storage
    .from(BUCKET_ANUNCIOS)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (error) return { ok: false, error: error.message }
  return { ok: true, path }
}
