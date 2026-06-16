// Sprint 13 · HU-HOME-03 — Tarjeta de facturas pendientes del dashboard home.
//
// Muestra:
//   • Cabecera: total a pagar del período + próximo vencimiento
//   • Badge de alerta rojo si hay facturas vencidas
//   • Hasta 4 filas de facturas pendientes/vencidas (más urgentes primero)
//   • Clic en cada fila → /residente/facturas?id=<factura_id> (deep-link existente)
//   • CTA "Pagar" directo en cada fila de factura pagable
//   • "Ver todas" → /residente/facturas
//
// Datos: useHomeFacturas → vw_home_facturas (security_invoker, RLS aplica al residente).

import { Link, useNavigate } from 'react-router-dom'
import { useHomeFacturas, type FacturaHome } from '../../hooks/useHomeFacturas'
import {
  formatearMonto,
  formatearPeriodo,
  LABEL_FACTURA_TIPO,
  BADGE_FACTURA_ESTADO,
  LABEL_FACTURA_ESTADO,
} from '../../lib/facturas'
import type { FacturaTipo, FacturaEstado } from '../../lib/facturas'

// ─── Iconos de tipo de factura ────────────────────────────────────────────────

const ICONO_TIPO: Record<FacturaTipo, React.ReactNode> = {
  luz: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  agua: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.34 6.267-1 12-1s11 4.34 11 7.191c0 4.105-5.37 8.863-11 14.402z" />
    </svg>
  ),
  pension: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  multa: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  tienda: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
}

const COLOR_TIPO: Record<FacturaTipo, string> = {
  luz:     'bg-amber-50 text-amber-600',
  agua:    'bg-blue-50 text-blue-600',
  pension: 'bg-primary-50 text-primary-600',
  multa:   'bg-error/10 text-error',
  tienda:  'bg-accent-50 text-accent-600',
}

// ─── Helper de fecha ──────────────────────────────────────────────────────────

