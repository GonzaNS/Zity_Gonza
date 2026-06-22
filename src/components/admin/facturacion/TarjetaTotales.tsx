// Sprint 9 · PBI-S8-E02 — Tarjeta de totales del periodo en /admin/facturacion.
// Los montos se suman 100% en el servidor (RPC totales_facturacion); aquí solo
// se formatean y muestran. Selector de mes para cambiar el periodo consultado.
//
// Fix post Sprint 13/14 — Versión compacta (menos alto) para que la tabla quede
// más arriba y se reduzca el scroll de la página.

import { formatearMonto, formatearPeriodo, type TotalesPeriodo } from '../../../lib/facturas'

type Props = {
  totales: TotalesPeriodo | null
  periodo: string
  onPeriodoChange: (periodo: string) => void
  loading?: boolean
}

const METRICAS: {
  clave: keyof TotalesPeriodo
  label: string
  clases: string
  puntoColor: string
}[] = [
  { clave: 'emitido',   label: 'Emitido',   clases: 'text-primary-900', puntoColor: 'bg-primary-400' },
  { clave: 'cobrado',   label: 'Cobrado',   clases: 'text-success',     puntoColor: 'bg-success' },
  { clave: 'pendiente', label: 'Pendiente', clases: 'text-accent-700',  puntoColor: 'bg-accent-500' },
  { clave: 'vencido',   label: 'Vencido',   clases: 'text-error',       puntoColor: 'bg-error' },
]

export default function TarjetaTotales({ totales, periodo, onPeriodoChange, loading }: Props) {
  return (
    <div className="bg-white border border-warm-200 rounded-xl p-4 sm:p-5 mb-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <h2 className="font-display text-base sm:text-lg font-semibold text-primary-900">
          Totales · <span className="text-warm-400 font-normal">{formatearPeriodo(periodo)}</span>
        </h2>
        <label className="flex items-center gap-2 text-sm text-warm-500 shrink-0">
          <span className="hidden sm:inline text-xs uppercase tracking-wide">Periodo</span>
          <input
            type="month"
            value={periodo}
            onChange={e => onPeriodoChange(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
            aria-label="Seleccionar periodo"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {METRICAS.map(m => (
          <div key={m.clave} className="rounded-lg border border-warm-100 bg-warm-50/60 px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${m.puntoColor}`} />
              <span className="text-[0.6875rem] font-medium text-warm-500 uppercase tracking-wide">{m.label}</span>
            </div>
            <p className={`font-display text-lg sm:text-xl font-bold leading-tight mt-0.5 tabular-nums ${m.clases}`}>
              {loading || !totales ? '—' : formatearMonto(totales[m.clave])}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
