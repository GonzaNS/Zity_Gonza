// Sprint 7 · HU-KPI-01 · Componentes de gráficas Recharts para /admin/metricas
//
// Este archivo se importa de forma lazy desde Metricas.tsx con React.lazy(),
// lo que garantiza que Recharts (~370 KB min) solo se descarga cuando el usuario
// navega a /admin/metricas — no infla el bundle inicial.
//
// Gráficas implementadas:
//   1. GraficaTipoBarra    — BarChart horizontal: conteo por tipo de solicitud
//   2. GraficaTendencia    — LineChart: AVG y mediana mensual de tiempos
//   3. GraficaTopCategorias — Lista con barras de proporción CSS (no Recharts)
//
// Paleta de colores: tokens Zity (azul Oxford primary + warm gold accent + success/warning).

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import type {
  DatoPorTipo,
  DatoTendenciaMensual,
  DatoTopCategoria,
} from '../../lib/metricas'
import {
  LABEL_TIPO,
  LABEL_CATEGORIA,
  formatearHoras,
  formatearMes,
} from '../../lib/metricas'

// ─── Paleta Zity para Recharts ──────────────────────────────────────────────
// Los valores deben ser literales de color; Recharts no puede leer CSS vars.
const ZITY = {
  primary:   '#1b3a4b',   // primary-600 (azul Oxford)
  primary300:'#81b1c3',   // primary-300
  primary400:'#5797af',   // primary-400
  accent:    '#d4a043',   // accent-500 (warm gold)
  accent300: '#ebcc7a',   // accent-300
  success:   '#4a7c59',
  warm200:   '#ebe7dd',
  warm400:   '#b8b0a0',
  text:      '#0c1921',   // primary-900
  textLight: '#b8b0a0',   // warm-400
}

// Colores para las barras de tipos (una paleta degradada del azul Zity)
const COLORES_TIPO = [
  ZITY.primary,
  ZITY.primary400,
  ZITY.primary300,
  '#abcbd7',   // primary-200
  '#d5e5eb',   // primary-100
]

