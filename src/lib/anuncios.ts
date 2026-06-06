// Sprint 12 · HU-ANUNCIO — Tipos y utilidades del módulo Comunicación (Tablón).
//
// Refleja el DDL de la tabla `anuncios` (migración sprint12_anuncios_tablon):
//   categoria     → enum anuncio_categoria ('aviso'|'mantenimiento'|'asamblea'|'seguridad'|'general')
//   prioridad     → enum anuncio_prioridad ('normal'|'importante'|'urgente')
//   imagen_url    → path en bucket anuncios-adjuntos (imagen o PDF); se firma al mostrar
//   fijado        → boolean (destacado arriba del tablón)
//   vigente_hasta → date | null (null = sin caducidad)
//   archivado     → boolean (baja LÓGICA; el feed del residente filtra archivado=false)
//
// Módulo PURO (sin acceso a red): las queries/mutaciones viven en los hooks
// useAnunciosAdmin / useAnunciosResidente. Aquí van tipos, labels, constantes de
// UI, validación del adjunto y los helpers del feed (vigencia, orden, extracto).

// ─── Enums ───────────────────────────────────────────────────────────────────

export type AnuncioCategoria = 'aviso' | 'mantenimiento' | 'asamblea' | 'seguridad' | 'general'
export type AnuncioPrioridad = 'normal' | 'importante' | 'urgente'

// ─── Tipos principales ─────────────────────────────────────────────────────────

export type Anuncio = {
  id:            string
  titulo:        string
  cuerpo:        string
  categoria:     AnuncioCategoria
  prioridad:     AnuncioPrioridad
  /** Path dentro del bucket anuncios-adjuntos (no URL pública). Imagen o PDF. */
  imagen_url:    string | null
  fijado:        boolean
  vigente_hasta: string | null
  archivado:     boolean
  publicado_por: string | null
  created_at:    string
  updated_at:    string
}

/** Payload para el alta/edición de un anuncio (campos que envía el admin). */
export type AnuncioInsert = {
  titulo:         string
  cuerpo:         string
  categoria:      AnuncioCategoria
  prioridad:      AnuncioPrioridad
  imagen_url?:    string | null
  fijado?:        boolean
  vigente_hasta?: string | null
}

/** Estado de lectura por residente (tabla anuncio_lecturas, PK compuesta). */
export type AnuncioLectura = {
  anuncio_id:   string
  residente_id: string
  leido_at:     string
}

/** Anuncio enriquecido con el estado de lectura del residente (feed). */
export type AnuncioConLectura = Anuncio & { leido: boolean }

// ─── Labels ─────────────────────────────────────────────────────────────────────

export const CATEGORIAS_ANUNCIO: Array<{ value: AnuncioCategoria; label: string }> = [
  { value: 'aviso',         label: 'Aviso' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'asamblea',      label: 'Asamblea' },
  { value: 'seguridad',     label: 'Seguridad' },
  { value: 'general',       label: 'General' },
]

export const LABEL_ANUNCIO_CATEGORIA: Record<AnuncioCategoria, string> = {
  aviso:         'Aviso',
  mantenimiento: 'Mantenimiento',
  asamblea:      'Asamblea',
  seguridad:     'Seguridad',
  general:       'General',
}

export function labelCategoria(categoria: AnuncioCategoria): string {
  return LABEL_ANUNCIO_CATEGORIA[categoria] ?? categoria
}

export const PRIORIDADES_ANUNCIO: Array<{ value: AnuncioPrioridad; label: string }> = [
  { value: 'normal',     label: 'Normal' },
  { value: 'importante', label: 'Importante' },
  { value: 'urgente',    label: 'Urgente' },
]

export const LABEL_ANUNCIO_PRIORIDAD: Record<AnuncioPrioridad, string> = {
  normal:     'Normal',
  importante: 'Importante',
  urgente:    'Urgente',
}

export function labelPrioridad(prioridad: AnuncioPrioridad): string {
  return LABEL_ANUNCIO_PRIORIDAD[prioridad] ?? prioridad
}

// ─── Colores de los badges (paleta del proyecto: index.css) ──────────────────────

/** Clases del chip de categoría (un color por categoría, para distinguir de un vistazo). */
export const BADGE_CATEGORIA: Record<AnuncioCategoria, string> = {
  aviso:         'bg-primary-100 text-primary-700 border-primary-200',
  mantenimiento: 'bg-accent-50 text-accent-700 border-accent-200',
  asamblea:      'bg-success/10 text-success border-success/20',
  seguridad:     'bg-error/10 text-error border-error/20',
  general:       'bg-warm-100 text-warm-500 border-warm-200',
}

/**
 * Chip de prioridad. 'normal' no lleva badge (es lo esperado); 'importante' en
 * ámbar (accent) y 'urgente' en rojo (error) para que destaquen (R6).
 */
