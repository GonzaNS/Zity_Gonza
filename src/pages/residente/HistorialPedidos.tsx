// Sprint 11 · HU-TIENDA-07 — Historial de pedidos del residente.
// Ruta: /residente/tienda/historial
//
// Lista los pedidos (confirmado / facturado) con fecha, estado, nº de ítems y
// total; al abrir uno se ve el desglose con precio_unitario y, si está facturado,
// el enlace a su factura de tienda.

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePedidosResidente } from '../../hooks/usePedidosResidente'
import { formatearPrecio, BADGE_PEDIDO_ESTADO, type PedidoConItems } from '../../lib/pedidos'
import DetallePedidoModal from '../../components/residente/tienda/DetallePedidoModal'
import CampanaNotificaciones from '../../components/shared/CampanaNotificaciones'
import MiniCarrito from '../../components/residente/tienda/MiniCarrito'
import zityLogo from '../../assets/zity_logo.png'

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function HistorialPedidos() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const { pedidos, loading, error } = usePedidosResidente()
  const [seleccionado, setSeleccionado] = useState<PedidoConItems | null>(null)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/residente/tienda" className="flex items-center gap-4">
            <img src={zityLogo} alt="Zity" className="h-9 w-auto" />
            <span className="text-xs font-semibold bg-accent-500 text-white px-2.5 py-1 rounded-full tracking-wider uppercase">
              Residente
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <CampanaNotificaciones />
            <MiniCarrito />
            <Link to="/residente/tienda" className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline">
              Tienda
            </Link>
            <Link to="/perfil" className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline">
              {profile?.nombre} {profile?.apellido}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in">
          <Link to="/residente/tienda" className="text-sm text-warm-400 hover:text-primary-700 transition-colors">
            ← Volver a la tienda
          </Link>
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight mt-2">
            Mis pedidos
          </h2>
          <p className="mt-1 text-warm-400 text-sm">El historial de tus compras en la tienda del edificio.</p>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : pedidos.length === 0 ? (
          <div className="mt-8 bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
            <p className="font-medium text-primary-900">Aún no tienes pedidos</p>
            <p className="text-sm text-warm-400 mt-1">
              Cuando confirmes un pedido en la tienda, aparecerá aquí.
            </p>
            <Link
              to="/residente/tienda"
              className="inline-block mt-5 h-10 px-5 leading-10 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors"
            >
              Ir a la tienda
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
            {pedidos.map((p) => {
              const badge = BADGE_PEDIDO_ESTADO[p.estado]
              const nItems = p.items.reduce((acc, it) => acc + it.cantidad, 0)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSeleccionado(p)}
                  className="text-left bg-white rounded-xl border border-warm-200 p-4 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-primary-900">{formatearFecha(p.created_at)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.clases}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-xs text-warm-400 mt-2">
                    {nItems} {nItems === 1 ? 'unidad' : 'unidades'} · {p.items.length} {p.items.length === 1 ? 'producto' : 'productos'}
                  </p>
                  <p className="font-display text-xl font-bold text-primary-900 mt-2 tabular-nums">
                    {formatearPrecio(p.total)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </main>

      {seleccionado && (
        <DetallePedidoModal pedido={seleccionado} onClose={() => setSeleccionado(null)} />
      )}
    </div>
  )
}
