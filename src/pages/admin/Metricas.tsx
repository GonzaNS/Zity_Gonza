// Sprint 7 · PBI-22 · Vista /admin/metricas
// Panel de KPIs operativos del módulo de mantenimiento.
//
// Criterios de aceptación implementados:
//   ■ 4 tarjetas KPI: total acumulado, pendientes, en proceso, resueltas hoy.
//   ■ Tarjeta de tiempo de resolución: AVG, mediana y P95.
//   ■ Auto-refresh cada 60 s (pausa en background) via useMetricasMantenimiento.
//   ■ Casos de borde: 'Sin datos suficientes' cuando los valores son null.
//   ■ Solo accesible para admin (ProtectedRoute en App.tsx + RPC verifica RLS).
//   ■ Indicador visual del último refresh y botón de refresh manual.

import AdminShell from '../../components/admin/AdminShell'
import { useMetricasMantenimiento } from '../../hooks/useMetricasMantenimiento'
import { formatearHoras } from '../../lib/metricas'

// ─── Íconos inline ──────────────────────────────────────────────────────────
function IconoTotal() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconoPendiente() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconoEnProceso() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}
function IconoResuelta() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconoTiempo() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  )
}
function IconoRefresh({ spin }: { spin?: boolean }) {
  return (
    <svg
      className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function SkeletonKpi() {
  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 bg-warm-100 rounded-lg" />
        <div className="w-16 h-5 bg-warm-100 rounded" />
      </div>
      <div className="w-20 h-8 bg-warm-100 rounded mb-1" />
      <div className="w-32 h-3 bg-warm-100 rounded" />
    </div>
  )
}

// ─── Tarjeta KPI ─────────────────────────────────────────────────────────────
type ColorVariant = 'blue' | 'amber' | 'teal' | 'green' | 'purple'

const VARIANT_STYLES: Record<ColorVariant, { icon: string; badge: string; number: string }> = {
  blue:   { icon: 'bg-primary-50 text-primary-600',   badge: 'bg-primary-50 text-primary-700',   number: 'text-primary-900' },
  amber:  { icon: 'bg-accent-50 text-accent-600',     badge: 'bg-accent-50 text-accent-700',     number: 'text-accent-800' },
  teal:   { icon: 'bg-primary-50 text-primary-500',   badge: 'bg-primary-50 text-primary-600',   number: 'text-primary-800' },
  green:  { icon: 'bg-success/10 text-success',       badge: 'bg-success/10 text-success',       number: 'text-success' },
  purple: { icon: 'bg-purple-50 text-purple-600',     badge: 'bg-purple-50 text-purple-700',     number: 'text-purple-900' },
}

type TarjetaKpiProps = {
  icono: React.ReactNode
  titulo: string
  valor: number | string
  subtitulo?: string
  variante?: ColorVariant
  badge?: string
  delay?: string
}

function TarjetaKpi({ icono, titulo, valor, subtitulo, variante = 'blue', badge, delay = '' }: TarjetaKpiProps) {
  const s = VARIANT_STYLES[variante]
  return (
    <div className={`bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in hover:shadow-md transition-shadow ${delay}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.icon}`}>
          {icono}
        </div>
        {badge && (
          <span className={`text-[0.65rem] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${s.badge}`}>
            {badge}
          </span>
        )}
      </div>
      <p className={`font-display text-3xl font-semibold ${s.number}`}>{valor}</p>
      <p className="text-sm text-warm-400 mt-1">{titulo}</p>
      {subtitulo && (
        <p className="text-xs text-warm-300 mt-0.5">{subtitulo}</p>
      )}
    </div>
  )
}

// ─── Fila de estadístico ─────────────────────────────────────────────────────
function FilaEstadistico({
  label,
  valor,
  tooltip,
}: {
  label: string
  valor: string
  tooltip?: string
}) {
  const esSinDatos = valor === 'Sin datos suficientes'
  return (
    <div className="flex items-center justify-between py-3 border-b border-warm-100 last:border-0">
      <span
        className="text-sm font-medium text-primary-700 cursor-default"
        title={tooltip}
      >
        {label}
        {tooltip && (
          <span className="ml-1 text-warm-300 text-[0.65rem]" aria-hidden>ⓘ</span>
        )}
      </span>
      <span className={`text-sm font-semibold ${esSinDatos ? 'text-warm-300 italic' : 'text-primary-900'}`}>
        {valor}
      </span>
    </div>
  )
}

// ─── Indicador "última actualización" ────────────────────────────────────────
function UltimaActualizacion({ iso }: { iso: string | null }) {
  if (!iso) return null
  const d = new Date(iso)
  const hora = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return (
    <span className="text-xs text-warm-300">
      Actualizado {hora}
    </span>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminMetricas() {
  const { metricas, loading, error, refrescar, ultimaActualizacion } = useMetricasMantenimiento()

  const t = metricas?.tiempos_resolucion

  // Botón de refresh manual en el header
  const actions = (
    <div className="flex items-center gap-3">
      <UltimaActualizacion iso={ultimaActualizacion} />
      <button
        id="btn-refrescar-metricas"
        type="button"
        onClick={refrescar}
        disabled={loading}
        className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-primary-700 border border-warm-200 rounded-lg hover:bg-warm-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        title="Refrescar métricas"
      >
        <IconoRefresh spin={loading} />
        Refrescar
      </button>
    </div>
  )

  return (
    <AdminShell
      title="Métricas de mantenimiento"
      subtitle="KPIs operativos en vivo · se actualizan cada 60 s"
      actions={actions}
    >
      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div
          id="metricas-error"
          role="alert"
          className="mb-5 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm animate-fade-in"
        >
          <p className="font-medium">Error al cargar las métricas</p>
          <p className="text-xs mt-0.5 opacity-80">{error}</p>
        </div>
      )}

      {/* ── Tarjetas KPI ──────────────────────────────────────────────────── */}
      <section aria-label="Indicadores clave" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {loading && !metricas ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <TarjetaKpi
              icono={<IconoTotal />}
              titulo="Total acumulado"
              valor={metricas?.total_acumulado ?? 0}
              subtitulo="Solicitudes registradas"
              variante="blue"
              badge="Histórico"
              delay="delay-1"
            />
            <TarjetaKpi
              icono={<IconoPendiente />}
              titulo="Pendientes"
              valor={metricas?.pendientes ?? 0}
              subtitulo="Sin técnico asignado"
              variante="amber"
              badge="Requieren atención"
              delay="delay-2"
            />
            <TarjetaKpi
              icono={<IconoEnProceso />}
              titulo="En proceso"
              valor={metricas?.en_proceso ?? 0}
              subtitulo="Asignadas o en progreso"
              variante="teal"
              badge="Activas"
              delay="delay-3"
            />
            <TarjetaKpi
              icono={<IconoResuelta />}
              titulo="Resueltas hoy"
              valor={metricas?.resueltas_hoy ?? 0}
              subtitulo="Resueltas o cerradas hoy"
              variante="green"
              badge="Hoy"
              delay="delay-4"
            />
          </>
        )}
      </section>

      {/* ── Tiempos de resolución ──────────────────────────────────────────── */}
      <section aria-label="Tiempos de resolución" className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in delay-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
            <IconoTiempo />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary-900">Tiempo promedio de resolución</h2>
            <p className="text-xs text-warm-400">Desde la creación hasta el primer cambio a "resuelta" o "cerrada"</p>
          </div>
        </div>

        {loading && !metricas ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between py-3 border-b border-warm-100 last:border-0 animate-pulse">
                <div className="w-24 h-4 bg-warm-100 rounded" />
                <div className="w-20 h-4 bg-warm-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <FilaEstadistico
              label="Promedio (AVG)"
              valor={formatearHoras(t?.avg_horas ?? null)}
              tooltip="Media aritmética — sensible a casos extremos (outliers)"
            />
            <FilaEstadistico
              label="Mediana (P50)"
              valor={formatearHoras(t?.mediana_horas ?? null)}
              tooltip="El 50% de las solicitudes se resuelven en este tiempo o menos. Robusta ante outliers."
            />
            <FilaEstadistico
              label="Percentil 95 (P95)"
              valor={formatearHoras(t?.p95_horas ?? null)}
              tooltip={`El 95% de las solicitudes se resuelven en este tiempo. Requiere mínimo 2 muestras.`}
            />
          </div>
        )}

        {/* Nota informativa sobre la mediana */}
        <div className="mt-4 p-3 rounded-lg bg-primary-50 border border-primary-100">
          <p className="text-xs text-primary-700">
            <span className="font-semibold">¿Por qué reportamos la mediana?</span>{' '}
            Una sola solicitud muy tardía puede elevar el AVG y dar una imagen distorsionada.
            La mediana (P50) representa el caso típico real y no se ve afectada por outliers.
          </p>
        </div>
      </section>

      {/* ── Nota de refresh automático ────────────────────────────────────── */}
      <p className="mt-4 text-center text-xs text-warm-300 animate-fade-in delay-6">
        Los datos se actualizan automáticamente cada 60 segundos mientras el panel esté visible.
        El refresco se pausa cuando cambias de pestaña.
      </p>
    </AdminShell>
  )
}
