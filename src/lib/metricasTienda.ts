// Tipos y utilidades para las métricas de la tienda (HU-EJEC-04)

export interface TopProducto {
  name: string
  cantidad: number
  value: number // ingresos generados (cantidad * precio_unitario)
}

export interface TendenciaVenta {
  mes: string
  total_ventas: number
  total_pedidos: number
}

export interface MetricasTienda {
  periodo: string
  ingresos_mes: number
  top_productos: TopProducto[]
  tendencia: TendenciaVenta[]
}