// ─── Tooltip personalizado ──────────────────────────────────────────────────
function TooltipBase({ active, payload, label, formatValor }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  formatValor?: (v: number, name: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-warm-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[120px]">
      {label && <p className="font-semibold text-primary-900 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-warm-400 flex-1">{p.name}:</span>
          <span className="font-semibold text-primary-900">
            {formatValor ? formatValor(p.value, p.name) : p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Skeleton de gráfica ────────────────────────────────────────────────────
function SkeletonGrafica({ height = 200 }: { height?: number }) {
  return (
    <div
      className="bg-warm-100/60 rounded-lg animate-pulse"
      style={{ height }}
    />
  )
}

// ─── 1. Gráfica de barras horizontales por tipo ──────────────────────────────

type GraficaTipoBarraProps = {
  datos: DatoPorTipo[]
  loading: boolean
}

export function GraficaTipoBarra({ datos, loading }: GraficaTipoBarraProps) {
  // Transformar para Recharts: agregar label legible y ordenar desc
  const datosChart = datos
    .map(d => ({ ...d, label: LABEL_TIPO[d.tipo] ?? d.tipo }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-primary-900">Solicitudes por tipo</h2>
        <p className="text-xs text-warm-400 mt-0.5">Conteo acumulado por categoría de solicitud</p>
      </div>

      {loading ? (
        <SkeletonGrafica height={220} />
      ) : datosChart.every(d => d.total === 0) ? (
        <div className="flex items-center justify-center h-[220px] text-warm-400 text-sm">
          Sin solicitudes registradas aún
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={datosChart}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              stroke={ZITY.warm200}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: ZITY.textLight }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={100}
              tick={{ fontSize: 12, fill: ZITY.text }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={(props) => (
                <TooltipBase
                  active={props.active}
                  payload={props.payload as unknown as Parameters<typeof TooltipBase>[0]['payload']}
                  label={props.label as string}
                  formatValor={(v) => `${v} solicitud${v !== 1 ? 'es' : ''}`}
                />
              )}
              cursor={{ fill: ZITY.warm200, opacity: 0.6 }}
            />
            <Bar dataKey="total" name="Total" radius={[0, 4, 4, 0]} maxBarSize={28}>
              {datosChart.map((_, i) => (
                <Cell key={i} fill={COLORES_TIPO[i % COLORES_TIPO.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── 1b. Gráfica de barras del volumen mensual de solicitudes resueltas (último trimestre) ──

type GraficaVolumenResueltasProps = {
  datos: DatoTendenciaMensual[]
  loading: boolean
}

export function GraficaVolumenResueltas({ datos, loading }: GraficaVolumenResueltasProps) {
  // Quedarse solo con el último trimestre (los últimos 3 meses)
  const datosTrimester = datos.slice(-3).map(d => ({
    ...d,
    label: formatearMes(d.mes),
    resueltas: d.resueltas ?? 0
  }))

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-primary-900">Volumen mensual de solicitudes resueltas</h2>
        <p className="text-xs text-warm-400 mt-0.5">Historial del último trimestre</p>
      </div>

      {loading ? (
        <SkeletonGrafica height={220} />
      ) : datosTrimester.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-warm-400 text-sm">
          Sin solicitudes resueltas en el último trimestre
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={datosTrimester}
            margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={ZITY.warm200}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: ZITY.textLight }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: ZITY.textLight }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={30}
            />
            <Tooltip
              content={(props) => (
                <TooltipBase
                  active={props.active}
                  payload={props.payload as unknown as Parameters<typeof TooltipBase>[0]['payload']}
                  label={props.label as string}
                  formatValor={(v) => `${v} solicitud${v !== 1 ? 'es resueltas' : ' resuelta'}`}
                />
              )}
              cursor={{ fill: ZITY.warm200, opacity: 0.4 }}
            />
            <Bar dataKey="resueltas" name="Resueltas" fill={ZITY.primary} radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ─── 2. Gráfica de líneas: tendencia mensual de tiempos ─────────────────────

type GraficaTendenciaProps = {
  datos: DatoTendenciaMensual[]
  loading: boolean
}

export function GraficaTendencia({ datos, loading }: GraficaTendenciaProps) {
  // Transformar: convertir 'YYYY-MM' a etiqueta legible y horas a texto para tooltip
  const datosChart = datos.map(d => ({
    ...d,
    mesLabel: formatearMes(d.mes),
    avg_horas: d.avg_horas ?? undefined,
    mediana_horas: d.mediana_horas ?? undefined,
  }))

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-primary-900">Tendencia mensual de resolución</h2>
        <p className="text-xs text-warm-400 mt-0.5">Tiempo promedio y mediana de los últimos 6 meses</p>
      </div>

      {loading ? (
        <SkeletonGrafica height={240} />
      ) : datosChart.length === 0 ? (
        <div className="flex items-center justify-center h-[240px] text-warm-400 text-sm text-center px-4">
          Sin datos de resolución en los últimos 6 meses
        </div>
      ) : (
        /* overflow-x-auto para scroll horizontal en móvil */
        <div className="overflow-x-auto">
          <div style={{ minWidth: datosChart.length > 3 ? undefined : 300 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={datosChart}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ZITY.warm200}
                />
                <XAxis
                  dataKey="mesLabel"
                  tick={{ fontSize: 11, fill: ZITY.textLight }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: ZITY.textLight }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => formatearHoras(v)}
                  width={52}
                />
                <Tooltip
                  content={(props) => (
                    <TooltipBase
                      active={props.active}
                      payload={props.payload as unknown as Parameters<typeof TooltipBase>[0]['payload']}
                      label={props.label as string}
                      formatValor={(v) => formatearHoras(v)}
                    />
                  )}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  formatter={(value: string) =>
                    value === 'avg_horas' ? 'Promedio (AVG)' : 'Mediana (P50)'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="avg_horas"
                  name="avg_horas"
                  stroke={ZITY.primary}
                  strokeWidth={2}
                  dot={{ fill: ZITY.primary, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="mediana_horas"
                  name="mediana_horas"
                  stroke={ZITY.accent}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={{ fill: ZITY.accent, r: 4 }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Leyenda de colores */}
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-warm-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded" style={{ background: ZITY.primary, display: 'inline-block' }} />
          Promedio — afectado por outliers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-0.5 rounded border-t-2 border-dashed" style={{ borderColor: ZITY.accent, display: 'inline-block', height: 0 }} />
          Mediana — resistente a outliers
        </span>
      </div>
    </div>
  )
}

// ─── 3. Top 5 categorías — barras de proporción CSS ─────────────────────────
// Implementadas en CSS nativo para no añadir otro componente de Recharts.
// Es la visualización más simple y eficiente para un ranking de 5 items.

type GraficaTopCategoriasProps = {
  datos: DatoTopCategoria[]
  loading: boolean
}

export function GraficaTopCategorias({ datos, loading }: GraficaTopCategoriasProps) {
  // Colores para las 5 categorías top
  const coloresCat = [ZITY.primary, ZITY.primary400, ZITY.primary300, ZITY.accent, ZITY.accent300]

  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-primary-900">Top 5 categorías</h2>
        <p className="text-xs text-warm-400 mt-0.5">Categorías más frecuentes por volumen de solicitudes</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="w-24 h-3 bg-warm-100 rounded" />
                <div className="w-10 h-3 bg-warm-100 rounded" />
              </div>
              <div className="h-2 bg-warm-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : datos.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-warm-400 text-sm">
          Sin datos disponibles
        </div>
      ) : (
        <ol className="space-y-4">
          {datos.map((d, i) => (
            <li key={d.categoria}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white shrink-0"
                    style={{ background: coloresCat[i] }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-primary-800 truncate">
                    {LABEL_CATEGORIA[d.categoria] ?? d.categoria}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 shrink-0 ml-3">
                  <span className="text-sm font-semibold text-primary-900">{d.total}</span>
                  <span className="text-xs text-warm-400">{d.porcentaje}%</span>
                </div>
              </div>
              {/* Barra de proporción CSS */}
              <div className="h-2 bg-warm-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${d.porcentaje}%`,
                    background: coloresCat[i],
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
