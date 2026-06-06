// Sprint 11 · HU-TIENDA-03 — Capa global del carrito del residente.
//
// Monta el drawer del carrito (abrible desde el mini-carrito de cualquier header
// del residente) y el toast de confirmación. Se renderiza una sola vez, junto a
// las rutas, dentro del CarritoProvider. Para roles no residentes no renderiza nada.

import { useState } from 'react'
import { useCarrito } from '../../../contexts/CarritoContext'
import { formatearPrecio } from '../../../lib/pedidos'
import CarritoDrawer from './CarritoDrawer'

export default function CarritoLayer() {
  const { esResidente, drawerAbierto, cerrarCarrito } = useCarrito()
  const [toast, setToast] = useState<string | null>(null)

  if (!esResidente) return null

  function onConfirmado(total: number) {
    setToast(`¡Pedido confirmado por ${formatearPrecio(total)}! Se sumará a tu factura del mes.`)
    setTimeout(() => setToast(null), 5000)
  }

  return (
    <>
      {drawerAbierto && <CarritoDrawer onClose={cerrarCarrito} onConfirmado={onConfirmado} />}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-xl shadow-lg text-sm font-medium bg-success text-white animate-fade-in max-w-[calc(100vw-2rem)] text-center"
        >
          {toast}
        </div>
      )}
    </>
  )
}
