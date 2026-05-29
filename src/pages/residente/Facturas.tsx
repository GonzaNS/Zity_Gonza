// Sprint 8 · HU-FACT-03 — Vista de facturas del residente.
// Ruta: /residente/facturas
//
// Características:
//   • Cabecera con total acumulado pendiente del período actual.
//   • Filtro por estado: Todas / Pendientes / Pagadas / Vencidas.
//   • Tarjetas por tipo con icono, monto, vencimiento y badge de estado.
//   • Click en tarjeta → panel de detalle con número legible.
//   • Scroll infinito: carga de 25 en 25.
//   • RLS garantiza que solo se muestren facturas del usuario autenticado.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import CampanaNotificaciones from '../../components/shared/CampanaNotificaciones'
import {
  useFacturasResidente,
  type FiltroFactura,
} from '../../hooks/useFacturasResidente'
import {
  LABEL_FACTURA_TIPO,
  LABEL_FACTURA_ESTADO,
  BADGE_FACTURA_ESTADO,
  formatearMonto,
  formatearPeriodo,
  estaVencida,
  type Factura,
  type FacturaTipo,
} from '../../lib/facturas'
import zityLogo from '../../assets/zity_logo.png'

// ─── Iconos por tipo de factura ─────────────────────────────────────────────

const ICONO_TIPO: Record<FacturaTipo, React.ReactNode> = {
  luz: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  agua: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.593c-5.63-5.539-11-10.297-11-14.402C1 3.34 6.267-1 12-1s11 4.34 11 7.191c0 4.105-5.37 8.863-11 14.402z" />
    </svg>
  ),
  pension: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  multa: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
}

const COLOR_TIPO: Record<FacturaTipo, string> = {
  luz:     'bg-amber-50 text-amber-600',
  agua:    'bg-blue-50 text-blue-600',
  pension: 'bg-primary-50 text-primary-600',
  multa:   'bg-error/10 text-error',
}

