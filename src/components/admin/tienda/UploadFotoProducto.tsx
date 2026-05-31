// Sprint 10 · HU-TIENDA-02 — Selección + preview + validación de la foto del
// producto. Reusa el patrón de UploadFoto (S4) con la validación de 2 MB del
// módulo Tienda. En modo edición muestra la foto ya guardada (URL firmada) y
// permite reemplazarla.

import { useEffect, useMemo, useRef, useState } from 'react'
import { validarImagenProducto, PRODUCTO_IMAGEN_MIME_PERMITIDOS } from '../../../lib/tienda'

type Props = {
  /** Foto nueva seleccionada (aún sin subir). */
  archivo: File | null
  onCambio: (archivo: File | null) => void
  /** URL firmada de la foto ya guardada (modo edición). */
  fotoActualUrl?: string | null
  disabled?: boolean
}

export default function UploadFotoProducto({ archivo, onCambio, fotoActualUrl, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const previewNueva = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo])
  useEffect(() => {
    if (!previewNueva) return
    return () => URL.revokeObjectURL(previewNueva)
  }, [previewNueva])

  // Prioridad: foto nueva seleccionada → foto guardada → vacío (placeholder).
  const preview = previewNueva ?? fotoActualUrl ?? null
  const esNueva = !!previewNueva

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // permite re-seleccionar el mismo archivo
    if (!file) return

    const v = validarImagenProducto(file)
    if (!v.ok) {
      setErrorLocal(v.mensaje)
      onCambio(null)
      return
    }
    setErrorLocal(null)
    onCambio(file)
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={PRODUCTO_IMAGEN_MIME_PERMITIDOS.join(',')}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        aria-label="Subir foto del producto"
      />

      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
          <img src={preview} alt="Vista previa del producto" className="w-full h-44 sm:h-52 object-cover" />
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 flex items-center justify-between gap-2">
            <span className="text-xs text-white/90 truncate max-w-[55%]">
              {esNueva ? archivo?.name : 'Foto actual'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="text-xs font-medium px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cambiar
              </button>
              {esNueva && (
                <button
                  type="button"
                  onClick={() => { setErrorLocal(null); onCambio(null) }}
                  disabled={disabled}
                  className="text-xs font-medium px-3 py-1.5 rounded-md bg-error/80 hover:bg-error text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Descartar
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full border-2 border-dashed border-warm-300 rounded-lg px-4 py-6 sm:py-8 flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-primary-800">Subir foto del producto</span>
          <span className="text-xs text-warm-400">JPEG o PNG · máx. 2 MB</span>
        </button>
      )}

      {errorLocal && <p className="mt-2 text-xs text-error" role="alert">{errorLocal}</p>}
    </div>
  )
}
