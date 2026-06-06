// Sprint 11 · HU-TIENDA-03 — Control de carrito reutilizable (tarjeta y detalle).
//
// Sin nada en el carrito muestra "Agregar"; con ≥1 unidad muestra el control
// − cantidad + con tope = stock. Usa el CarritoContext, así que el badge del
// mini-carrito y el drawer se actualizan al instante al agregar/quitar.

import { useCarrito } from '../../../contexts/CarritoContext'
import { disponibleParaPedir, type Producto } from '../../../lib/tienda'

type Props = {
  producto: Producto
  /** Ocupa todo el ancho (tarjeta del catálogo / detalle). */
  full?: boolean
}

export default function BotonAgregarCarrito({ producto, full = false }: Props) {
  const { esResidente, cantidadDe, agregarUno, setCantidad, guardando } = useCarrito()

  // Para roles no residentes (no debería renderizarse, defensivo).
  if (!esResidente) return null

  const cantidad = cantidadDe(producto.id)
  const ancho = full ? 'w-full' : ''

  if (!disponibleParaPedir(producto)) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${ancho} h-10 px-4 text-sm font-semibold text-warm-400 bg-warm-100 border border-warm-200 rounded-xl cursor-not-allowed`}
      >
        Agotado
      </button>
    )
  }

  if (cantidad === 0) {
    return (
      <button
        type="button"
        disabled={guardando}
        onClick={() => agregarUno(producto.id, producto.stock)}
        className={`${ancho} h-10 px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Agregar
      </button>
    )
  }

  const topeAlcanzado = cantidad >= producto.stock
  return (
    <div className={`${ancho} h-10 inline-flex items-center justify-between border border-primary-200 rounded-xl overflow-hidden bg-white`}>
      <button
        type="button"
        disabled={guardando}
        onClick={() => setCantidad(producto.id, cantidad - 1, producto.stock)}
        className="h-full px-3.5 flex items-center justify-center text-primary-700 hover:bg-primary-50 disabled:opacity-50 cursor-pointer"
        aria-label={`Quitar una unidad de ${producto.nombre}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M20 12H4" /></svg>
      </button>
      <span className="text-sm font-semibold text-primary-900 tabular-nums" aria-live="polite">{cantidad}</span>
      <button
        type="button"
        disabled={guardando || topeAlcanzado}
        onClick={() => setCantidad(producto.id, cantidad + 1, producto.stock)}
        className="h-full px-3.5 flex items-center justify-center text-primary-700 hover:bg-primary-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        aria-label={`Agregar una unidad de ${producto.nombre}`}
        title={topeAlcanzado ? 'No hay más stock disponible' : undefined}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 4v16m8-8H4" /></svg>
      </button>
    </div>
  )
}
