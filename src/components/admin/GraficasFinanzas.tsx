import React from 'react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { formatearMoneda, calcularPorcentajeCobranza } from '../../lib/metricasFinanzas'
import type { IngresoPorTipo, RatioCobranza } from '../../lib/metricasFinanzas'

// Colores consistentes por tipo de servicio
const COLORES_TIPO: Record<string, string> = {
  luz: '#eab308',      // yellow-500
  agua: '#3b82f6',     // blue-500
  pension: '#10b981',  // emerald-500
  multa: '#ef4444',    // red-500
  default: '#8b5cf6'   // violet-500
}

interface GraficaIngresosTipoProps {
  datos: IngresoPorTipo[]
  loading?: boolean
}

// Tooltip del PieChart. Definido a nivel de módulo (no dentro del componente) para
// no recrear el componente en cada render (react-hooks/static-components).
interface IngresosTooltipProps {
  active?: boolean
  payload?: Array<{ payload: { nombreLabel: string; value: number } }>
}

const CustomTooltip = ({ active, payload }: IngresosTooltipProps) => {
  const data = payload?.[0]?.payload
  if (!active || !data) return null
  return (
    <div className="bg-white border border-warm-200 p-3 rounded shadow-lg text-sm">
      <p className="font-semibold text-primary-900 mb-1">{data.nombreLabel}</p>
      <p className="text-primary-700">{formatearMoneda(data.value)}</p>
    </div>
  )
}

export const GraficaIngresosTipo: React.FC<GraficaIngresosTipoProps> = ({ datos, loading }) => {
  if (loading) return null

  if (!datos || datos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-warm-400 italic">
        No hay datos de ingresos pagados en este periodo
      </div>
    )
  }

  // Capitalizar nombres para la leyenda
  const datosFormat = datos.map(d => ({
    ...d,
    nombreLabel: d.name.charAt(0).toUpperCase() + d.name.slice(1)
  }))

  return (
    <div className="h-full min-h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={datosFormat}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            nameKey="nombreLabel"
          >
            {datosFormat.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORES_TIPO[entry.name.toLowerCase()] || COLORES_TIPO.default} 
                stroke="transparent"
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            iconType="circle"
            wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

interface TarjetaRatioCobranzaProps {
  ratio: RatioCobranza
  loading?: boolean
}

export const TarjetaRatioCobranza: React.FC<TarjetaRatioCobranzaProps> = ({ ratio, loading }) => {
  if (loading) return null

  const { cobrado, pendiente } = ratio
  const total = cobrado + pendiente
  const porcentajeCobrado = calcularPorcentajeCobranza(cobrado, pendiente)
  const porcentajePendiente = total > 0 ? 100 - porcentajeCobrado : 0

  return (
    <div className="flex flex-col h-full justify-center">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-warm-500">Cobrado</span>
        <span className="text-lg font-bold text-success">{formatearMoneda(cobrado)}</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm font-medium text-warm-500">Pendiente</span>
        <span className="text-lg font-bold text-accent-600">{formatearMoneda(pendiente)}</span>
      </div>

      <div className="mb-2">
        <div className="flex justify-between text-xs font-semibold mb-1">
          <span className="text-success">{porcentajeCobrado.toFixed(1)}% Cobrado</span>
          <span className="text-accent-600">{porcentajePendiente.toFixed(1)}% Pend.</span>
        </div>
        <div className="h-3 w-full bg-warm-100 rounded-full overflow-hidden flex">
          <div 
            className="h-full bg-success transition-all duration-500 ease-out" 
            style={{ width: `${porcentajeCobrado}%` }}
          />
          <div 
            className="h-full bg-accent-500 transition-all duration-500 ease-out" 
            style={{ width: `${porcentajePendiente}%` }}
          />
        </div>
      </div>
      <div className="text-center mt-4 border-t border-warm-100 pt-3">
        <p className="text-xs text-warm-400 uppercase tracking-wider">Total Facturado</p>
        <p className="text-xl font-display font-semibold text-primary-900 mt-0.5">
          {formatearMoneda(total)}
        </p>
      </div>
    </div>
  )
}
