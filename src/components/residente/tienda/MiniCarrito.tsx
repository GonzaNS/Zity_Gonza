// Sprint 11 · Mejora — Mini-carrito en el header del residente.
//
// Ícono con badge del nº de unidades del pedido 'borrador' y popover con el
// resumen (ítems + subtotal) y un botón "Ver carrito" que abre el drawer. Reusa
// el patrón de posicionamiento por Portal de CampanaNotificaciones. Solo se
// renderiza para residentes (el contexto está vacío para otros roles).

import { useState, useRef, useEffect } from 'react'
import Portal from '../../Portal'
import { useCarrito } from '../../../contexts/CarritoContext'
import { formatearPrecio } from '../../../lib/pedidos'

export default function MiniCarrito() {
  const { esResidente, carrito, unidades, total, abrirCarrito } = useCarrito()
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<React.CSSProperties>({})
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function calcularCoords() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const anclarIzquierda = rect.left < window.innerWidth / 2
    setCoords({
      position: 'fixed',
      top: Math.round(rect.bottom + 8),
      ...(anclarIzquierda
        ? { left: Math.max(8, Math.round(rect.left)) }
        : { right: Math.max(8, Math.round(window.innerWidth - rect.right)) }),
    })
  }

  function toggle() {
    if (!isOpen) calcularCoords()
    setIsOpen((prev) => !prev)
  }

  useEffect(() => {
    if (!isOpen) return
    function onClickOutside(e: MouseEvent) {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setIsOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setIsOpen(false) }
    function cerrar() { setIsOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', cerrar)
    window.addEventListener('scroll', cerrar, true)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', cerrar)
      window.removeEventListener('scroll', cerrar, true)
    }
  }, [isOpen])

  if (!esResidente) return null

  function verCarrito() {
    setIsOpen(false)
    abrirCarrito()
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className="relative p-2 text-warm-500 hover:text-primary-700 hover:bg-primary-50 rounded-full transition-colors cursor-pointer"
        aria-label={unidades > 0 ? `Carrito, ${unidades} unidades` : 'Carrito vacío'}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {unidades > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white">
            {unidades > 99 ? '99+' : unidades}
          </span>
        )}
      </button>

      {isOpen && (
        <Portal>
          <div
            ref={menuRef}
            style={coords}
            className="z-[60] w-[calc(100vw-1rem)] sm:w-80 bg-white border border-warm-200 rounded-xl shadow-xl overflow-hidden animate-fade-in"
            role="dialog"
            aria-label="Resumen del carrito"
          >
            <div className="px-4 py-3 bg-warm-50 border-b border-warm-200">
              <h3 className="font-semibold text-primary-900">Tu carrito</h3>
            </div>

            {carrito.items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-warm-500">Tu carrito está vacío.</p>
            ) : (
              <>
                <ul className="max-h-64 overflow-y-auto divide-y divide-warm-100">
                  {carrito.items.map((it) => (
                    <li key={it.producto_id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-sm">
                      <span className="text-primary-800 truncate">{it.cantidad} × {it.nombre}</span>
                      <span className="text-warm-600 tabular-nums shrink-0">{formatearPrecio(it.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                <div className="px-4 py-3 bg-warm-50 border-t border-warm-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-warm-500">Subtotal</span>
                    <span className="font-semibold text-primary-900 tabular-nums">{formatearPrecio(total)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={verCarrito}
                    className="w-full h-10 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Ver carrito
                  </button>
                </div>
              </>
            )}
          </div>
        </Portal>
      )}
    </>
  )
}
