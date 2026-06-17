// Sprint 13 · HU-HOME-04 — Tarjeta de pedidos del mes del dashboard home.
//
// Muestra:
//   • Cabecera: total acumulado del mes + unidades pedidas + nº de pedidos
//   • Lista de hasta 3 pedidos recientes del mes con badge de estado y monto
//   • CTA "Ver historial" → /residente/tienda/historial
//   • CTA "Ir a la tienda" → /residente/tienda
//   • Empty state si no hay pedidos este mes
//
// Datos: useHomePedidos → vw_home_pedidos (security_invoker, RLS del residente).

import { Link, useNavigate } from 'react-router-dom'
import { useHomePedidos, type PedidoHome } from '../../hooks/useHomePedidos'
import { formatearPrecio, BADGE_PEDIDO_ESTADO } from '../../lib/pedidos'
import type { PedidoEstado } from '../../lib/tienda'

// ─── Helper de fecha ──────────────────────────────────────────────────────────

function formatearFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric', month: 'short',
  })
}

function mesActual(): string {
  return new Date().toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CardHomePedidos() {
  const { pedidos, resumen, loading, error } = useHomePedidos()
  const navigate = useNavigate()

  const sinPedidos = !loading && !error && resumen.pedidos_mes === 0

  return (
    <div className="bg-white rounded-2xl border border-warm-200 border-l-4 border-l-[#4a7c59] flex flex-col overflow-hidden">

      {/* ── Cabecera ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between gap-3 mb-4">
          {/* Icono + título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4a7c59]/10 text-[#2d5f3f] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-primary-900 leading-tight">
                Mis pedidos
              </h2>
              <p className="text-xs text-warm-400 mt-0.5 capitalize">{mesActual()}</p>
            </div>
          </div>

          <Link
            to="/residente/tienda/historial"
            id="card-pedidos-ver-historial"
            className="text-xs font-semibold text-[#2d5f3f] hover:text-[#4a7c59] transition-colors"
          >
            Ver historial →
          </Link>
        </div>

        {/* KPIs de cabecera */}
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 w-32 bg-warm-100 rounded" />
            <div className="flex gap-4 mt-1">
              <div className="h-3 w-20 bg-warm-100 rounded" />
              <div className="h-3 w-20 bg-warm-100 rounded" />
            </div>
          </div>
        ) : sinPedidos ? (
          <div className="flex items-center gap-2">
            <p className="text-sm text-warm-400">Sin pedidos este mes</p>
          </div>
        ) : (
          <div>
            {/* Total acumulado — el número más prominente */}
            <p className="font-display text-3xl font-bold text-primary-900 leading-none tabular-nums">
              {formatearPrecio(resumen.total_mes)}
            </p>
            {/* Subtítulos: unidades + nº pedidos */}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-warm-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <strong className="font-semibold text-primary-800">{resumen.unidades_mes}</strong>{' '}
                unidad{resumen.unidades_mes !== 1 ? 'es' : ''}
              </span>
              <span className="text-warm-200">·</span>
              <span className="inline-flex items-center gap-1 text-xs text-warm-400">
                <strong className="font-semibold text-primary-800">{resumen.pedidos_mes}</strong>{' '}
                pedido{resumen.pedidos_mes !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Lista de pedidos recientes ── */}
      <div className="flex-1 px-5 pb-2">
        {/* Error */}
        {error && (
          <p className="text-xs text-error py-3">{error}</p>
        )}

        {/* Skeleton */}
        {loading && !error && (
          <ul className="space-y-2 animate-pulse">
            {[1, 2].map(i => (
              <li key={i} className="flex items-center gap-3 py-2 border-b border-warm-100 last:border-0">
                <div className="h-3.5 w-20 bg-warm-100 rounded" />
                <div className="flex-1 h-3 bg-warm-100 rounded" />
                <div className="h-5 w-16 bg-warm-100 rounded-full" />
              </li>
            ))}
          </ul>
        )}

        {/* Empty state */}
        {sinPedidos && (
          <div className="flex flex-col items-center justify-center py-7 text-center">
            <div className="w-11 h-11 rounded-full bg-warm-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-primary-800">Sin pedidos este mes</p>
            <p className="text-xs text-warm-400 mt-1">Visita la tienda para realizar tu primer pedido.</p>
          </div>
        )}

        {/* Lista */}
        {!loading && !error && pedidos.length > 0 && (
          <ul className="divide-y divide-warm-100">
            {pedidos.map((p, idx) => (
              <li key={p.id} className={`animate-fade-in delay-${idx + 1}`}>
                <FilaPedido
                  pedido={p}
                  onDetalle={() => navigate('/residente/tienda/historial')}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-warm-100 px-5 py-3 flex items-center justify-between">
        <Link
          to="/residente/tienda/historial"
          className="text-xs font-medium text-warm-400 hover:text-[#2d5f3f] transition-colors"
        >
          Historial completo →
        </Link>
        <button
          type="button"
          onClick={() => navigate('/residente/tienda')}
          className="text-xs font-semibold text-white bg-[#4a7c59] hover:bg-[#3d6b4c] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Ir a la tienda
        </button>
      </div>
    </div>
  )
}

// ─── Fila de un pedido ────────────────────────────────────────────────────────

function FilaPedido({
  pedido, onDetalle,
}: {
  pedido: PedidoHome
  onDetalle: () => void
}) {
  const badge = BADGE_PEDIDO_ESTADO[pedido.estado as PedidoEstado]

  return (
    <button
      type="button"
      onClick={onDetalle}
      className="w-full text-left py-2.5 flex items-center gap-3 hover:bg-warm-50 transition-colors cursor-pointer rounded-lg px-1 -mx-1 group"
    >
      {/* Fecha */}
      <span className="text-xs text-warm-400 shrink-0 w-16">
        {formatearFechaCorta(pedido.created_at)}
      </span>

      {/* Unidades */}
      <span className="text-xs text-primary-700 shrink-0">
        <strong className="font-semibold">{pedido.unidades_pedido}</strong> ud.
      </span>

      {/* Badge de estado */}
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold border ${badge?.clases ?? ''}`}>
        {badge?.label ?? pedido.estado}
      </span>

      {/* Monto */}
      <span className="ml-auto font-display text-sm font-bold text-primary-900 tabular-nums group-hover:text-[#2d5f3f] transition-colors">
        {formatearPrecio(pedido.total)}
      </span>
    </button>
  )
}
