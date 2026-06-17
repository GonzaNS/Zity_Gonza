// Sprint 14 · HU-EJEC-01 — Panel ejecutivo /admin/ejecutivo
//
// Accesible para roles: 'admin' y 'observador'.
// Muestra KPIs de alto nivel reutilizando los mismos hooks y
// componentes de gráficas del panel de métricas del admin.
//
// El observador tiene solo lectura (RLS garantiza esto en BD).
// No hay botones de acción operativa en esta vista.

import { lazy, Suspense, useCallback } from 'react'
import ObservadorShell from '../../components/observador/ObservadorShell'
import { useMetricasMantenimiento } from '../../hooks/useMetricasMantenimiento'
import { useGraficasMantenimiento } from '../../hooks/useGraficasMantenimiento'
import { useMetricasFinanzas } from '../../hooks/useMetricasFinanzas'
import { useMetricasTienda } from '../../hooks/useMetricasTienda'
import { formatearHoras } from '../../lib/metricas'
import { formatearMoneda } from '../../lib/metricasFinanzas'
import { ErrorBoundary } from '../../components/shared/ErrorBoundary'

// Reutilizar las gráficas de Recharts — mismo chunk que /admin/metricas.
// Si ya estaba en caché (el admin visitó primero /admin/metricas), la
// carga es inmediata. Si no, se descarga bajo demanda.
const GraficaVolumenResueltas = lazy(() => import('../../components/admin/GraficasMetricas').then(m => ({ default: m.GraficaVolumenResueltas })))
const GraficaTendencia        = lazy(() => import('../../components/admin/GraficasMetricas').then(m => ({ default: m.GraficaTendencia })))
const GraficaTopCategorias    = lazy(() => import('../../components/admin/GraficasMetricas').then(m => ({ default: m.GraficaTopCategorias })))

const GraficaIngresosTipo  = lazy(() => import('../../components/admin/GraficasFinanzas').then(m => ({ default: m.GraficaIngresosTipo })))
const TarjetaRatioCobranza = lazy(() => import('../../components/admin/GraficasFinanzas').then(m => ({ default: m.TarjetaRatioCobranza })))

const GraficaTendenciaTienda = lazy(() => import('../../components/admin/GraficasTienda').then(m => ({ default: m.GraficaTendenciaTienda })))
const GraficaTopProductos    = lazy(() => import('../../components/admin/GraficasTienda').then(m => ({ default: m.GraficaTopProductos })))

// ─── Skeleton de gráfica ─────────────────────────────────────────────────────
function SkeletonGrafica({ height = 280 }: { height?: number }) {
  return (
    <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6">
      <div className="animate-pulse">
        <div className="w-40 h-4 bg-warm-100 rounded mb-1" />
        <div className="w-56 h-3 bg-warm-100 rounded mb-5" />
        <div className="bg-warm-100/60 rounded-lg" style={{ height }} />
      </div>
    </div>
  )
}

// ─── Skeleton de KPI ─────────────────────────────────────────────────────────
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
type ColorVariant = 'blue' | 'amber' | 'teal' | 'green'

const VARIANT: Record<ColorVariant, { icon: string; badge: string; num: string }> = {
  blue:  { icon: 'bg-primary-50 text-primary-600',  badge: 'bg-primary-50 text-primary-700',  num: 'text-primary-900' },
  amber: { icon: 'bg-accent-50 text-accent-600',    badge: 'bg-accent-50 text-accent-700',    num: 'text-accent-800'  },
  teal:  { icon: 'bg-primary-50 text-primary-500',  badge: 'bg-primary-50 text-primary-600',  num: 'text-primary-800' },
  green: { icon: 'bg-success/10 text-success',      badge: 'bg-success/10 text-success',      num: 'text-success'     },
}

function TarjetaKpi({
  icono, titulo, valor, subtitulo, variante = 'blue', badge, delay = '',
}: {
  icono: React.ReactNode
  titulo: string
  valor: number | string
  subtitulo?: string
  variante?: ColorVariant
  badge?: string
  delay?: string
}) {
  const s = VARIANT[variante]
  return (
    <div className={`bg-white border border-warm-200 rounded-xl p-5 sm:p-6 hover:shadow-md transition-shadow animate-fade-in ${delay}`}>
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
      <p className={`font-display text-3xl font-semibold ${s.num}`}>{valor}</p>
      <p className="text-sm text-warm-400 mt-1">{titulo}</p>
      {subtitulo && <p className="text-xs text-warm-300 mt-0.5">{subtitulo}</p>}
    </div>
  )
}

