// Sprint 10 · HU-TIENDA-01/02/05/06 — Tipos y utilidades del módulo Tienda.
//
// Refleja el DDL de la tabla `productos` (migración 20260530150000_sprint10_tienda):
//   categoria → enum producto_categoria ('bebidas' | 'comestibles' | 'limpieza' | 'otros')
//   precio    → numeric(10,2) (soles PEN)
//   stock     → integer ≥ 0
//   activo    → boolean (baja LÓGICA; el catálogo del residente filtra activo=true)
//
// El módulo es puro (sin acceso a red): las queries/mutaciones viven en los
// hooks useTiendaAdmin / useTiendaResidente. Aquí van tipos, labels, constantes
// de UI, validación de imagen y los helpers del badge de stock.

import { formatearMonto } from './facturas'

// ─── Enums ───────────────────────────────────────────────────────────────────

export type ProductoCategoria = 'bebidas' | 'comestibles' | 'limpieza' | 'otros'
/** Estado del pedido (modelado para el S11; sin UI de carrito en v1). */
export type PedidoEstado = 'borrador' | 'confirmado' | 'facturado'

// ─── Tipos principales ─────────────────────────────────────────────────────────

export type Producto = {
  id:          string
  nombre:      string
  descripcion: string | null
  categoria:   ProductoCategoria
  precio:      number
  stock:       number
  activo:      boolean
  /** Path dentro del bucket productos-fotos (no URL pública). Se firma al mostrar. */
  imagen_url:  string | null
  created_at:  string
  updated_at:  string
}

/** Payload para el alta/edición de un producto (campos que envía el admin). */
export type ProductoInsert = {
  nombre:      string
  descripcion: string | null
  categoria:   ProductoCategoria
  precio:      number
  stock:       number
  imagen_url?: string | null
  activo?:     boolean   // default true en BD
}

/** Pedido (modelado para el S11; sin flujo de carrito en v1). */
export type Pedido = {
  id:           string
  residente_id: string
  estado:       PedidoEstado
  total:        number
  periodo:      string | null
  created_at:   string
  updated_at:   string
}

/** Línea de pedido. precio_unitario es snapshot del precio al momento de pedir. */
export type PedidoItem = {
  id:              string
  pedido_id:       string
  producto_id:     string
  cantidad:        number
  precio_unitario: number
  created_at:      string
}

// ─── Labels ─────────────────────────────────────────────────────────────────────

/** Catálogo de categorías para selects y filtros (orden de presentación). */
export const CATEGORIAS_PRODUCTO: Array<{ value: ProductoCategoria; label: string }> = [
  { value: 'bebidas',     label: 'Bebidas' },
  { value: 'comestibles', label: 'Comestibles' },
  { value: 'limpieza',    label: 'Limpieza' },
  { value: 'otros',       label: 'Otros' },
]

export const LABEL_PRODUCTO_CATEGORIA: Record<ProductoCategoria, string> = {
  bebidas:     'Bebidas',
  comestibles: 'Comestibles',
  limpieza:    'Limpieza',
  otros:       'Otros',
}

export function labelCategoria(categoria: ProductoCategoria): string {
  return LABEL_PRODUCTO_CATEGORIA[categoria] ?? categoria
}

// ─── Constantes de UI (Retro S10 · Acción 2 → conventions.md) ────────────────────

/** Umbral de "stock bajo": stock ≤ 5 muestra el badge 'Pocas unidades'. */
export const STOCK_BAJO_UMBRAL = 5
/** Debounce de la búsqueda por nombre del catálogo, en ms (HU-TIENDA-06). */
export const BUSQUEDA_DEBOUNCE_MS = 300
/** Tamaño de página de la grilla del residente (paginación lazy de 24 en 24). */
export const CATALOGO_PAGE_SIZE = 24

// ─── Foto del producto (bucket productos-fotos, reusa el patrón del S3) ──────────

export const BUCKET_PRODUCTOS = 'productos-fotos'
/** 2 MB — coincide con el file_size_limit del bucket (decisión del Sprint 10). */
export const PRODUCTO_IMAGEN_MAX_BYTES = 2 * 1024 * 1024
export const PRODUCTO_IMAGEN_MIME_PERMITIDOS = ['image/jpeg', 'image/png']

export type ValidacionImagen = { ok: true } | { ok: false; mensaje: string }

/** Valida tipo (JPEG/PNG) y peso (≤ 2 MB) de la foto del producto antes de subir. */
export function validarImagenProducto(file: File): ValidacionImagen {
  if (!PRODUCTO_IMAGEN_MIME_PERMITIDOS.includes(file.type)) {
    return { ok: false, mensaje: 'Formato no soportado. Usa JPEG o PNG.' }
  }
  if (file.size > PRODUCTO_IMAGEN_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, mensaje: `La imagen pesa ${mb} MB. Máximo permitido: 2 MB.` }
  }
  return { ok: true }
}

/**
 * Path determinístico de la foto: `{producto_id}/{timestamp}_{nombre_seguro}`.
 * La storage policy de productos-fotos valida rol=admin (no carpeta propia),
 * así que el primer segmento agrupa por producto para facilitar limpieza.
 */
export function pathFotoProducto(productoId: string, file: File): string {
  const timestamp = Date.now()
  const nombreSeguro = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto'
  return `${productoId}/${timestamp}_${nombreSeguro}`
}

// ─── Estado de stock — Mejora del Sprint 10 (badges) ─────────────────────────────

export type EstadoStock = 'agotado' | 'bajo' | 'disponible'

/** Clasifica el stock para el badge de la tarjeta: agotado (0), bajo (≤5), normal. */
export function estadoStock(stock: number): EstadoStock {
  if (stock <= 0) return 'agotado'
  if (stock <= STOCK_BAJO_UMBRAL) return 'bajo'
  return 'disponible'
}

/**
 * Etiqueta y clases del badge de stock. 'disponible' no lleva badge (stock normal).
 * Naranja (accent) para 'Pocas unidades'; gris (warm) para 'Agotado'.
 */
export const BADGE_STOCK: Record<Exclude<EstadoStock, 'disponible'>, { label: string; clases: string }> = {
  bajo:    { label: 'Pocas unidades', clases: 'bg-accent-50 text-accent-700 border-accent-200' },
  agotado: { label: 'Agotado',        clases: 'bg-warm-200 text-warm-400 border-warm-300' },
}

/**
 * ¿El producto se podrá pedir (S11)? El stock 0 ya define la regla: agotado no
 * se podrá agregar al carrito. En v1 es puramente informativo (el carrito es S11).
 */
export function disponibleParaPedir(producto: Pick<Producto, 'activo' | 'stock'>): boolean {
  return producto.activo && producto.stock > 0
}

// ─── Filtros del catálogo (HU-TIENDA-06) ─────────────────────────────────────────

export type FiltroDisponibilidad = 'todas' | 'en_stock' | 'agotado'
export type FiltroCategoria = ProductoCategoria | 'todas'

// ─── Formato ─────────────────────────────────────────────────────────────────────

/** Formatea un precio en soles (PEN). Reusa el formateador canónico del proyecto. */
export const formatearPrecio = formatearMonto
