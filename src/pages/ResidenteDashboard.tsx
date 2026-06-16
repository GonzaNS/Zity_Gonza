// Sprint 13 · HU-HOME-01 — Dashboard integral del residente.
// Ruta: /residente
//
// Reemplaza el dashboard simple anterior (solo solicitudes) con un grid de
// 3 tarjetas que resume el estado de:
//   • Solicitudes   → /residente/solicitudes
//   • Facturas      → /residente/facturas
//   • Pedidos       → /residente/tienda/historial
//
// Los datos de cada tarjeta provienen de vistas Postgres ligeras
// (vw_resumen_*_residente) consultadas en paralelo por useResumenResidente.
// La RLS (security_invoker) garantiza que cada residente solo vea sus datos.
//
// Layout responsive:
//   móvil  (≤ 640 px): 1 columna (tarjetas apiladas)
//   desktop (> 640 px): 3 columnas lado a lado

import { useAuth } from '../contexts/AuthContext'
import { useResumenResidente } from '../hooks/useResumenResidente'
import { formatearMonto } from '../lib/facturas'
import ResidenteHeader from '../components/residente/ResidenteHeader'
import DashboardCard from '../components/residente/DashboardCard'

// ─── Helpers de presentación ──────────────────────────────────────────────────

function formatearFechaCorta(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: 'numeric', month: 'short',
  })
}

function formatearFechaHora(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Iconos inline ────────────────────────────────────────────────────────────

function IconoSolicitudes() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function IconoFacturas() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
    </svg>
  )
}

function IconoPedidos() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ResidenteDashboard() {
  const { profile } = useAuth()
  const { resumen, loading } = useResumenResidente()

  // ── Tarjeta 1: Solicitudes ──────────────────────────────────────────────────
  const statsSolicitudes = [
    {
      label: 'Total',
      value: resumen.solicitudes.total,
    },
    {
      label: 'En curso',
      value: resumen.solicitudes.pendientes + resumen.solicitudes.en_progreso,
      highlight: (resumen.solicitudes.pendientes + resumen.solicitudes.en_progreso) > 0
        ? 'warning' as const
        : undefined,
    },
    {
      label: 'Por confirmar',
      value: resumen.solicitudes.pendientes_confirmacion,
      highlight: resumen.solicitudes.pendientes_confirmacion > 0
        ? 'error' as const
        : undefined,
    },
  ]

  const badgeSolicitudes = resumen.solicitudes.pendientes_confirmacion > 0
    ? {
        label: `${resumen.solicitudes.pendientes_confirmacion} por confirmar`,
        variant: 'error' as const,
      }
    : resumen.solicitudes.pendientes > 0
    ? {
        label: `${resumen.solicitudes.pendientes} pendiente${resumen.solicitudes.pendientes > 1 ? 's' : ''}`,
        variant: 'warning' as const,
      }
    : undefined

  // ── Tarjeta 2: Facturas ─────────────────────────────────────────────────────
  const statsFacturas = [
    {
      label: 'Deuda del mes',
      value: formatearMonto(resumen.facturas.total_pendiente_mes),
      highlight: resumen.facturas.total_pendiente_mes > 0
        ? 'warning' as const
        : 'success' as const,
    },
    {
      label: 'Vencidas',
      value: resumen.facturas.facturas_vencidas,
      highlight: resumen.facturas.facturas_vencidas > 0
        ? 'error' as const
        : undefined,
    },
    ...(resumen.facturas.proxima_vencimiento
      ? [{
          label: 'Próximo vence',
          value: formatearFechaCorta(resumen.facturas.proxima_vencimiento) ?? '—',
        }]
      : []),
  ]

  const badgeFacturas = resumen.facturas.facturas_vencidas > 0
    ? {
        label: `${resumen.facturas.facturas_vencidas} vencida${resumen.facturas.facturas_vencidas > 1 ? 's' : ''}`,
        variant: 'error' as const,
      }
    : resumen.facturas.total_pendiente_mes > 0
    ? {
        label: 'Con saldo pendiente',
        variant: 'warning' as const,
      }
    : {
        label: 'Al corriente',
        variant: 'success' as const,
      }

  // ── Tarjeta 3: Pedidos ──────────────────────────────────────────────────────
  const statsPedidos = [
    {
      label: 'Total pedidos',
      value: resumen.pedidos.total_pedidos,
    },
    ...(resumen.pedidos.ultimo_total !== null
      ? [{
          label: 'Último pedido',
          value: formatearMonto(resumen.pedidos.ultimo_total),
        }]
      : []),
    ...(resumen.pedidos.ultimo_pedido_at
      ? [{
          label: 'Fecha',
          value: formatearFechaHora(resumen.pedidos.ultimo_pedido_at) ?? '—',
        }]
      : []),
  ]

  const badgePedidos = resumen.pedidos.total_pedidos === 0
    ? { label: 'Sin pedidos', variant: 'neutral' as const }
    : undefined

  return (
    <div className="min-h-screen bg-warm-50">
      <ResidenteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Saludo ── */}
        <div className="animate-fade-in mb-8 sm:mb-10">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Hola, {profile?.nombre} 👋
          </h1>
          <p className="mt-1 text-warm-400 text-sm">
            {profile?.piso && profile?.departamento
              ? `Piso ${profile.piso}, Depto. ${profile.departamento} · Aquí tienes tu estado de un vistazo.`
              : 'Tu unidad aún no está configurada.'}
          </p>
        </div>

        {/* ── Grid de 3 tarjetas ── */}
        {/* R2: desktop = 3 columnas, móvil (≤ 640 px) = 1 columna apiladas */}
        <section aria-label="Mi estado de un vistazo">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            {/* Tarjeta 1 — Solicitudes */}
            <div className="animate-fade-in delay-1">
              <DashboardCard
                id="card-solicitudes"
                title="Mis solicitudes"
                icon={<IconoSolicitudes />}
                accent="teal"
                href="/residente/solicitudes"
                stats={statsSolicitudes}
                badge={badgeSolicitudes}
                loading={loading}
              />
            </div>

            {/* Tarjeta 2 — Facturas */}
            <div className="animate-fade-in delay-2">
              <DashboardCard
                id="card-facturas"
                title="Mis facturas"
                icon={<IconoFacturas />}
                accent="gold"
                href="/residente/facturas"
                stats={statsFacturas}
                badge={badgeFacturas}
                loading={loading}
              />
            </div>

            {/* Tarjeta 3 — Pedidos */}
            <div className="animate-fade-in delay-3">
              <DashboardCard
                id="card-pedidos"
                title="Mis pedidos"
                icon={<IconoPedidos />}
                accent="green"
                href="/residente/tienda/historial"
                stats={statsPedidos}
                badge={badgePedidos}
                loading={loading}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