// ─── Iconos inline ─────────────────────────────────────────────────────────
function IcoTotal() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function IcoPendiente() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IcoEnProceso() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function IcoResuelta() {
  return <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function IcoRefresh({ spin }: { spin?: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spin ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}

// ─── Indicador de última actualización ───────────────────────────────────────
function UltimaAct({ iso }: { iso: string | null }) {
  if (!iso) return null
  const hora = new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return <span className="text-xs text-warm-300">Actualizado {hora}</span>
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Ejecutivo() {
  const {
    metricas,
    loading,
    error: errMetricas,
    refrescar: refrescarMetricas,
    ultimaActualizacion,
  } = useMetricasMantenimiento()

  const {
    graficas,
    loading: loadingGraficas,
    error: errGraficas,
    refrescar: refrescarGraficas,
  } = useGraficasMantenimiento()

  const {
    metricas: metricasFinanzas,
    loading: loadingFinanzas,
    error: errFinanzas,
    refrescar: refrescarFinanzas,
  } = useMetricasFinanzas()

  const {
    metricas: metricasTienda,
    loading: loadingTienda,
    error: errTienda,
    refrescar: refrescarTienda,
  } = useMetricasTienda()

  const cargando = loading || loadingGraficas || loadingFinanzas || loadingTienda

  const refrescarTodo = useCallback(() => {
    void refrescarMetricas()
    void refrescarGraficas()
    void refrescarFinanzas()
    void refrescarTienda()
  }, [refrescarMetricas, refrescarGraficas, refrescarFinanzas, refrescarTienda])

  const t = metricas?.tiempos_resolucion

  const acciones = (
    <div className="flex items-center gap-3">
      <UltimaAct iso={ultimaActualizacion} />
      <button
        id="btn-refrescar-ejecutivo"
        type="button"
        onClick={refrescarTodo}
        disabled={cargando}
        className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-primary-700 border border-warm-200 rounded-lg hover:bg-warm-50 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
        title="Refrescar datos"
      >
        <IcoRefresh spin={cargando} />
        Refrescar
      </button>
    </div>
  )

  return (
    <ObservadorShell
      title="Panel ejecutivo"
      subtitle="Vista general del estado del edificio · solo lectura"
      actions={acciones}
    >
      {/* ── Errores ─────────────────────────────────────────────────── */}
      {(errMetricas || errGraficas) && (
        <div
          id="ejecutivo-error"
          role="alert"
          className="mb-5 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm animate-fade-in"
        >
          {errMetricas && <p><strong>Error en métricas:</strong> {errMetricas}</p>}
          {errGraficas && <p><strong>Error en gráficas:</strong> {errGraficas}</p>}
        </div>
      )}

      {/* ── Sección Mantenimiento ────────────────────────────────────── */}
      <section aria-labelledby="seccion-mantenimiento" className="space-y-6">
        <div className="flex items-center gap-2 pb-2 border-b border-warm-200">
          <svg className="w-6 h-6 text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h2 id="seccion-mantenimiento" className="text-lg font-semibold text-primary-900">
            Desempeño de Mantenimiento
          </h2>
        </div>

        {/* ── KPIs ────────────────────────────────────────────────────── */}
        <div
          aria-label="Indicadores clave del edificio"
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
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
                icono={<IcoTotal />}
                titulo="Total acumulado"
                valor={metricas?.total_acumulado ?? 0}
                subtitulo="Solicitudes registradas"
                variante="blue"
                badge="Histórico"
                delay="delay-1"
              />
              <TarjetaKpi
                icono={<IcoPendiente />}
                titulo="Pendientes"
                valor={metricas?.pendientes ?? 0}
                subtitulo="Sin técnico asignado"
                variante="amber"
                badge="Requieren atención"
                delay="delay-2"
              />
              <TarjetaKpi
                icono={<IcoEnProceso />}
                titulo="En proceso"
                valor={metricas?.en_proceso ?? 0}
                subtitulo="Asignadas o en progreso"
                variante="teal"
                badge="Activas"
                delay="delay-3"
              />
              <TarjetaKpi
                icono={<IcoResuelta />}
                titulo="Resueltas hoy"
                valor={metricas?.resueltas_hoy ?? 0}
                subtitulo="Resueltas o cerradas hoy"
                variante="green"
                badge="Hoy"
                delay="delay-4"
              />
            </>
          )}
        </div>

        {/* ── Tiempos de resolución ───────────────────────────────────── */}
        <div
          aria-label="Tiempos de resolución"
          className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in delay-5"
        >
          <h3 className="text-base font-semibold text-primary-900 mb-4">
            Tiempo promedio de resolución
          </h3>

          {loading && !metricas ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex justify-between py-3 border-b border-warm-100 last:border-0">
                  <div className="w-24 h-4 bg-warm-100 rounded" />
                  <div className="w-20 h-4 bg-warm-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-warm-100">
              {[
                { label: 'Promedio (AVG)',   valor: formatearHoras(t?.avg_horas    ?? null) },
                { label: 'Mediana (P50)',    valor: formatearHoras(t?.mediana_horas ?? null) },
                { label: 'Percentil 95',    valor: formatearHoras(t?.p95_horas     ?? null) },
              ].map(({ label, valor }) => (
                <div key={label} className="flex items-center justify-between py-3">
                  <span className="text-sm font-medium text-primary-700">{label}</span>
                  <span className={`text-sm font-semibold ${valor === 'Sin datos suficientes' ? 'text-warm-300 italic' : 'text-primary-900'}`}>
                    {valor}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Gráficas ────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="flex-1 h-px bg-warm-200" />
            <span className="text-xs font-semibold uppercase tracking-widest text-warm-400 px-2">Visualizaciones</span>
            <div className="flex-1 h-px bg-warm-200" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3">
              <ErrorBoundary title="Volumen mensual de solicitudes resueltas" externalError={errGraficas} onReset={refrescarGraficas}>
                <Suspense fallback={<SkeletonGrafica height={220} />}>
                  <GraficaVolumenResueltas datos={graficas?.tendencia_mensual ?? []} loading={loadingGraficas} />
                </Suspense>
              </ErrorBoundary>
            </div>
            <div className="lg:col-span-2">
              <ErrorBoundary title="Top 5 categorías" externalError={errGraficas} onReset={refrescarGraficas}>
                <Suspense fallback={<SkeletonGrafica height={220} />}>
                  <GraficaTopCategorias datos={graficas?.top_categorias ?? []} loading={loadingGraficas} />
                </Suspense>
              </ErrorBoundary>
            </div>
          </div>

          <div>
            <ErrorBoundary title="Tendencia de los tiempos promedio de resolución" externalError={errGraficas} onReset={refrescarGraficas}>
              <Suspense fallback={<SkeletonGrafica height={260} />}>
                <GraficaTendencia datos={graficas?.tendencia_mensual ?? []} loading={loadingGraficas} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* ── Sección Finanzas ─────────────────────────────────────────── */}
      <section aria-labelledby="seccion-finanzas" className="space-y-6 mt-10">
        <div className="flex items-center gap-2 pb-2 border-b border-warm-200">
          <svg className="w-6 h-6 text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 id="seccion-finanzas" className="text-lg font-semibold text-primary-900">
            Salud Financiera
          </h2>
        </div>

        {errFinanzas && (
          <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm animate-fade-in">
            <p><strong>Error en finanzas:</strong> {errFinanzas}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in delay-1">
            <h3 className="text-base font-semibold text-primary-900 mb-4">
              Ratio de Cobranza del Periodo
            </h3>
            <ErrorBoundary title="Ratio de Cobranza" externalError={errFinanzas} onReset={refrescarFinanzas}>
              <Suspense fallback={<SkeletonGrafica height={180} />}>
                {metricasFinanzas?.ratio ? (
                  <TarjetaRatioCobranza ratio={metricasFinanzas.ratio} loading={loadingFinanzas} />
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-sm text-warm-400 italic">No hay datos</div>
                )}
              </Suspense>
            </ErrorBoundary>
          </div>

          <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in delay-2">
            <h3 className="text-base font-semibold text-primary-900 mb-4">
              Ingresos por Tipo (Cobrados)
            </h3>
            <ErrorBoundary title="Ingresos por Tipo" externalError={errFinanzas} onReset={refrescarFinanzas}>
              <Suspense fallback={<SkeletonGrafica height={220} />}>
                <GraficaIngresosTipo datos={metricasFinanzas?.ingresos_por_tipo ?? []} loading={loadingFinanzas} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      </section>

      {/* ── Sección Tienda ────────────────────────────────────────────── */}
      <section aria-labelledby="seccion-tienda" className="space-y-6 mt-10">
        <div className="flex items-center gap-2 pb-2 border-b border-warm-200">
          <svg className="w-6 h-6 text-primary-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          <h2 id="seccion-tienda" className="text-lg font-semibold text-primary-900">
            Aporte de la Tienda Interna
          </h2>
        </div>

        {errTienda && (
          <div role="alert" className="p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm animate-fade-in">
            <p><strong>Error en tienda:</strong> {errTienda}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tarjeta KPI */}
          <div className="lg:col-span-1">
            {loadingTienda && !metricasTienda ? (
              <SkeletonKpi />
            ) : (
              <TarjetaKpi
                icono={
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
                titulo="Ingresos del mes"
                valor={formatearMoneda(metricasTienda?.ingresos_mes ?? 0)}
                subtitulo={`Periodo: ${metricasTienda?.periodo ?? '-'}`}
                variante="green"
                badge="Ventas confirmadas"
                delay="delay-1"
              />
            )}
          </div>

          {/* Top 5 productos */}
          <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 lg:col-span-2 animate-fade-in delay-2">
            <ErrorBoundary title="Top Productos" externalError={errTienda} onReset={refrescarTienda}>
              <Suspense fallback={
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
              }>
                <GraficaTopProductos datos={metricasTienda?.top_productos ?? []} loading={loadingTienda} />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>

        {/* Tendencia mensual */}
        <div className="bg-white border border-warm-200 rounded-xl p-5 sm:p-6 animate-fade-in delay-3">
          <ErrorBoundary title="Tendencia de ventas" externalError={errTienda} onReset={refrescarTienda}>
            <Suspense fallback={<SkeletonGrafica height={240} />}>
              <GraficaTendenciaTienda datos={metricasTienda?.tendencia ?? []} loading={loadingTienda} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-warm-300 animate-fade-in delay-6">
        Los datos se actualizan automáticamente cada 60 segundos mientras el panel esté visible.
      </p>
    </ObservadorShell>
  )
}
