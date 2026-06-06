// Sprint 11 · HU-TIENDA-08 — Vista admin de pedidos de la tienda.
// Ruta: /admin/pedidos
//
// Todas las órdenes con filtros (residente, rango de fecha, estado) y totales del
// periodo en la cabecera. El botón "Cerrar periodo" consolida los pedidos
// confirmados en facturas de tienda (facturar_pedidos_periodo). RLS: solo admin.

import { useMemo, useState } from 'react'
import AdminShell from '../../components/admin/AdminShell'
import { useAdminPedidos } from '../../hooks/useAdminPedidos'
import {
  formatearPrecio,
  subtotalItem,
  BADGE_PEDIDO_ESTADO,
  ESTADOS_PEDIDO_FILTRO,
  type PedidoConItems,
} from '../../lib/pedidos'
import { formatearPeriodo } from '../../lib/facturas'
import type { PedidoEstado } from '../../lib/tienda'

type FiltroEstado = PedidoEstado | 'todas'
type Toast = { tipo: 'success' | 'error'; msg: string } | null

function periodoActual(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
}
function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminPedidos() {
  const { pedidos, loading, error, recargar, cerrarPeriodo } = useAdminPedidos()

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todas')
  const [filtroResidente, setFiltroResidente] = useState<string>('todos')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [detalle, setDetalle] = useState<PedidoConItems | null>(null)
  const [cierreAbierto, setCierreAbierto] = useState(false)
  const [periodoCierre, setPeriodoCierre] = useState(periodoActual())
  const [cerrando, setCerrando] = useState(false)
  const [toast, setToast] = useState<Toast>(null)

  function mostrarToast(tipo: 'success' | 'error', msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4500)
  }

  const residentes = useMemo(() => {
    const set = new Map<string, string>()
    for (const p of pedidos) if (p.residente_nombre) set.set(p.residente_id, p.residente_nombre)
    return Array.from(set, ([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [pedidos])

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      if (filtroEstado !== 'todas' && p.estado !== filtroEstado) return false
      if (filtroResidente !== 'todos' && p.residente_id !== filtroResidente) return false
      const fecha = p.created_at.slice(0, 10)
      if (desde && fecha < desde) return false
      if (hasta && fecha > hasta) return false
      return true
    })
  }, [pedidos, filtroEstado, filtroResidente, desde, hasta])

  // Totales del periodo (agregación de pedido.total — ya calculado en servidor).
  const totales = useMemo(() => {
    let confirmado = 0
    let facturado = 0
    for (const p of filtrados) {
      if (p.estado === 'confirmado') confirmado += p.total
      else if (p.estado === 'facturado') facturado += p.total
    }
    return { confirmado, facturado }
  }, [filtrados])

  const hayFiltros = filtroEstado !== 'todas' || filtroResidente !== 'todos' || desde !== '' || hasta !== ''

  async function handleCerrar() {
    setCerrando(true)
    const r = await cerrarPeriodo(periodoCierre)
    setCerrando(false)
    setCierreAbierto(false)
    if (!r.ok) { mostrarToast('error', r.error); return }
    if (r.facturasCreadas === 0 && r.pedidosFacturados === 0) {
      mostrarToast('success', `Sin pedidos confirmados para facturar en ${formatearPeriodo(periodoCierre)}.`)
    } else {
      mostrarToast('success', `${formatearPeriodo(periodoCierre)}: ${r.facturasCreadas} factura(s) de tienda, ${r.pedidosFacturados} pedido(s).`)
    }
    recargar()
  }

  return (
    <AdminShell
      title="Pedidos"
      subtitle="Todas las órdenes de la tienda, con filtros y cierre de periodo."
      actions={
        <button
          type="button"
          onClick={() => { setPeriodoCierre(periodoActual()); setCierreAbierto(true) }}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Cerrar periodo
        </button>
      }
    >
      {error && (
        <div className="mb-5 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
      )}

      {/* Totales del periodo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-white border border-warm-200 rounded-xl p-4">
          <p className="text-xs text-warm-400">Confirmado (por facturar)</p>
          <p className="font-display text-xl font-bold text-primary-900 mt-1 tabular-nums">{formatearPrecio(totales.confirmado)}</p>
        </div>
        <div className="bg-white border border-warm-200 rounded-xl p-4">
          <p className="text-xs text-warm-400">Facturado</p>
          <p className="font-display text-xl font-bold text-primary-900 mt-1 tabular-nums">{formatearPrecio(totales.facturado)}</p>
        </div>
        <div className="bg-white border border-warm-200 rounded-xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-warm-400">Órdenes</p>
          <p className="font-display text-xl font-bold text-primary-900 mt-1 tabular-nums">{filtrados.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltroEstado('todas')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${filtroEstado === 'todas' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-warm-500 border-warm-200 hover:border-primary-300'}`}
          >
            Todas
          </button>
          {ESTADOS_PEDIDO_FILTRO.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setFiltroEstado(e)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer ${filtroEstado === e ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-warm-500 border-warm-200 hover:border-primary-300'}`}
            >
              {BADGE_PEDIDO_ESTADO[e].label}
            </button>
          ))}
        </div>

        <select
          value={filtroResidente}
          onChange={(e) => setFiltroResidente(e.target.value)}
          aria-label="Filtrar por residente"
          className="h-9 px-3 rounded-full text-sm font-medium text-primary-700 bg-white border border-warm-200 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          <option value="todos">Todos los residentes</option>
          {residentes.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>

        <div className="flex items-center gap-1.5 text-sm text-warm-500">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className="h-9 px-2 rounded-lg border border-warm-200 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
          <span>—</span>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className="h-9 px-2 rounded-lg border border-warm-200 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>

        {hayFiltros && (
          <button
            type="button"
            onClick={() => { setFiltroEstado('todas'); setFiltroResidente('todos'); setDesde(''); setHasta('') }}
            className="px-3 py-1.5 rounded-full text-sm font-medium text-warm-500 hover:text-error transition-colors cursor-pointer"
          >
            Limpiar
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center">
          <p className="font-medium text-primary-900">No hay pedidos</p>
          <p className="text-sm text-warm-400 mt-1">{hayFiltros ? 'Prueba con otros filtros.' : 'Aún no hay órdenes en la tienda.'}</p>
        </div>
      ) : (
        <div className="bg-white border border-warm-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-warm-50 text-left text-xs uppercase tracking-wider text-warm-400">
                  <th className="px-4 py-3 font-semibold">Residente</th>
                  <th className="px-4 py-3 font-semibold">Fecha</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold text-center">Ítems</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-warm-100">
                {filtrados.map((p) => {
                  const badge = BADGE_PEDIDO_ESTADO[p.estado]
                  const nItems = p.items.reduce((acc, it) => acc + it.cantidad, 0)
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setDetalle(p)}
                      className="hover:bg-warm-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-primary-900">{p.residente_nombre}</td>
                      <td className="px-4 py-3 text-warm-500">{fechaCorta(p.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.clases}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-warm-600 tabular-nums">{nItems}</td>
                      <td className="px-4 py-3 text-right font-semibold text-primary-900 tabular-nums">{formatearPrecio(p.total)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de detalle */}
      {detalle && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" aria-hidden="true" onClick={() => setDetalle(null)} />
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            <section role="dialog" aria-modal="true" aria-label="Detalle del pedido" className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 animate-fade-in">
              <header className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
                <div>
                  <h2 className="font-display text-lg font-semibold text-primary-900">{detalle.residente_nombre}</h2>
                  <p className="text-xs text-warm-400 mt-0.5">{fechaCorta(detalle.created_at)}{detalle.periodo ? ` · ${formatearPeriodo(detalle.periodo)}` : ''}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${BADGE_PEDIDO_ESTADO[detalle.estado].clases}`}>
                  {BADGE_PEDIDO_ESTADO[detalle.estado].label}
                </span>
              </header>
              <div className="p-6">
                <ul className="divide-y divide-warm-100">
                  {detalle.items.map((it) => (
                    <li key={it.producto_id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary-900 truncate">{it.nombre}</p>
                        <p className="text-xs text-warm-400 mt-0.5">{it.cantidad} × {formatearPrecio(it.precio_unitario)}</p>
                      </div>
                      <span className="text-sm font-semibold text-primary-900 tabular-nums shrink-0">{formatearPrecio(subtotalItem(it))}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-warm-200">
                  <span className="text-sm text-warm-500">Total</span>
                  <span className="font-display text-xl font-bold text-primary-900 tabular-nums">{formatearPrecio(detalle.total)}</span>
                </div>
              </div>
              <div className="px-6 pb-6">
                <button type="button" onClick={() => setDetalle(null)} className="w-full h-11 text-sm font-semibold text-warm-500 hover:text-primary-700 border border-warm-200 rounded-xl hover:bg-warm-50 transition-colors cursor-pointer">Cerrar</button>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Modal de cierre de periodo */}
      {cierreAbierto && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" aria-hidden="true" onClick={() => !cerrando && setCierreAbierto(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <section role="dialog" aria-modal="true" aria-label="Cerrar periodo de tienda" className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in">
              <h2 className="font-display text-lg font-semibold text-primary-900">Cerrar periodo de tienda</h2>
              <p className="text-sm text-warm-500 mt-1">
                Consolida los pedidos <b>confirmados</b> del periodo en una factura de tipo tienda por residente. Es
                idempotente: re-ejecutarlo no duplica facturas.
              </p>
              <label className="block mt-4 text-sm font-medium text-primary-800">
                Periodo
                <input
                  type="month"
                  value={periodoCierre}
                  onChange={(e) => setPeriodoCierre(e.target.value)}
                  className="mt-1 w-full h-10 px-3 rounded-lg border border-warm-300 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </label>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  disabled={cerrando}
                  onClick={() => setCierreAbierto(false)}
                  className="h-11 px-5 text-sm font-semibold text-primary-700 border border-warm-200 rounded-xl hover:bg-warm-50 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={cerrando || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodoCierre)}
                  onClick={handleCerrar}
                  className="flex-1 h-11 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  {cerrando && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  {cerrando ? 'Cerrando…' : 'Cerrar periodo'}
                </button>
              </div>
            </section>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in text-white ${toast.tipo === 'error' ? 'bg-error' : 'bg-success'}`}>
          {toast.tipo === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}
    </AdminShell>
  )
}
