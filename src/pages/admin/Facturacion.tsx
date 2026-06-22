// Sprint 8 · HU-FACT-02 — Emisión de facturas (individual / lote).
// Sprint 9 · HU-FACT-04/06 + PBI-S8-E02 — Listado de facturas emitidas con
// totales del periodo, filtros, y acción "Marcar como pagada" en el drawer.
// Ruta: /admin/facturacion
//
// Dos pestañas:
//   • Facturas emitidas (default): totales del periodo + filtros + tabla + drawer.
//   • Emitir nueva: formulario individual / lote (Sprint 8).

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import AdminShell from '../../components/admin/AdminShell'
import { supabase } from '../../lib/supabase'
import { useResidentesActivos } from '../../hooks/useResidentesActivos'
import { useFacturasAdmin, ADMIN_FACTURAS_LIMIT, type FacturaAdmin } from '../../hooks/useFacturasAdmin'
import type { FiltroFactura, FiltroTipoFactura } from '../../hooks/useFacturasResidente'
import TarjetaTotales from '../../components/admin/facturacion/TarjetaTotales'
import TablaFacturasAdmin from '../../components/admin/facturacion/TablaFacturasAdmin'
import DrawerFacturaAdmin from '../../components/admin/facturacion/DrawerFacturaAdmin'
import {
  LABEL_FACTURA_TIPO,
  formatearMonto,
  type FacturaTipo,
} from '../../lib/facturas'

// ─── Utilidades de fecha ────────────────────────────────────────────────────

