import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { formatearMes } from '../../lib/metricas'
import { formatearMoneda } from '../../lib/metricasFinanzas'
import type { TendenciaVenta, TopProducto } from '../../lib/metricasTienda'

// Paleta Zity consistente con la aplicación
const ZITY = {
  primary:   '#1b3a4b',   // primary-600 (azul Oxford)
  primary300:'#81b1c3',   // primary-300
  primary400:'#5797af',   // primary-400
  accent:    '#d4a043',   // accent-500 (warm gold)
  accent300: '#ebcc7a',   // accent-300
  warm200:   '#ebe7dd',
  warm400:   '#b8b0a0',
  textLight: '#b8b0a0',   // warm-400
}

interface GraficaTendenciaTiendaProps {
  datos: TendenciaVenta[]
  loading?: boolean
}

export const GraficaTendenciaTienda: React.FC<GraficaTendenciaTiendaProps> = ({ datos, loading }) => {
  const datosChart = (datos ?? []).map(d => ({
    ...d,
    mesLabel: formatearMes(d.mes),
    ventas: Number(d.total_ventas)
  }))

  if (loading) {
    return (
      <div className="h-[240px] flex items-center justify-center">
        <div className="animate-pulse w-full h-full bg-warm-100/60 rounded-lg" />
      </div>
    )
  }

  if (datosChart.length === 0) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-warm-400 italic">
        Sin datos de ventas en los últimos 6 meses
      </div>
    )
  }

  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={datosChart}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ZITY.primary} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={ZITY.primary} stopOpacity={0}/>
            </linearGradient>
          </defs>
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
            tickFormatter={(v: number) => formatearMoneda(v)}
            width={75}
          />
          <Tooltip
            content={(props) => {
              if (!props.active || !props.payload || props.payload.length === 0) return null
              const p = props.payload[0]
              if (!p) return null
              const dataObj = p.payload
              if (!dataObj) return null
              return (
                <div className="bg-white border border-warm-200 rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
                  <p className="font-semibold text-primary-900 mb-1">{props.label}</p>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ZITY.primary }} />
                    <span className="text-warm-400 flex-1">Ventas:</span>
                    <span className="font-semibold text-primary-900">{formatearMoneda(Number(p.value))}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: ZITY.accent }} />
                    <span className="text-warm-400 flex-1">Pedidos:</span>
                    <span className="font-semibold text-primary-900">{dataObj.total_pedidos}</span>
                  </div>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="ventas"
            name="Ventas"
            stroke={ZITY.primary}
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorVentas)"
            dot={{ fill: ZITY.primary, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

interface GraficaTopProductosProps {
  datos: TopProducto[]
  loading?: boolean
}

export const GraficaTopProductos: React.FC<GraficaTopProductosProps> = ({ datos, loading }) => {
  const coloresCat = [ZITY.primary, ZITY.primary400, ZITY.primary300, ZITY.accent, ZITY.accent300]
  const listado = datos ?? []
  const maxCantidad = listado.length > 0 ? Math.max(...listado.map(d => d.cantidad)) : 0

  if (loading) {
    return (
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
    )
  }

  if (listado.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-warm-400 text-sm italic">
        Sin ventas registradas en este periodo
      </div>
    )
  }

  return (
    <ol className="space-y-4">
      {listado.map((d, i) => {
        const pct = maxCantidad > 0 ? (d.cantidad / maxCantidad) * 100 : 0
        return (
          <li key={d.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[0.6rem] font-bold text-white shrink-0"
                  style={{ background: coloresCat[i % coloresCat.length] }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-primary-800 truncate" title={d.name}>
                  {d.name}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 shrink-0 ml-3">
                <span className="text-sm font-semibold text-primary-900" title="Unidades vendidas">
                  {d.cantidad} ud.
                </span>
                <span className="text-xs text-warm-400">
                  ({formatearMoneda(Number(d.value))})
                </span>
              </div>
            </div>
            <div className="h-2 w-full bg-warm-100/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: coloresCat[i % coloresCat.length],
                }}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
