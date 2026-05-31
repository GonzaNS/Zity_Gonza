// Sprint 10 · HU-TIENDA-02 — Listado de productos del admin (activos e
// inactivos). Cada fila muestra foto, nombre, categoría, precio, stock con
// badge, y las acciones editar / dar de baja / reactivar. Los inactivos se
// atenúan y muestran el badge 'Inactivo'.

import {
  labelCategoria,
  formatearPrecio,
  estadoStock,
  BADGE_STOCK,
  type Producto,
} from '../../../lib/tienda'

type Props = {
  productos: Producto[]
  /** Mapa path → URL firmada de la foto. */
  fotos: Map<string, string>
  onEditar: (producto: Producto) => void
  onCambiarActivo: (producto: Producto) => void
  /** id del producto cuya baja/reactivación está en curso (deshabilita su botón). */
  procesandoId: string | null
}

export default function TablaProductos({ productos, fotos, onEditar, onCambiarActivo, procesandoId }: Props) {
  return (
    <div className="space-y-2.5">
      {productos.map(p => {
        const url = p.imagen_url ? fotos.get(p.imagen_url) : null
        const stockEstado = estadoStock(p.stock)
        const badge = stockEstado !== 'disponible' ? BADGE_STOCK[stockEstado] : null
        const procesando = procesandoId === p.id

        return (
          <div
            key={p.id}
            className={`flex items-center gap-3 sm:gap-4 bg-white border border-warm-200 rounded-xl p-3 sm:p-4 transition-opacity ${
              p.activo ? '' : 'opacity-60'
            }`}
          >
            {/* Thumbnail */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-warm-100 shrink-0 flex items-center justify-center">
              {url ? (
                <img src={url} alt={p.nombre} className="w-full h-full object-cover" />
              ) : (
                <svg className="w-7 h-7 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>

            {/* Datos */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-primary-900 truncate">{p.nombre}</p>
                {!p.activo && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold bg-warm-200 text-warm-400 border border-warm-300">
                    Inactivo
                  </span>
                )}
                {badge && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.7rem] font-semibold border ${badge.clases}`}>
                    {badge.label}
                  </span>
                )}
              </div>
              <p className="text-xs text-warm-400 mt-0.5">
                {labelCategoria(p.categoria)} · Stock: {p.stock}
              </p>
            </div>

            {/* Precio */}
            <p className="font-display font-semibold text-primary-900 shrink-0 hidden xs:block sm:text-lg">
              {formatearPrecio(p.precio)}
            </p>

            {/* Acciones */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onEditar(p)}
                className="p-2 rounded-lg text-warm-400 hover:text-primary-700 hover:bg-warm-50 transition-colors cursor-pointer"
                aria-label={`Editar ${p.nombre}`}
                title="Editar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => onCambiarActivo(p)}
                disabled={procesando}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                  p.activo
                    ? 'text-error border-error/30 hover:bg-error/5'
                    : 'text-success border-success/30 hover:bg-success/5'
                }`}
              >
                {procesando ? '…' : p.activo ? 'Dar de baja' : 'Reactivar'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