function formatarFechaCorta(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function CardHomeFacturas() {
  const { facturas, resumen, loading, error } = useHomeFacturas()
  const navigate = useNavigate()

  const hayVencidas = resumen.count_vencidas > 0
  const alDia = !loading && !error && resumen.total_pendiente === 0

  return (
    <div className="bg-white rounded-2xl border border-warm-200 border-l-4 border-l-accent-500 flex flex-col overflow-hidden">
      {/* ── Cabecera ── */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-4">
          {/* Icono + título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-50 text-accent-700 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
            <h2 className="font-display text-base font-semibold text-primary-900 leading-tight">
              Mis facturas
            </h2>
          </div>

          {/* Badge de alerta / estado */}
          {!loading && (
            hayVencidas ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border bg-error/10 text-error border-error/20 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" aria-hidden="true" />
                {resumen.count_vencidas} vencida{resumen.count_vencidas > 1 ? 's' : ''}
              </span>
            ) : alDia ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border bg-[#4a7c59]/10 text-[#2d5f3f] border-[#4a7c59]/20 shrink-0">
                ✓ Al corriente
              </span>
            ) : resumen.total_pendiente > 0 ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border bg-accent-50 text-accent-800 border-accent-200 shrink-0">
                Con saldo
              </span>
            ) : null
          )}
        </div>

        {/* KPIs de cabecera */}
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-8 w-36 bg-warm-100 rounded" />
            <div className="h-3 w-28 bg-warm-100 rounded" />
          </div>
        ) : alDia ? (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#4a7c59] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-[#2d5f3f] font-medium">Sin deuda pendiente este mes</p>
          </div>
        ) : (
          <div>
            <p className="font-display text-3xl font-bold text-primary-900 leading-none tabular-nums">
              {formatearMonto(resumen.total_pendiente)}
            </p>
            <p className="text-xs text-warm-400 mt-1">
              {resumen.proxima_fecha
                ? <>Próximo vencimiento: <span className={`font-semibold ${hayVencidas ? 'text-error' : 'text-primary-800'}`}>{formatarFechaCorta(resumen.proxima_fecha)}</span></>
                : 'Sin próximo vencimiento'}
            </p>
          </div>
        )}
      </div>

      {/* ── Lista de facturas ── */}
      <div className="flex-1 px-5 pb-2">
        {/* Error */}
        {error && (
          <p className="text-xs text-error py-3">{error}</p>
        )}

        {/* Skeleton */}
        {loading && !error && (
          <ul className="space-y-2 animate-pulse">
            {[1, 2].map(i => (
              <li key={i} className="rounded-xl border border-warm-100 p-3 flex items-center gap-3">
                <div className="w-8 h-8 bg-warm-100 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 bg-warm-100 rounded" />
                  <div className="h-3 w-20 bg-warm-100 rounded" />
                </div>
                <div className="h-6 w-16 bg-warm-100 rounded" />
              </li>
            ))}
          </ul>
        )}

        {/* Empty / al día */}
        {!loading && !error && facturas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-11 h-11 rounded-full bg-warm-100 flex items-center justify-center mb-2">
              <svg className="w-5 h-5 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-primary-800">Todo al día</p>
            <p className="text-xs text-warm-400 mt-1">No tienes facturas pendientes.</p>
          </div>
        )}

        {/* Lista */}
        {!loading && !error && facturas.length > 0 && (
          <ul className="space-y-2">
            {facturas.map((f, idx) => (
              <li key={f.id} className={`animate-fade-in delay-${idx + 1}`}>
                <FilaFactura
                  factura={f}
                  onDetalle={() => navigate(`/residente/facturas?id=${f.id}`)}
                  onPagar={() => navigate(`/residente/facturas?id=${f.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-warm-100 px-5 py-3 flex items-center justify-between">
        <Link
          to="/residente/facturas"
          id="card-facturas-ver-todas"
          className="text-xs font-medium text-warm-400 hover:text-accent-700 transition-colors"
        >
          Ver historial completo →
        </Link>
        {!alDia && !loading && (
          <button
            type="button"
            onClick={() => navigate('/residente/facturas')}
            className="text-xs font-semibold text-white bg-accent-600 hover:bg-accent-700 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Pagar ahora
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Fila de una factura ──────────────────────────────────────────────────────

function FilaFactura({
  factura, onDetalle, onPagar,
}: {
  factura: FacturaHome
  onDetalle: () => void
  onPagar: () => void
}) {
  // Estado visual: si esta_vencida=true pero el estado en BD aún es 'pendiente',
  // lo mostramos como 'vencida' visualmente (igual que la página completa).
  const estadoVisual: FacturaEstado =
    factura.esta_vencida && factura.estado === 'pendiente' ? 'vencida' : factura.estado

  return (
    <div className={`rounded-xl border p-3 transition-all group ${
      factura.esta_vencida
        ? 'border-error/20 bg-error/[0.03] hover:border-error/40'
        : 'border-warm-100 hover:border-accent-200 hover:shadow-sm'
    }`}>
      <button
        type="button"
        onClick={onDetalle}
        className="w-full text-left cursor-pointer"
      >
        <div className="flex items-start gap-3">
          {/* Icono de tipo */}
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${COLOR_TIPO[factura.tipo]}`}>
            {ICONO_TIPO[factura.tipo]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-primary-900 truncate">
                {LABEL_FACTURA_TIPO[factura.tipo]}
              </p>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[0.6rem] font-semibold border shrink-0 ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
                {LABEL_FACTURA_ESTADO[estadoVisual]}
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-0.5">
              <p className="text-xs text-warm-400">{formatearPeriodo(factura.periodo)}</p>
              <p className={`font-display text-base font-bold tabular-nums ${factura.esta_vencida ? 'text-error' : 'text-primary-900'}`}>
                {formatearMonto(factura.monto)}
              </p>
            </div>
            {/* Vencimiento */}
            <p className={`text-[0.625rem] mt-0.5 ${factura.esta_vencida ? 'text-error font-semibold' : 'text-warm-400'}`}>
              {factura.esta_vencida ? '⚠ Venció ' : 'Vence '}
              {formatarFechaCorta(factura.vencimiento)}
            </p>
          </div>
        </div>
      </button>

      {/* Botón pagar inline */}
      <div className="mt-2.5 pt-2.5 border-t border-warm-100/70">
        <button
          type="button"
          onClick={onPagar}
          className={`w-full h-8 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
            factura.esta_vencida
              ? 'bg-error text-white hover:bg-error/90'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {factura.esta_vencida ? 'Pagar ya' : 'Pagar'}
        </button>
      </div>
    </div>
  )
}
