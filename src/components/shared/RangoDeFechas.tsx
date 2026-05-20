// Componente de selección de rango de fechas con validación integrada.

type Props = {
  fechaDesde: string
  fechaHasta: string
  onChangeDesde: (val: string) => void
  onChangeHasta: (val: string) => void
}

export default function RangoDeFechas({ fechaDesde, fechaHasta, onChangeDesde, onChangeHasta }: Props) {
  let error: string | null = null

  if (fechaDesde && fechaHasta) {
    const desde = new Date(fechaDesde)
    const hasta = new Date(fechaHasta)
    const diffTime = Math.abs(hasta.getTime() - desde.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (desde > hasta) {
      error = 'La fecha "Desde" no puede ser mayor que "Hasta".'
    } else if (diffDays > 90) {
      error = 'El rango máximo permitido es de 90 días.'
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <div className="flex-1">
        <label htmlFor="f-desde" className="block text-xs font-medium text-primary-900 mb-1">
          Desde
        </label>
        <input
          id="f-desde"
          type="date"
          value={fechaDesde}
          onChange={e => onChangeDesde(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>
      <div className="flex-1">
        <label htmlFor="f-hasta" className="block text-xs font-medium text-primary-900 mb-1">
          Hasta
        </label>
        <input
          id="f-hasta"
          type="date"
          value={fechaHasta}
          onChange={e => onChangeHasta(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
      </div>
      {error && (
        <p className="w-full sm:w-auto text-xs text-error mt-1 sm:mt-0 sm:self-center">
          {error}
        </p>
      )}
    </div>
  )
}
