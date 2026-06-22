// Sprint 9 · HU-FACT-04/06 — Listado de facturas en /admin/facturacion.
// Click en una fila/tarjeta abre el drawer de detalle (con "Marcar como pagada").
// El badge de estado usa rojo para las vencidas (HU-FACT-06).
//
// Fix post Sprint 13/14 — Rediseño contra el scroll excesivo:
//   • Escritorio: tabla densa con cabecera STICKY y scroll contenido (max-h),
//     para no perder los encabezados ni empujar toda la página.
//   • Móvil: tarjetas compactas apiladas (sin scroll horizontal).
//   • La paginación vive en el panel padre; aquí solo se pinta la página actual.

import {
  LABEL_FACTURA_TIPO,
  LABEL_FACTURA_ESTADO,
  BADGE_FACTURA_ESTADO,
  formatearMonto,
  estaVencida,
} from '../../../lib/facturas'
import type { FacturaAdmin } from '../../../hooks/useFacturasAdmin'

type Props = {
  facturas: FacturaAdmin[]
  onSeleccionar: (factura: FacturaAdmin) => void
}

function formatearFechaCorta(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function estadoVisualDe(f: FacturaAdmin) {
  return estaVencida(f) && f.estado === 'pendiente' ? 'vencida' : f.estado
}

export default function TablaFacturasAdmin({ facturas, onSeleccionar }: Props) {
  return (
    <div className="bg-white border border-warm-200 rounded-xl overflow-hidden animate-fade-in">
      {/* ── Escritorio: tabla con cabecera sticky + scroll contenido ── */}
      <div className="hidden sm:block max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-warm-50 border-b border-warm-200 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide">
              <th className="px-4 py-3 bg-warm-50">Residente</th>
              <th className="px-4 py-3 bg-warm-50">Tipo</th>
              <th className="px-4 py-3 bg-warm-50">N° factura</th>
              <th className="px-4 py-3 bg-warm-50 text-right">Monto</th>
              <th className="px-4 py-3 bg-warm-50">Vence</th>
              <th className="px-4 py-3 bg-warm-50">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {facturas.map(f => {
              const estadoVisual = estadoVisualDe(f)
              return (
                <tr
                  key={f.id}
                  onClick={() => onSeleccionar(f)}
                  className="hover:bg-warm-50 focus:outline-none focus-visible:bg-warm-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 cursor-pointer transition-colors"
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionar(f) } }}
                >
                  <td className="px-4 py-2.5">
                    {f.residente ? (
                      <div>
                        <p className="font-medium text-primary-900">{f.residente.apellido}, {f.residente.nombre}</p>
                        <p className="text-xs text-warm-400">Depto {f.residente.departamento} · Piso {f.residente.piso}</p>
                      </div>
                    ) : (
                      <span className="text-warm-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-primary-800">{LABEL_FACTURA_TIPO[f.tipo]}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-warm-500">{f.numero ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-primary-900 tabular-nums">{formatearMonto(f.monto)}</td>
                  <td className={`px-4 py-2.5 whitespace-nowrap ${estadoVisual === 'vencida' ? 'text-error font-medium' : 'text-warm-500'}`}>
                    {formatearFechaCorta(f.vencimiento)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold border ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
                      {LABEL_FACTURA_ESTADO[estadoVisual]}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* ── Móvil: tarjetas compactas apiladas ── */}
      <ul className="sm:hidden divide-y divide-warm-100">
        {facturas.map(f => {
          const estadoVisual = estadoVisualDe(f)
          return (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => onSeleccionar(f)}
                className="w-full text-left px-4 py-3 hover:bg-warm-50 focus:outline-none focus-visible:bg-warm-100 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-primary-900 truncate">
                      {f.residente ? `${f.residente.apellido}, ${f.residente.nombre}` : '—'}
                    </p>
                    <p className="text-xs text-warm-400 mt-0.5">
                      {f.residente ? `Depto ${f.residente.departamento} · Piso ${f.residente.piso}` : ''}
                    </p>
                  </div>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[0.625rem] font-semibold border shrink-0 ${BADGE_FACTURA_ESTADO[estadoVisual]}`}>
                    {LABEL_FACTURA_ESTADO[estadoVisual]}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3 mt-2">
                  <div className="text-xs text-warm-500 min-w-0">
                    <span className="text-primary-800">{LABEL_FACTURA_TIPO[f.tipo]}</span>
                    {f.numero && <span className="font-mono text-warm-400"> · {f.numero}</span>}
                    <p className={`mt-0.5 ${estadoVisual === 'vencida' ? 'text-error font-medium' : 'text-warm-400'}`}>
                      Vence {formatearFechaCorta(f.vencimiento)}
                    </p>
                  </div>
                  <p className="font-semibold text-primary-900 tabular-nums shrink-0">{formatearMonto(f.monto)}</p>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