const FILTROS: { valor: FiltroFactura; label: string }[] = [
  { valor: 'todas',     label: 'Todas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'pagada',    label: 'Pagadas' },
  { valor: 'vencida',   label: 'Vencidas' },
]

// ─── Componente principal ────────────────────────────────────────────────────

export default function ResidenteFacturas() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filtro, setFiltro] = useState<FiltroFactura>('todas')
  const [seleccionada, setSeleccionada] = useState<Factura | null>(null)

  const {
    facturas, loading, loadingMore, error, hayMas, cargarMas, totalPendiente,
  } = useFacturasResidente(filtro)

  // Sprint 8 · HU-FACT-05 — Deep link desde la campana de notificaciones.
  // Si la URL tiene ?id=<factura_id>, busca la factura en la lista cargada;
  // si no está (puede estar en páginas posteriores del scroll infinito),
  // la busca directamente en Supabase para garantizar que el detalle se abra.
  const resolverDeepLink = useCallback(async (idParam: string) => {
    // 1. Buscar en memoria (caso ideal, evita un round-trip)
    const enMemoria = facturas.find(f => f.id === idParam)
    if (enMemoria) {
      setSeleccionada(enMemoria)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('id')
        return next
      }, { replace: true })
      return
    }

    // 2. Fallback: query directa a Supabase (factura puede estar en otra página)
    const { data } = await supabase
      .from('facturas')
      .select('*')
      .eq('id', idParam)
      .maybeSingle()

    if (data) {
      setSeleccionada(data as Factura)
      setSearchParams(prev => {
        const next = new URLSearchParams(prev)
        next.delete('id')
        return next
      }, { replace: true })
    }
  }, [facturas, setSearchParams])

  useEffect(() => {
    const idParam = searchParams.get('id')
    if (!idParam || loading || seleccionada) return
    // resolverDeepLink hace setSeleccionada de forma síncrona en el fast-path en
    // memoria (deep-link desde la campana de notificaciones). Es intencional;
    // la regla set-state-in-effect lo marca como falso positivo en esta línea.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void resolverDeepLink(idParam)
  }, [searchParams, loading, seleccionada, resolverDeepLink])

  // Ref para el observador de scroll infinito
  const centinelaRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!centinelaRef.current || !hayMas) return
    const observer = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) cargarMas() },
      { rootMargin: '200px' },
    )
    observer.observe(centinelaRef.current)
    return () => observer.disconnect()
  }, [hayMas, cargarMas])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  // Si hay una factura seleccionada, mostramos el panel de detalle
  if (seleccionada) {
    return (
      <DetalleFactura
        factura={seleccionada}
        onVolver={() => setSeleccionada(null)}
        onSignOut={handleSignOut}
      />
    )
  }

  const periodoActual = new Date().toISOString().slice(0, 7)

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/residente')}
              className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer mr-1"
              aria-label="Volver al dashboard"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <img src={zityLogo} alt="Zity" className="h-8 w-auto" />
            <span className="text-xs font-semibold bg-accent-500 text-white px-2.5 py-1 rounded-full tracking-wider uppercase">
              Residente
            </span>
          </div>
          <div className="flex items-center gap-3">
            <CampanaNotificaciones />
            <Link to="/perfil" className="text-sm text-primary-700 font-medium hidden sm:inline hover:text-primary-900">
              {profile?.nombre}
            </Link>
            <button onClick={handleSignOut} className="text-sm text-warm-400 hover:text-error transition-colors font-medium cursor-pointer">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Título + cabecera de total */}
        <div className="mb-6 animate-fade-in">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Mis facturas
          </h1>
          {totalPendiente !== null && totalPendiente > 0 && (
            <div className="mt-3 inline-flex items-center gap-2.5 bg-accent-50 border border-accent-200 rounded-xl px-4 py-3">
              <svg className="w-5 h-5 text-accent-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-accent-800">
                Tienes <span className="text-accent-900">{formatearMonto(totalPendiente)}</span> por pagar este mes
                <span className="text-accent-600 font-normal ml-1">({formatearPeriodo(periodoActual)})</span>
              </p>
            </div>
          )}
          {totalPendiente === 0 && !loading && (
            <p className="mt-2 text-sm text-success font-medium">
              ✓ Estás al corriente con tus pagos de este mes.
            </p>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-1.5 flex-wrap mb-6 animate-fade-in delay-1">
          {FILTROS.map(f => (
            <button
              key={f.valor}
              type="button"
              onClick={() => { setFiltro(f.valor); setSeleccionada(null) }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                filtro === f.valor
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-warm-500 border-warm-200 hover:border-primary-300 hover:text-primary-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
            {error}
          </div>
        )}

        {/* Estado de carga inicial */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : facturas.length === 0 ? (
          <EmptyState filtro={filtro} />
        ) : (
          <>
            {/* Grid de tarjetas */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in delay-2">
              {facturas.map(factura => (
                <li key={factura.id}>
                  <CardFactura
                    factura={factura}
                    onSeleccionar={() => setSeleccionada(factura)}
                  />
                </li>
              ))}
            </ul>

            {/* Centinela de scroll infinito */}
            <div ref={centinelaRef} className="mt-6 flex justify-center">
              {loadingMore && (
                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              )}
              {!hayMas && facturas.length > 0 && (
                <p className="text-xs text-warm-400">· Fin del historial ·</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Tarjeta de factura ──────────────────────────────────────────────────────

function CardFactura({ factura, onSeleccionar }: { factura: Factura; onSeleccionar: () => void }) {
  // Detectar si está vencida visualmente aunque el estado en BD no lo indique aún
  const estadoVisual = estaVencida(factura) && factura.estado === 'pendiente' ? 'vencida' : factura.estado

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      className="w-full text-left bg-white border border-warm-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        {/* Icono + tipo */}
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${COLOR_TIPO[factura.tipo]}`}>
            {ICONO_TIPO[factura.tipo]}
          </div>
          <div>
            <p className="font-semibold text-primary-900 text-sm leading-tight">
              {LABEL_FACTURA_TIPO[factura.tipo]}
            </p>
            <p className="text-xs text-warm-400 mt-0.5">{formatearPeriodo(factura.periodo)}</p>
          </div>
        </div>
        {/* Badge de estado */}
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border shrink-0 ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
          {LABEL_FACTURA_ESTADO[estadoVisual]}
        </span>
      </div>

      {/* Monto */}
      <p className="font-display text-3xl font-bold text-primary-900 leading-none mb-3">
        {formatearMonto(factura.monto)}
      </p>

      {/* Vencimiento */}
      <div className="flex items-center justify-between text-xs text-warm-400">
        <span>
          Vence:{' '}
          <span className={estadoVisual === 'vencida' ? 'text-error font-semibold' : 'text-primary-800 font-medium'}>
            {new Date(factura.vencimiento + 'T12:00:00').toLocaleDateString('es', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        </span>
        <svg className="w-4 h-4 text-warm-300 group-hover:text-primary-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}

// ─── Panel de detalle ────────────────────────────────────────────────────────

function DetalleFactura({
  factura, onVolver, onSignOut,
}: {
  factura: Factura
  onVolver: () => void
  onSignOut: () => void
}) {
  const estadoVisual = estaVencida(factura) && factura.estado === 'pendiente' ? 'vencida' : factura.estado

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onVolver}
              className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer mr-1"
              aria-label="Volver a facturas"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-medium text-primary-900">Detalle de factura</span>
          </div>
          <button onClick={onSignOut} className="text-sm text-warm-400 hover:text-error transition-colors font-medium cursor-pointer">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="bg-white border border-warm-200 rounded-2xl overflow-hidden shadow-sm animate-fade-in">
          {/* Encabezado de tarjeta */}
          <div className="p-6 sm:p-8 border-b border-warm-100">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${COLOR_TIPO[factura.tipo]}`}>
                  {ICONO_TIPO[factura.tipo]}
                </div>
                <div>
                  <p className="font-display text-xl font-semibold text-primary-900">
                    {LABEL_FACTURA_TIPO[factura.tipo]}
                  </p>
                  <p className="text-sm text-warm-400">{formatearPeriodo(factura.periodo)}</p>
                </div>
              </div>
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
                {LABEL_FACTURA_ESTADO[estadoVisual]}
              </span>
            </div>

            <p className="font-display text-4xl font-bold text-primary-900 mt-6 leading-none">
              {formatearMonto(factura.monto)}
            </p>
          </div>

          {/* Desglose */}
          <div className="p-6 sm:p-8 space-y-4">
            <FilaDetalle label="N° de factura" valor={factura.numero ?? '—'} mono />
            <FilaDetalle label="Período" valor={formatearPeriodo(factura.periodo)} />
            <FilaDetalle label="Fecha de emisión" valor={formatearFecha(factura.fecha_emision)} />
            <FilaDetalle
              label="Fecha de vencimiento"
              valor={formatearFecha(factura.vencimiento)}
              resaltado={estadoVisual === 'vencida'}
            />
            {factura.descripcion && (
              <div className="pt-2 border-t border-warm-100">
                <p className="text-xs text-warm-400 mb-1">Descripción</p>
                <p className="text-sm text-primary-800 leading-relaxed">{factura.descripcion}</p>
              </div>
            )}
          </div>

          {/* Botón volver */}
          <div className="px-6 sm:px-8 pb-6 sm:pb-8">
            <button
              type="button"
              onClick={onVolver}
              className="w-full h-11 text-sm font-semibold text-primary-700 border border-warm-300 rounded-xl hover:bg-warm-50 hover:border-primary-300 transition-all cursor-pointer"
            >
              ← Volver a mis facturas
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ filtro }: { filtro: FiltroFactura }) {
  return (
    <div className="bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      </div>
      <p className="font-medium text-primary-900">No hay facturas</p>
      <p className="text-sm text-warm-400 mt-1">
        {filtro === 'todas'
          ? 'Aún no se han emitido facturas para tu cuenta.'
          : `No tienes facturas con estado "${LABEL_FACTURA_ESTADO[filtro as Exclude<FiltroFactura, 'todas'>]}".`}
      </p>
    </div>
  )
}

// ─── Utilidades locales ───────────────────────────────────────────────────────

function FilaDetalle({
  label, valor, mono, resaltado,
}: {
  label: string
  valor: string
  mono?: boolean
  resaltado?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-warm-400">{label}</p>
      <p className={`text-sm font-medium ${resaltado ? 'text-error' : 'text-primary-900'} ${mono ? 'font-mono' : ''}`}>
        {valor}
      </p>
    </div>
  )
}

function formatearFecha(iso: string): string {
  // iso puede ser 'YYYY-MM-DD' (date sin time zone)
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}