/** Devuelve el último día del mes indicado en formato 'YYYY-MM-DD'. */
function ultimoDiaDelMes(periodo: string): string {
  if (!periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return ''
  const [year, month] = periodo.split('-').map(Number)
  const ultimo = new Date(year!, month!, 0)
  return ultimo.toISOString().split('T')[0]!
}

/** Periodo por defecto: mes actual en formato 'YYYY-MM'. */
function periodoActual(): string {
  return new Date().toISOString().slice(0, 7)
}

// ─── Tipos internos ─────────────────────────────────────────────────────────

type Tab = 'listado' | 'emitir'

type CamposForm = {
  residente_id: string
  tipo: FacturaTipo | ''
  monto: string
  periodo: string
  vencimiento: string
  descripcion: string
}

type Toast = { tipo: 'success' | 'error'; msg: string } | null

const CAMPOS_VACÍOS: CamposForm = {
  residente_id: '',
  tipo: '',
  monto: '',
  periodo: periodoActual(),
  vencimiento: ultimoDiaDelMes(periodoActual()),
  descripcion: '',
}

// 'tienda' se excluye de la emisión manual: esas facturas las genera el cierre de
// pedidos del mes (HU-TIENDA-04 · facturar_pedidos_periodo), no el admin a mano.
const TIPOS_FACTURA = (Object.entries(LABEL_FACTURA_TIPO) as [FacturaTipo, string][])
  .filter(([tipo]) => tipo !== 'tienda')

const FILTROS: { valor: FiltroFactura; label: string }[] = [
  { valor: 'todas',     label: 'Todas' },
  { valor: 'pendiente', label: 'Pendientes' },
  { valor: 'pagada',    label: 'Pagadas' },
  { valor: 'vencida',   label: 'Vencidas' },
]

// Sprint 12 (feedback) — filtro por tipo en el listado (incluye 'tienda', que
// se genera con el cierre de pedidos y antes era difícil de localizar).
const FILTROS_TIPO: { valor: FiltroTipoFactura; label: string }[] = [
  { valor: 'todas', label: 'Todos los tipos' },
  ...(Object.entries(LABEL_FACTURA_TIPO) as [FacturaTipo, string][])
    .map(([valor, label]) => ({ valor: valor as FiltroTipoFactura, label })),
]

// ─── Componente principal (tabs) ──────────────────────────────────────────────

export default function AdminFacturacion() {
  const [tab, setTab] = useState<Tab>('listado')

  return (
    <AdminShell
      title="Facturación"
      subtitle="Registra pagos, controla vencimientos y emite nuevas facturas."
    >
      <div className="flex gap-1 p-1 bg-warm-100 rounded-xl w-fit mb-6 sm:mb-8 animate-fade-in">
        {([['listado', 'Facturas emitidas'], ['emitir', 'Emitir nueva']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              tab === t ? 'bg-white text-primary-700 shadow-sm' : 'text-warm-400 hover:text-primary-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'listado' ? <PanelListado /> : <PanelEmision />}
    </AdminShell>
  )
}

// ─── Panel: listado de facturas emitidas + totales + pago ─────────────────────

/** Facturas por página en el listado del admin (paginación en cliente). */
const POR_PAGINA = 10

function PanelListado() {
  const [filtro, setFiltro] = useState<FiltroFactura>('todas')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipoFactura>('todas')
  const [periodo, setPeriodo] = useState<string>(periodoActual())
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [seleccionada, setSeleccionada] = useState<FacturaAdmin | null>(null)
  const [toast, setToast] = useState<Toast>(null)

  const { facturas, totales, loading, error, recargar } = useFacturasAdmin(filtro, periodo, filtroTipo)

  // Búsqueda en cliente por residente (nombre/apellido/depto/piso) o N° de factura.
  const facturasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return facturas
    return facturas.filter(f => {
      const r = f.residente
      const texto = [r?.nombre, r?.apellido, r?.departamento, r?.piso, f.numero]
        .filter(Boolean).join(' ').toLowerCase()
      return texto.includes(q)
    })
  }, [facturas, busqueda])

  const totalPaginas = Math.max(1, Math.ceil(facturasFiltradas.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const facturasPagina = useMemo(
    () => facturasFiltradas.slice((paginaSegura - 1) * POR_PAGINA, paginaSegura * POR_PAGINA),
    [facturasFiltradas, paginaSegura],
  )

  function mostrarToast(tipo: 'success' | 'error', msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4500)
  }

  // Tras registrar un pago: cierra el drawer, avisa y recalcula totales en vivo.
  function handlePagoRegistrado(mensaje: string) {
    setSeleccionada(null)
    mostrarToast('success', mensaje)
    recargar()
  }

  const desde = (paginaSegura - 1) * POR_PAGINA
  const limiteAlcanzado = facturas.length >= ADMIN_FACTURAS_LIMIT

  return (
    <>
      <TarjetaTotales totales={totales} periodo={periodo} onPeriodoChange={p => { setPeriodo(p); setPagina(1) }} loading={loading} />

      {/* Toolbar: búsqueda + contador */}
      <div className="flex items-center gap-3 mb-3 animate-fade-in">
        <div className="relative flex-1 min-w-0">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="search"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            placeholder="Buscar por residente o N° de factura…"
            aria-label="Buscar facturas"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-warm-200 text-sm text-primary-900 placeholder:text-warm-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        {!loading && (
          <span className="text-sm text-warm-500 shrink-0 tabular-nums">
            {facturasFiltradas.length === facturas.length
              ? `${facturas.length} factura${facturas.length !== 1 ? 's' : ''}`
              : `${facturasFiltradas.length} de ${facturas.length}`}
          </span>
        )}
      </div>

      {/* Filtros por estado + tipo */}
      <div className="flex items-center gap-1.5 flex-wrap mb-5 animate-fade-in">
        {FILTROS.map(f => (
          <button
            key={f.valor}
            type="button"
            onClick={() => { setFiltro(f.valor); setPagina(1) }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
              filtro === f.valor
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-warm-500 border-warm-200 hover:border-primary-300 hover:text-primary-700'
            }`}
          >
            {f.label}
          </button>
        ))}

        <span className="mx-1 h-5 w-px bg-warm-200 hidden sm:inline-block" aria-hidden="true" />

        <select
          value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value as FiltroTipoFactura); setPagina(1) }}
          aria-label="Filtrar por tipo de factura"
          className="h-9 px-3 rounded-full text-sm font-medium text-primary-700 bg-white border border-warm-200 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
        >
          {FILTROS_TIPO.map(t => (
            <option key={t.valor} value={t.valor}>{t.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-5 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : facturas.length === 0 ? (
        <div className="bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
          <p className="font-medium text-primary-900">No hay facturas</p>
          <p className="text-sm text-warm-400 mt-1">
            {filtro === 'todas'
              ? 'Aún no se han emitido facturas. Usa la pestaña "Emitir nueva".'
              : 'No hay facturas con ese estado.'}
          </p>
        </div>
      ) : facturasFiltradas.length === 0 ? (
        <div className="bg-white border border-warm-200 rounded-xl p-10 text-center animate-fade-in">
          <p className="font-medium text-primary-900">Sin resultados</p>
          <p className="text-sm text-warm-400 mt-1">
            No se encontraron facturas para «{busqueda.trim()}».
          </p>
        </div>
      ) : (
        <>
          <TablaFacturasAdmin facturas={facturasPagina} onSeleccionar={setSeleccionada} />

          {/* Paginación + aviso de límite */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <p className="text-xs text-warm-400 tabular-nums order-2 sm:order-1">
              Mostrando {desde + 1}–{Math.min(desde + POR_PAGINA, facturasFiltradas.length)} de {facturasFiltradas.length}
              {limiteAlcanzado && (
                <span className="block sm:inline sm:ml-2 text-warm-400">
                  · se cargan las {ADMIN_FACTURAS_LIMIT} más recientes; acota por periodo o filtros para ver el resto.
                </span>
              )}
            </p>
            {totalPaginas > 1 && (
              <div className="flex items-center gap-1 shrink-0 order-1 sm:order-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={paginaSegura <= 1}
                  aria-label="Página anterior"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-warm-200 text-primary-700 bg-white hover:border-primary-300 hover:text-primary-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm text-warm-500 tabular-nums px-2 min-w-[4.5rem] text-center">
                  {paginaSegura} / {totalPaginas}
                </span>
                <button
                  type="button"
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={paginaSegura >= totalPaginas}
                  aria-label="Página siguiente"
                  className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-warm-200 text-primary-700 bg-white hover:border-primary-300 hover:text-primary-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {seleccionada && (
        <DrawerFacturaAdmin
          factura={seleccionada}
          onClose={() => setSeleccionada(null)}
          onPagoRegistrado={handlePagoRegistrado}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in text-white ${
            toast.tipo === 'error' ? 'bg-error' : 'bg-success'
          }`}
        >
          {toast.tipo === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}
    </>
  )
}

// ─── Panel: emisión individual / lote (Sprint 8) ──────────────────────────────

function PanelEmision() {
  const [modo, setModo] = useState<'individual' | 'lote'>('individual')
  const [form, setForm] = useState<CamposForm>(CAMPOS_VACÍOS)
  const [erroresForm, setErroresForm] = useState<Partial<Record<keyof CamposForm, string>>>({})
  const [enviando, setEnviando] = useState(false)
  const [toast, setToast] = useState<Toast>(null)
  const [modalLote, setModalLote] = useState(false)

  const { residentes, loading: loadingRes } = useResidentesActivos()

  function mostrarToast(tipo: 'success' | 'error', msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4500)
  }

  function setCampo<K extends keyof CamposForm>(key: K, value: CamposForm[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'periodo') {
        next.vencimiento = ultimoDiaDelMes(value as string)
      }
      return next
    })
    setErroresForm(prev => ({ ...prev, [key]: undefined }))
  }

  function validar(): boolean {
    const errs: Partial<Record<keyof CamposForm, string>> = {}
    if (modo === 'individual' && !form.residente_id) errs.residente_id = 'Selecciona un residente.'
    if (!form.tipo) errs.tipo = 'Selecciona un tipo.'
    const monto = Number(form.monto)
    if (form.monto === '' || isNaN(monto)) errs.monto = 'Ingresa un monto válido.'
    else if (monto < 0) errs.monto = 'El monto no puede ser negativo.'
    if (!form.periodo || !/^\d{4}-(0[1-9]|1[0-2])$/.test(form.periodo)) errs.periodo = 'Formato inválido (YYYY-MM).'
    if (!form.vencimiento) errs.vencimiento = 'Ingresa la fecha de vencimiento.'
    if (form.vencimiento && form.periodo) {
      const emision = new Date(`${form.periodo}-01`)
      const venc = new Date(form.vencimiento)
      if (venc < emision) errs.vencimiento = 'El vencimiento debe ser posterior al inicio del período.'
    }
    setErroresForm(errs)
    return Object.keys(errs).length === 0
  }

  async function handleIndividual(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setEnviando(true)

    const { error } = await supabase.from('facturas').insert({
      residente_id: form.residente_id,
      tipo: form.tipo as FacturaTipo,
      monto: Number(form.monto),
      periodo: form.periodo,
      fecha_emision: new Date().toISOString().split('T')[0],
      vencimiento: form.vencimiento,
      descripcion: form.descripcion || null,
      estado: 'pendiente',
    })

    setEnviando(false)

    if (error) {
      const msg = error.code === '23505'
        ? `Ya existe una factura de ${LABEL_FACTURA_TIPO[form.tipo as FacturaTipo]} para el período ${form.periodo} en este residente.`
        : error.message
      mostrarToast('error', msg)
    } else {
      mostrarToast('success', `Factura emitida correctamente por ${formatearMonto(Number(form.monto))}.`)
      setForm(CAMPOS_VACÍOS)
    }
  }

  async function handleLote() {
    if (!validar()) { setModalLote(false); return }
    setModalLote(false)
    setEnviando(true)

    const { data, error } = await supabase.rpc('emitir_facturas_lote', {
      p_tipo:        form.tipo,
      p_monto:       Number(form.monto),
      p_periodo:     form.periodo,
      p_vencimiento: form.vencimiento,
      p_descripcion: form.descripcion || null,
    })

    setEnviando(false)

    if (error) {
      mostrarToast('error', error.message)
    } else {
      const emitidas = (data as { emitidas: number })?.emitidas ?? 0
      mostrarToast('success', `Se emitieron ${emitidas} factura${emitidas !== 1 ? 's' : ''} correctamente.`)
      setForm(CAMPOS_VACÍOS)
    }
  }

  return (
    <>
      <div className="flex gap-1 p-1 bg-warm-100 rounded-xl w-fit mb-6 animate-fade-in">
        {(['individual', 'lote'] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setModo(m); setErroresForm({}) }}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              modo === m ? 'bg-white text-primary-700 shadow-sm' : 'text-warm-400 hover:text-primary-700'
            }`}
          >
            {m === 'individual' ? 'Emisión individual' : 'Emisión por lote'}
          </button>
        ))}
      </div>

      <div className="bg-white border border-warm-200 rounded-xl p-6 sm:p-8 max-w-2xl animate-fade-in">
        {modo === 'lote' && (
          <div className="flex items-start gap-3 mb-6 p-4 bg-accent-50 border border-accent-200 rounded-lg">
            <svg className="w-5 h-5 text-accent-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-accent-800">
              <strong>Emisión por lote:</strong> se emitirá esta factura a los{' '}
              <strong>{residentes.length}</strong> residente{residentes.length !== 1 ? 's' : ''} activo{residentes.length !== 1 ? 's' : ''} en una sola transacción.
              Si alguno ya tiene esa factura del mismo período, toda la operación se cancelará.
            </p>
          </div>
        )}

        <form onSubmit={modo === 'individual' ? handleIndividual : e => { e.preventDefault(); if (validar()) setModalLote(true) }} noValidate>
          <div className="space-y-5">
            {modo === 'individual' && (
              <Campo label="Residente" error={erroresForm.residente_id}>
                <select
                  id="f-residente"
                  value={form.residente_id}
                  onChange={e => setCampo('residente_id', e.target.value)}
                  disabled={loadingRes}
                  className={selectClass(!!erroresForm.residente_id)}
                >
                  <option value="">{loadingRes ? 'Cargando residentes…' : '— Selecciona un residente —'}</option>
                  {residentes.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.apellido}, {r.nombre} · Depto {r.departamento} (Piso {r.piso})
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo label="Tipo de factura" error={erroresForm.tipo}>
              <select
                id="f-tipo"
                value={form.tipo}
                onChange={e => setCampo('tipo', e.target.value as FacturaTipo | '')}
                className={selectClass(!!erroresForm.tipo)}
              >
                <option value="">— Selecciona un tipo —</option>
                {TIPOS_FACTURA.map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-warm-400">
                Las facturas de <strong>Tienda</strong> no se emiten a mano: se generan
                automáticamente al cerrar el periodo en{' '}
                <Link to="/admin/pedidos" className="text-primary-600 hover:text-primary-800 font-medium underline">
                  Pedidos
                </Link>.
              </p>
            </Campo>

            <Campo label="Monto ($)" error={erroresForm.monto}>
              <input
                id="f-monto"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.monto}
                onChange={e => setCampo('monto', e.target.value)}
                className={inputClass(!!erroresForm.monto)}
              />
            </Campo>

            <Campo label="Período (YYYY-MM)" error={erroresForm.periodo}>
              <input
                id="f-periodo"
                type="month"
                value={form.periodo}
                onChange={e => setCampo('periodo', e.target.value)}
                className={inputClass(!!erroresForm.periodo)}
              />
            </Campo>

            <Campo label="Fecha de vencimiento" error={erroresForm.vencimiento}>
              <input
                id="f-vencimiento"
                type="date"
                value={form.vencimiento}
                onChange={e => setCampo('vencimiento', e.target.value)}
                className={inputClass(!!erroresForm.vencimiento)}
              />
              <p className="mt-1 text-xs text-warm-400">
                Autocompletado al último día del período seleccionado.
              </p>
            </Campo>

            <Campo label="Descripción (opcional)" error={undefined}>
              <textarea
                id="f-descripcion"
                rows={2}
                placeholder="Notas adicionales para el residente…"
                value={form.descripcion}
                onChange={e => setCampo('descripcion', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
            </Campo>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="submit"
              disabled={enviando}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {enviando && (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {enviando ? 'Emitiendo…' : modo === 'individual' ? 'Emitir factura' : `Emitir a todos (${residentes.length})`}
            </button>
          </div>
        </form>
      </div>

      {modalLote && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in" aria-hidden="true" onClick={() => setModalLote(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-accent-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="font-display text-lg font-semibold text-primary-900">Confirmar emisión por lote</h2>
              </div>
              <p className="text-sm text-warm-500 mb-5">
                Se emitirán <strong>{residentes.length} factura{residentes.length !== 1 ? 's' : ''}</strong> de{' '}
                <strong>{form.tipo ? LABEL_FACTURA_TIPO[form.tipo as FacturaTipo] : '—'}</strong> por{' '}
                <strong>{formatearMonto(Number(form.monto))}</strong> para el período <strong>{form.periodo}</strong> a todos los residentes activos.
                Esta operación no se puede deshacer individualmente.
              </p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setModalLote(false)} className="px-4 py-2 text-sm font-medium text-warm-500 hover:text-primary-700 transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={handleLote} className="px-5 py-2 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer shadow-sm">
                  Sí, emitir {residentes.length} factura{residentes.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in text-white transition-all ${toast.tipo === 'error' ? 'bg-error' : 'bg-success'}`}>
          {toast.tipo === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}
    </>
  )
}

// ─── Sub-componentes de UI ─────────────────────────────────────────────────

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-900 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return `w-full h-10 px-3 rounded-lg border text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors ${
    hasError ? 'border-error focus:ring-error/40' : 'border-warm-300'
  }`
}

function selectClass(hasError: boolean) {
  return `w-full h-10 px-3 rounded-lg border text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer transition-colors ${
    hasError ? 'border-error focus:ring-error/40' : 'border-warm-300'
  }`
}
