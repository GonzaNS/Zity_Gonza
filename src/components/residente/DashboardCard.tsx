// Sprint 13 · HU-HOME-01 — Tarjeta genérica para el dashboard integral del residente.
//
// Uso:
//   <DashboardCard
//     id="card-solicitudes"
//     title="Mis solicitudes"
//     icon={<SolicitudIcon />}
//     accent="teal"
//     href="/residente/solicitudes"
//     stats={[{ label: 'Pendientes', value: 3 }]}
//     badge={{ label: '3 pendientes', variant: 'warning' }}
//     loading={loading}
//   />

import { Link } from 'react-router-dom'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type StatItem = {
  label: string
  value: string | number
  highlight?: 'error' | 'warning' | 'success' | 'neutral'
}

type BadgeVariant = 'error' | 'warning' | 'success' | 'neutral'

type Props = {
  /** ID único para accesibilidad y tests (data-testid). */
  id: string
  title: string
  /** Icono SVG o React node (w-6 h-6 recomendado). */
  icon: React.ReactNode
  /** Color del acento (borde izquierdo + icono de fondo). */
  accent: 'teal' | 'gold' | 'green'
  /** Ruta de destino al hacer clic. */
  href: string
  /** KPIs secundarios de la tarjeta (máx. 3 para no saturar). */
  stats?: StatItem[]
  /** Badge llamativo en la esquina superior derecha. */
  badge?: { label: string; variant: BadgeVariant }
  /** Muestra el esqueleto animado mientras carga. */
  loading?: boolean
}

// ─── Paletas de acento ────────────────────────────────────────────────────────

const ACCENT_BORDER: Record<Props['accent'], string> = {
  teal:  'border-l-primary-500',
  gold:  'border-l-accent-500',
  green: 'border-l-[#4a7c59]',
}

const ACCENT_ICON_BG: Record<Props['accent'], string> = {
  teal:  'bg-primary-50 text-primary-600',
  gold:  'bg-accent-50 text-accent-700',
  green: 'bg-[#4a7c59]/10 text-[#2d5f3f]',
}

// ─── Paletas de badge ─────────────────────────────────────────────────────────

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  error:   'bg-error/10 text-error border-error/20',
  warning: 'bg-accent-50 text-accent-800 border-accent-200',
  success: 'bg-[#4a7c59]/10 text-[#2d5f3f] border-[#4a7c59]/20',
  neutral: 'bg-warm-100 text-warm-500 border-warm-200',
}

const HIGHLIGHT_CLASSES: Record<NonNullable<StatItem['highlight']>, string> = {
  error:   'text-error font-semibold',
  warning: 'text-accent-700 font-semibold',
  success: 'text-[#2d5f3f] font-semibold',
  neutral: 'text-warm-400',
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function DashboardCard({
  id, title, icon, accent, href, stats = [], badge, loading = false,
}: Props) {
  if (loading) {
    return (
      <div
        id={id}
        className="bg-white rounded-2xl border border-warm-200 border-l-4 border-l-warm-200 p-6 flex flex-col gap-4 animate-pulse"
        aria-busy="true"
        aria-label={`Cargando ${title}`}
      >
        {/* Skeleton header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-warm-100" />
            <div className="h-5 w-32 bg-warm-100 rounded" />
          </div>
          <div className="h-5 w-20 bg-warm-100 rounded-full" />
        </div>
        {/* Skeleton stats */}
        <div className="flex gap-6 pt-2">
          <div className="h-8 w-16 bg-warm-100 rounded" />
          <div className="h-8 w-16 bg-warm-100 rounded" />
          <div className="h-8 w-16 bg-warm-100 rounded" />
        </div>
        {/* Skeleton CTA */}
        <div className="mt-auto pt-4 border-t border-warm-100 h-4 w-24 bg-warm-100 rounded" />
      </div>
    )
  }

  return (
    <Link
      to={href}
      id={id}
      data-testid={id}
      className={[
        'group block bg-white rounded-2xl border border-warm-200 border-l-4',
        ACCENT_BORDER[accent],
        'p-6 flex flex-col gap-4',
        'hover:-translate-y-0.5 hover:shadow-md hover:border-warm-300',
        'transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2',
      ].join(' ')}
      aria-label={`Ir a ${title}`}
    >
      {/* ── Cabecera: icono + título + badge ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ACCENT_ICON_BG[accent]}`}>
            {icon}
          </div>
          <h2 className="font-display text-base font-semibold text-primary-900 leading-tight">
            {title}
          </h2>
        </div>

        {badge && (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border shrink-0 ${BADGE_CLASSES[badge.variant]}`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* ── Estadísticas ── */}
      {stats.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-3">
          {stats.map(({ label, value, highlight }) => (
            <div key={label} className="flex flex-col">
              <dt className="text-xs text-warm-400">{label}</dt>
              <dd className={`font-display text-2xl font-bold leading-none mt-0.5 ${
                highlight ? HIGHLIGHT_CLASSES[highlight] : 'text-primary-900'
              }`}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* ── CTA ── */}
      <div className="mt-auto pt-4 border-t border-warm-100 flex items-center justify-between">
        <span className="text-xs font-medium text-warm-400 group-hover:text-primary-600 transition-colors">
          Ver detalles
        </span>
        <svg
          className="w-4 h-4 text-warm-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
