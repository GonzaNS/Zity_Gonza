import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import RangoDeFechas from '../shared/RangoDeFechas'

export default function PopoverExportarCSV() {
  const [abierto, setAbierto] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const popoverRef = useRef<HTMLDivElement>(null)

  // Cerrar si se hace clic afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    if (abierto) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [abierto])

  const handleDescargar = async () => {
    if (!fechaDesde || !fechaHasta) {
      setError('Por favor selecciona ambas fechas.')
      return
    }
    
    // Validación de fechas extra
    const dDesde = new Date(fechaDesde)
    const dHasta = new Date(fechaHasta)
    if (dDesde > dHasta) {
      setError('Rango de fechas inválido.')
      return
    }

    setDescargando(true)
    setError(null)

    try {
      // El modificador .csv() le dice a PostgREST que devuelva los datos directamente en formato CSV,
      // logrando un rendimiento altísimo en la serialización "server-side".
      const { data, error: rpcError } = await supabase
        .rpc('export_solicitudes_csv', { f_inicio: fechaDesde, f_fin: fechaHasta })
        .csv()

      if (rpcError) throw rpcError
      if (!data) throw new Error('No se encontraron registros o no se pudo generar el archivo.')

      // Agregar BOM (Byte Order Mark) para que Excel detecte correctamente UTF-8
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + data], { type: 'text/csv;charset=utf-8;' })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `solicitudes_${fechaDesde}_${fechaHasta}.csv`)
      document.body.appendChild(link)
      link.click()
      
      // Limpieza
      link.parentNode?.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      setAbierto(false)
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error && err.message ? err.message : 'Ocurrió un error de conexión con la base de datos al exportar.'
      setError(msg)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setAbierto(p => !p)}
        className="h-9 px-3 flex items-center gap-1.5 text-sm font-medium text-primary-700 bg-white border border-warm-200 rounded-lg hover:bg-warm-50 hover:border-primary-300 transition-all cursor-pointer shadow-sm active:scale-95"
        title="Exportar registros a CSV para Excel"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Exportar CSV
      </button>

      {abierto && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border border-warm-200 rounded-xl shadow-lg z-50 p-4 sm:p-5 animate-fade-in origin-top-right">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-primary-900">Exportar solicitudes</h3>
            <p className="text-xs text-warm-400 mt-0.5 leading-relaxed">
              Descarga un archivo CSV compatible con Excel con los registros del rango seleccionado.
            </p>
          </div>

          <div className="mb-4">
            <RangoDeFechas
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              onChangeDesde={setFechaDesde}
              onChangeHasta={setFechaHasta}
            />
          </div>

          {error && (
            <p className="text-xs text-error bg-error/10 border border-error/20 p-2 rounded-lg mb-4 leading-relaxed">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="px-3 py-1.5 text-xs font-semibold text-warm-500 hover:text-primary-700 transition-colors cursor-pointer"
              disabled={descargando}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDescargar}
              disabled={descargando}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
            >
              {descargando && (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {descargando ? 'Generando...' : 'Descargar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
