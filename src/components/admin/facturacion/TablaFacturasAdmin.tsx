// Sprint 9 · HU-FACT-04/06 — Tabla de facturas en /admin/facturacion.
// Click en una fila abre el drawer de detalle (con la acción "Marcar como pagada").
// El badge de estado usa rojo para las vencidas (HU-FACT-06).

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

export default function TablaFacturasAdmin({ facturas, onSeleccionar }: Props) {
  return (
    <div className="bg-white border border-warm-200 rounded-xl overflow-hidden animate-fade-in">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-warm-50 border-b border-warm-200 text-left text-xs font-semibold text-warm-500 uppercase tracking-wide">
              <th className="px-4 py-3">Residente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">N° factura</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3">Vence</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-warm-100">
            {facturas.map(f => {
              const estadoVisual = estaVencida(f) && f.estado === 'pendiente' ? 'vencida' : f.estado
              return (
                <tr
                  key={f.id}
                  onClick={() => onSeleccionar(f)}
                  className="hover:bg-warm-50 focus:outline-none focus-visible:bg-warm-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400 cursor-pointer transition-colors"
                  tabIndex={0}
                  role="button"
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccionar(f) } }}
                >
                  <td className="px-4 py-3">
                    {f.residente ? (
                      <div>
                        <p className="font-medium text-primary-900">{f.residente.apellido}, {f.residente.nombre}</p>
                        <p className="text-xs text-warm-400">Depto {f.residente.departamento} · Piso {f.residente.piso}</p>
                      </div>
                    ) : (
                      <span className="text-warm-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-primary-800">{LABEL_FACTURA_TIPO[f.tipo]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-warm-500">{f.numero ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-primary-900">{formatearMonto(f.monto)}</td>
                  <td className={`px-4 py-3 ${estadoVisual === 'vencida' ? 'text-error font-medium' : 'text-warm-500'}`}>
                    {formatearFechaCorta(f.vencimiento)}
                  </td>
                  <td className="px-4 py-3">
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
    </div>
  )
}
