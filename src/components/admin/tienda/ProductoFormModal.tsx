// Sprint 10 · HU-TIENDA-02 — Modal de alta / edición de producto.
//
// Orquesta el guardado: en alta crea el producto y luego sube la foto a su
// carpeta ({id}/...); en edición actualiza campos (+ foto si se cambió). La
// auditoría la registra el trigger after_producto_cambio (BD). Validación
// cliente (nombre obligatorio, precio/stock ≥ 0); la BD valida en paralelo.

import { useRef, useState } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import {
  CATEGORIAS_PRODUCTO,
  type Producto,
  type ProductoCategoria,
  type ProductoInsert,
} from '../../../lib/tienda'
import {
  crearProducto,
  actualizarProducto,
  subirFotoProducto,
} from '../../../hooks/useTiendaAdmin'
import UploadFotoProducto from './UploadFotoProducto'

type Props = {
  /** null = alta; un producto = edición. */
  producto: Producto | null
  /** URL firmada de la foto actual (edición). */
  fotoActualUrl?: string | null
  onClose: () => void
  onGuardado: (mensaje: string) => void
}

type Campos = {
  nombre: string
  descripcion: string
  categoria: ProductoCategoria
  precio: string
  stock: string
}

export default function ProductoFormModal({ producto, fotoActualUrl, onClose, onGuardado }: Props) {
  const esEdicion = !!producto

  const [campos, setCampos] = useState<Campos>(() => ({
    nombre:      producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    categoria:   producto?.categoria ?? 'otros',
    precio:      producto ? String(producto.precio) : '',
    stock:       producto ? String(producto.stock) : '',
  }))
  const [fotoNueva, setFotoNueva] = useState<File | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  useModalBehavior(onClose, enviando)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  function setCampo<K extends keyof Campos>(k: K, v: Campos[K]) {
    setCampos(prev => ({ ...prev, [k]: v }))
    setErrores(prev => ({ ...prev, [k]: undefined }))
  }

  function validar(): boolean {
    const errs: Partial<Record<keyof Campos, string>> = {}
    if (!campos.nombre.trim()) errs.nombre = 'El nombre es obligatorio.'

    const precio = Number(campos.precio)
    if (campos.precio === '' || isNaN(precio)) errs.precio = 'Ingresa un precio válido.'
    else if (precio < 0) errs.precio = 'El precio no puede ser negativo.'

    const stock = Number(campos.stock)
    if (campos.stock === '' || !Number.isInteger(stock)) errs.stock = 'Ingresa un stock válido (entero).'
    else if (stock < 0) errs.stock = 'El stock no puede ser negativo.'

    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setEnviando(true)
    setErrorGeneral(null)

    const datos: ProductoInsert = {
      nombre:      campos.nombre.trim(),
      descripcion: campos.descripcion.trim() || null,
      categoria:   campos.categoria,
      precio:      Number(campos.precio),
      stock:       Number(campos.stock),
    }

    // 1. Alta o edición de los campos base.
    let productoId = producto?.id
    if (!esEdicion) {
      const res = await crearProducto(datos)
      if (!res.ok) { setEnviando(false); setErrorGeneral(res.error); return }
      productoId = res.id
    }

    // 2. Subir foto nueva (si la hay) a la carpeta del producto.
    let imagenPath: string | undefined
    if (fotoNueva && productoId) {
      const up = await subirFotoProducto(fotoNueva, productoId)
      if (!up.ok) {
        setEnviando(false)
        setErrorGeneral(
          esEdicion
            ? `No se pudo subir la foto: ${up.error}`
            : `Producto creado, pero la foto falló: ${up.error}. Edítalo para reintentar.`,
        )
        return
      }
      imagenPath = up.path
    }

    // 3. Persistir campos (edición) y/o el path de la foto.
    if (esEdicion && productoId) {
      const res = await actualizarProducto(productoId, {
        ...datos,
        ...(imagenPath ? { imagen_url: imagenPath } : {}),
      })
      if (!res.ok) { setEnviando(false); setErrorGeneral(res.error); return }
    } else if (!esEdicion && imagenPath && productoId) {
      await actualizarProducto(productoId, { imagen_url: imagenPath })
    }

    setEnviando(false)
    onGuardado(esEdicion ? 'Producto actualizado correctamente.' : 'Producto creado correctamente.')
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={() => { if (!enviando) onClose() }}
      />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={esEdicion ? 'Editar producto' : 'Nuevo producto'}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full my-8 animate-fade-in"
        >
          <form onSubmit={handleGuardar} noValidate>
            {/* Cabecera */}
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-warm-100">
              <h2 className="font-display text-lg font-semibold text-primary-900">
                {esEdicion ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button
                type="button"
                onClick={() => { if (!enviando) onClose() }}
                className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Cuerpo */}
            <div className="px-6 py-5 space-y-5">
              <Campo label="Nombre" error={errores.nombre}>
                <input
                  type="text"
                  value={campos.nombre}
                  onChange={e => setCampo('nombre', e.target.value)}
                  placeholder="Ej: Agua sin gas 625 ml"
                  maxLength={120}
                  className={inputClass(!!errores.nombre)}
                />
              </Campo>

              <Campo label="Categoría">
                <select
                  value={campos.categoria}
                  onChange={e => setCampo('categoria', e.target.value as ProductoCategoria)}
                  className={selectClass(false)}
                >
                  {CATEGORIAS_PRODUCTO.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </Campo>

              <div className="grid grid-cols-2 gap-4">
                <Campo label="Precio (S/)" error={errores.precio}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={campos.precio}
                    onChange={e => setCampo('precio', e.target.value)}
                    className={inputClass(!!errores.precio)}
                  />
                </Campo>
                <Campo label="Stock" error={errores.stock}>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={campos.stock}
                    onChange={e => setCampo('stock', e.target.value)}
                    className={inputClass(!!errores.stock)}
                  />
                </Campo>
              </div>

              <Campo label="Descripción (opcional)">
                <textarea
                  rows={2}
                  value={campos.descripcion}
                  onChange={e => setCampo('descripcion', e.target.value)}
                  placeholder="Detalle breve del producto…"
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                />
              </Campo>

              <Campo label="Foto del producto (opcional)">
                <UploadFotoProducto
                  archivo={fotoNueva}
                  onCambio={setFotoNueva}
                  fotoActualUrl={fotoActualUrl}
                  disabled={enviando}
                />
              </Campo>

              {errorGeneral && (
                <p className="text-sm text-error" role="alert">{errorGeneral}</p>
              )}
            </div>

            {/* Pie */}
            <div className="flex gap-3 justify-end px-6 py-5 border-t border-warm-100">
              <button
                type="button"
                onClick={() => { if (!enviando) onClose() }}
                disabled={enviando}
                className="px-4 py-2 text-sm font-medium text-warm-500 hover:text-primary-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {enviando && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}

// ─── Sub-componentes de formulario (mismo estilo que Facturacion) ────────────

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-900 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return `w-full h-10 px-3 rounded-lg border text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors ${
    hasError ? 'border-error focus:ring-error/40' : 'border-warm-300'
  }`
}

function selectClass(hasError: boolean) {
  return `w-full h-10 px-3 rounded-lg border text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer transition-colors ${
    hasError ? 'border-error focus:ring-error/40' : 'border-warm-300'
  }`
}
