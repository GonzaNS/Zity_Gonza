// Sprint 11 · HU-TIENDA-03 — Drawer lateral del carrito del residente.
//
// Lista las líneas del pedido 'borrador' con control de cantidad (tope = stock),
// subtotal por ítem y total. El botón "Confirmar pedido" abre un paso de resumen
// que invoca confirmar_pedido (descuento atómico). Si algún producto se quedó sin
// stock entre tanto, muestra el error y recarga el carrito (no sobrevende).

import { useRef, useState } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import { useCarrito } from '../../../contexts/CarritoContext'
import { formatearPrecio } from '../../../lib/pedidos'

type Props = {
  onClose: () => void
  /** Aviso de éxito tras confirmar (lo muestra el layer como toast). */
  onConfirmado: (total: number) => void
}

export default function CarritoDrawer({ onClose, onConfirmado }: Props) {
  useModalBehavior(onClose)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  const { carrito, unidades, total, guardando, setCantidad, quitar, confirmar, recargar } = useCarrito()
  const [vista, setVista] = useState<'carrito' | 'confirmando'>('carrito')
  const [error, setError] = useState<string | null>(null)

  const vacio = carrito.items.length === 0

  async function handleConfirmar() {
    setError(null)
    const r = await confirmar()
    if (r.ok) {
      onConfirmado(r.total)
    } else {
      // El stock pudo cambiar (otro residente compró): refrescar y avisar.
      setError(r.error)
      setVista('carrito')
      await recargar()
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Tu carrito"
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-warm-50 shadow-2xl flex flex-col animate-fade-in"
      >
        {/* Encabezado */}
        <header className="flex items-center justify-between px-5 py-4 bg-white border-b border-warm-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="font-display text-lg font-semibold text-primary-900">Tu carrito</h2>
            {unidades > 0 && (
              <span className="text-xs font-semibold bg-accent-100 text-accent-700 px-2 py-0.5 rounded-full">
                {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-warm-400 hover:text-primary-700 hover:bg-warm-100 transition-colors cursor-pointer"
            aria-label="Cerrar carrito"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {error && (
          <div className="m-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm" role="alert">
            {error}
          </div>
        )}

        {vacio ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 bg-warm-100 rounded-full flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-warm-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="font-medium text-primary-900">Tu carrito está vacío</p>
            <p className="text-sm text-warm-400 mt-1">Agrega productos del catálogo para empezar.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 h-10 px-5 text-sm font-semibold text-primary-700 border border-primary-200 rounded-xl hover:bg-primary-50 transition-colors cursor-pointer"
            >
              Seguir comprando
            </button>
          </div>
        ) : vista === 'carrito' ? (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-warm-200">
              {carrito.items.map((it) => (
                <li key={it.producto_id} className="flex gap-3 p-4 bg-white">
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-warm-100 flex items-center justify-center text-warm-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-primary-900 text-sm line-clamp-2">{it.nombre}</p>
                    <p className="text-xs text-warm-400 mt-0.5">{formatearPrecio(it.precio_unitario)} c/u</p>

                    <div className="flex items-center justify-between mt-2">
                      {/* Control de cantidad (tope = stock) */}
                      <div className="inline-flex items-center border border-warm-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => setCantidad(it.producto_id, it.cantidad - 1, it.stock)}
                          className="w-8 h-8 flex items-center justify-center text-primary-700 hover:bg-warm-100 disabled:opacity-50 cursor-pointer"
                          aria-label={`Quitar una unidad de ${it.nombre}`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M20 12H4" /></svg>
                        </button>
                        <span className="w-9 text-center text-sm font-semibold text-primary-900 tabular-nums">{it.cantidad}</span>
                        <button
                          type="button"
                          disabled={guardando || it.cantidad >= it.stock}
                          onClick={() => setCantidad(it.producto_id, it.cantidad + 1, it.stock)}
                          className="w-8 h-8 flex items-center justify-center text-primary-700 hover:bg-warm-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                          aria-label={`Agregar una unidad de ${it.nombre}`}
                          title={it.cantidad >= it.stock ? 'No hay más stock' : undefined}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M12 4v16m8-8H4" /></svg>
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-primary-900 text-sm tabular-nums">{formatearPrecio(it.subtotal)}</span>
                        <button
                          type="button"
                          disabled={guardando}
                          onClick={() => quitar(it.producto_id)}
                          className="text-warm-400 hover:text-error transition-colors disabled:opacity-50 cursor-pointer"
                          aria-label={`Quitar ${it.nombre} del carrito`}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Pie con total + confirmar */}
            <footer className="bg-white border-t border-warm-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-warm-500">Total</span>
                <span className="font-display text-2xl font-bold text-primary-900 tabular-nums">{formatearPrecio(total)}</span>
              </div>
              <button
                type="button"
                disabled={guardando}
                onClick={() => { setError(null); setVista('confirmando') }}
                className="w-full h-12 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
              >
                Confirmar pedido
              </button>
            </footer>
          </>
        ) : (
          /* Paso de confirmación */
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-white border border-warm-200 rounded-xl p-5">
                <h3 className="font-semibold text-primary-900">Confirmar tu pedido</h3>
                <p className="text-sm text-warm-500 mt-1">
                  Vas a confirmar <b>{unidades}</b> {unidades === 1 ? 'unidad' : 'unidades'} por un total de{' '}
                  <b>{formatearPrecio(total)}</b>. Al confirmar, se reserva el stock y el pedido se sumará a tu factura
                  del mes.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {carrito.items.map((it) => (
                    <li key={it.producto_id} className="flex justify-between text-primary-800">
                      <span className="truncate pr-2">{it.cantidad} × {it.nombre}</span>
                      <span className="tabular-nums shrink-0">{formatearPrecio(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <footer className="bg-white border-t border-warm-200 p-5 flex gap-3">
              <button
                type="button"
                disabled={guardando}
                onClick={() => setVista('carrito')}
                className="h-12 px-5 text-sm font-semibold text-primary-700 border border-warm-200 rounded-xl hover:bg-warm-50 transition-colors disabled:opacity-60 cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                disabled={guardando}
                onClick={handleConfirmar}
                className="flex-1 h-12 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
              >
                {guardando && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                {guardando ? 'Confirmando…' : 'Confirmar pedido'}
              </button>
            </footer>
          </div>
        )}
      </section>
    </>
  )
}