export const BADGE_PRIORIDAD: Record<AnuncioPrioridad, { label: string; clases: string } | null> = {
  normal:     null,
  importante: { label: 'Importante', clases: 'bg-accent-100 text-accent-700 border-accent-300' },
  urgente:    { label: 'Urgente',    clases: 'bg-error/10 text-error border-error/20' },
}

// ─── Adjunto (bucket anuncios-adjuntos, reusa el patrón productos-fotos) ──────────

export const BUCKET_ANUNCIOS = 'anuncios-adjuntos'
/** 2 MB — coincide con el file_size_limit del bucket (decisión del Sprint 12). */
export const ANUNCIO_ADJUNTO_MAX_BYTES = 2 * 1024 * 1024
/** JPEG/PNG/PDF — el tablón admite imagen o documento adjunto. */
export const ANUNCIO_ADJUNTO_MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'application/pdf']

/** Límites de texto del formulario (alineados con la UX; la BD solo exige no-vacío). */
export const TITULO_MAX = 120
export const CUERPO_MAX = 4000

export type ValidacionAdjunto = { ok: true } | { ok: false; mensaje: string }

/** Valida tipo (JPEG/PNG/PDF) y peso (≤ 2 MB) del adjunto antes de subir (R4). */
export function validarAdjunto(file: File): ValidacionAdjunto {
  if (!ANUNCIO_ADJUNTO_MIME_PERMITIDOS.includes(file.type)) {
    return { ok: false, mensaje: 'Formato no soportado. Usa JPEG, PNG o PDF.' }
  }
  if (file.size > ANUNCIO_ADJUNTO_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, mensaje: `El archivo pesa ${mb} MB. Máximo permitido: 2 MB.` }
  }
  return { ok: true }
}

/**
 * Path determinístico del adjunto: `{anuncio_id}/{timestamp}_{nombre_seguro}`.
 * La storage policy valida rol=admin; el primer segmento agrupa por anuncio.
 */
export function pathAdjuntoAnuncio(anuncioId: string, file: File): string {
  const timestamp = Date.now()
  const punto = file.name.lastIndexOf('.')
  const ext = punto >= 0 ? file.name.slice(punto + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const base = (punto >= 0 ? file.name.slice(0, punto) : file.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'adjunto'
  return ext ? `${anuncioId}/${timestamp}_${base}.${ext}` : `${anuncioId}/${timestamp}_${base}`
}

/** ¿El adjunto es un PDF? (se detecta por extensión del path). */
export function esPdf(path: string | null | undefined): boolean {
  return !!path && /\.pdf$/i.test(path)
}

// ─── Helpers del feed ────────────────────────────────────────────────────────────

/** Hoy en America/Lima (UTC-5), formato 'YYYY-MM-DD' (convenciones del proyecto §2). */
export function hoyLimaISO(): string {
  const lima = new Date(Date.now() - 5 * 3600 * 1000)
  return lima.toISOString().slice(0, 10)
}

/**
 * Extracto en texto plano del cuerpo (markdown) para la tarjeta del feed:
 * quita imágenes/enlaces/marcas, colapsa espacios y trunca con elipsis.
 */
export function extracto(cuerpo: string, max = 160): string {
  const plano = cuerpo
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // imágenes ![alt](url)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')    // enlaces [texto](url) → texto
    .replace(/[*_`#>~]/g, '')                    // marcas markdown
    .replace(/\s+/g, ' ')
    .trim()
  if (plano.length <= max) return plano
  return plano.slice(0, max).trimEnd() + '…'
}

/**
 * ¿El anuncio está vigente hoy? No archivado y (sin caducidad o vigente_hasta ≥ hoy).
 * Compara fechas como string 'YYYY-MM-DD' (convenciones §2, evita desfase UTC).
 */
export function estaVigente(
  a: Pick<Anuncio, 'vigente_hasta' | 'archivado'>,
  hoyISO: string = hoyLimaISO(),
): boolean {
  if (a.archivado) return false
  if (!a.vigente_hasta) return true
  return a.vigente_hasta >= hoyISO
}

/**
 * Orden del tablón: los fijados primero, luego por fecha de publicación (desc).
 * No muta el array original.
 */
export function ordenarFeed<T extends Pick<Anuncio, 'fijado' | 'created_at'>>(anuncios: T[]): T[] {
  return [...anuncios].sort((a, b) => {
    if (a.fijado !== b.fijado) return a.fijado ? -1 : 1
    return b.created_at.localeCompare(a.created_at)
  })
}

// ─── Filtros del tablón (Mejora HU-ANUNCIO) ──────────────────────────────────────

export type FiltroCategoriaAnuncio = AnuncioCategoria | 'todas'

/** Filtra por categoría ('todas' no filtra) conservando el orden recibido. */
export function filtrarPorCategoria<T extends Pick<Anuncio, 'categoria'>>(
  anuncios: T[],
  filtro: FiltroCategoriaAnuncio,
): T[] {
  if (filtro === 'todas') return anuncios
  return anuncios.filter(a => a.categoria === filtro)
}
