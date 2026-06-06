// Sprint 10 · HU-TIENDA-05 — Detalle del producto para el residente.
// Foto grande, descripción, precio y stock. El botón "Agregar al carrito" está
// deshabilitado con el tooltip "Disponible en la próxima versión" (placeholder
// del S11; el carrito y la compra llegan en la Tienda v2).

import { useRef } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import {
  labelCategoria,
  formatearPrecio,
  estadoStock,
  BADGE_STOCK,
  type Producto,
} from '../../../lib/tienda'
import BotonAgregarCarrito from './BotonAgregarCarrito'

type Props = {
  producto: Producto
  fotoUrl?: string | null
  onClose: () => void
}

export default function DetalleProductoModal({ producto, fotoUrl, onClose }: Props) {
  useModalBehavior(onClose)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const stockEstado = estadoStock(producto.stock)
  const badge = stockEstado !== 'disponible' ? BADGE_STOCK[stockEstado] : null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ${producto.nombre}`}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 overflow-hidden animate-fade-in"
        >
          {/* Foto grande */}
          <div className="aspect-square sm:aspect-[4/3] bg-warm-100 relative">
            {fotoUrl ? (
              <img src={fotoUrl} alt={producto.nombre} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg className="w-12 h-12 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 text-primary-700 hover:bg-white transition-colors cursor-pointer shadow-sm"
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {badge && (
              <span className={`absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.clases}`}>
                {badge.label}
              </span>
            )}
          </div>

          {/* Cuerpo */}
          <div className="p-6">
            <p className="text-xs text-warm-400">{labelCategoria(producto.categoria)}</p>
            <h2 className="font-display text-xl font-semibold text-primary-900 mt-0.5">{producto.nombre}</h2>

            <p className="font-display text-3xl font-bold text-primary-900 mt-3 leading-none">
              {formatearPrecio(producto.precio)}
            </p>
            <p className="text-sm text-warm-400 mt-2">
              {producto.stock > 0 ? `${producto.stock} disponible${producto.stock !== 1 ? 's' : ''}` : 'Sin stock'}
            </p>

            {producto.descripcion && (
              <p className="text-sm text-primary-800 mt-4 leading-relaxed">{producto.descripcion}</p>
            )}

            {/* Sprint 11 · HU-TIENDA-03 — agregar al carrito (tope = stock) */}
            <div className="mt-6">
              <BotonAgregarCarrito producto={producto} full />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
