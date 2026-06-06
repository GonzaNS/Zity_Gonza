// Sprint 11 · HU-TIENDA-07 — Detalle de un pedido del historial del residente.
// Muestra las líneas (producto, cantidad, precio_unitario snapshot, subtotal), el
// total y, si el pedido ya fue facturado, un enlace a su factura de tienda.

import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { formatearPrecio, subtotalItem, BADGE_PEDIDO_ESTADO, type PedidoConItems } from '../../../lib/pedidos'
import { formatearPeriodo } from '../../../lib/facturas'

type Props = { pedido: PedidoConItems; onClose: () => void }

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function DetallePedidoModal({ pedido, onClose }: Props) {
  useModalBehavior(onClose)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const badge = BADGE_PEDIDO_ESTADO[pedido.estado]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" aria-hidden="true" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Detalle del pedido"
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 overflow-hidden animate-fade-in"
        >
          <header className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
            <div>
              <h2 className="font-display text-lg font-semibold text-primary-900">Pedido</h2>
              <p className="text-xs text-warm-400 mt-0.5">{formatearFecha(pedido.created_at)}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.clases}`}>
              {badge.label}
            </span>
          </header>

          <div className="p-6">
            <ul className="divide-y divide-warm-100">
              {pedido.items.map((it) => (
                <li key={it.producto_id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary-900 truncate">{it.nombre}</p>
                    <p className="text-xs text-warm-400 mt-0.5">{it.cantidad} × {formatearPrecio(it.precio_unitario)}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary-900 tabular-nums shrink-0">
                    {formatearPrecio(subtotalItem(it))}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-warm-200">
              <span className="text-sm text-warm-500">Total</span>
              <span className="font-display text-xl font-bold text-primary-900 tabular-nums">
                {formatearPrecio(pedido.total)}
              </span>
            </div>

            {pedido.periodo && (
              <p className="text-xs text-warm-400 mt-3">Periodo de facturación: {formatearPeriodo(pedido.periodo)}</p>
            )}

            {pedido.estado === 'facturado' && pedido.factura_id && (
              <Link
                to={`/residente/facturas?id=${pedido.factura_id}`}
                className="mt-5 w-full h-11 inline-flex items-center justify-center gap-2 text-sm font-semibold text-primary-700 border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                Ver factura de tienda
              </Link>
            )}
          </div>

          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 text-sm font-semibold text-warm-500 hover:text-primary-700 border border-warm-200 rounded-xl hover:bg-warm-50 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </section>
      </div>
    </>
  )
}
