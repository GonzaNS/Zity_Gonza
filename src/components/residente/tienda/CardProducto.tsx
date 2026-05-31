// Sprint 10 · HU-TIENDA-05 — Tarjeta de producto del catálogo del residente.
// Foto, categoría, nombre y precio. Badge de stock (Mejora): 'Pocas unidades'
// (≤5) o 'Agotado' (0); la tarjeta agotada se atenúa.

import {
  labelCategoria,
  formatearPrecio,
  estadoStock,
  BADGE_STOCK,
  type Producto,
} from '../../../lib/tienda'

type Props = {
  producto: Producto
  fotoUrl?: string | null
  onClick: () => void
}

export default function CardProducto({ producto, fotoUrl, onClick }: Props) {
  const stockEstado = estadoStock(producto.stock)
  const badge = stockEstado !== 'disponible' ? BADGE_STOCK[stockEstado] : null
  const agotado = stockEstado === 'agotado'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left bg-white rounded-xl border border-warm-200 overflow-hidden hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer flex flex-col ${
        agotado ? 'opacity-70' : ''
      }`}
    >
      <div className="aspect-square bg-warm-100 relative overflow-hidden">
        {fotoUrl ? (
          <img src={fotoUrl} alt={producto.nombre} loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {badge && (
          <span className={`absolute top-2 left-2 inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border ${badge.clases}`}>
            {badge.label}
          </span>
        )}
      </div>

      <div className="p-3 sm:p-4 flex-1 flex flex-col">
        <p className="text-xs text-warm-400">{labelCategoria(producto.categoria)}</p>
        <p className="font-medium text-primary-900 mt-0.5 line-clamp-2">{producto.nombre}</p>
        <p className="font-display font-semibold text-primary-900 mt-auto pt-2 sm:text-lg">
          {formatearPrecio(producto.precio)}
        </p>
      </div>
    </button>
  )
}
