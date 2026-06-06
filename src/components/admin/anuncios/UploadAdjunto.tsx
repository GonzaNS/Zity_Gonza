// Sprint 12 · HU-ANUNCIO-02 — Selector + preview del adjunto de un anuncio.
//
// Acepta imagen (JPEG/PNG, preview) o documento (PDF, ícono + nombre), ≤ 2 MB.
// Reusa el patrón de UploadFoto del S3/S10 (validación + preview + quitar),
// generalizado para admitir PDF. La validación canónica vive en lib/anuncios.

import { useEffect, useMemo, useRef, useState } from 'react'
import { validarAdjunto, ANUNCIO_ADJUNTO_MIME_PERMITIDOS } from '../../../lib/anuncios'

type Props = {
  archivo: File | null
  onCambio: (archivo: File | null) => void
  /** URL firmada del adjunto actual (edición). */
  adjuntoActualUrl?: string | null
  /** ¿El adjunto actual es un PDF? (para mostrar ícono en vez de imagen). */
  adjuntoActualEsPdf?: boolean
  disabled?: boolean
}

export default function UploadAdjunto({
  archivo, onCambio, adjuntoActualUrl, adjuntoActualEsPdf, disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [errorLocal, setErrorLocal] = useState<string | null>(null)

  const esImagenNueva = !!archivo && archivo.type.startsWith('image/')
  const preview = useMemo(
    () => (esImagenNueva && archivo ? URL.createObjectURL(archivo) : null),
    [esImagenNueva, archivo],
  )

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const validacion = validarAdjunto(file)
    if (!validacion.ok) {
      setErrorLocal(validacion.mensaje)
      onCambio(null)
      return
    }
    setErrorLocal(null)
    onCambio(file)
  }

  function handleQuitar() {
    setErrorLocal(null)
    onCambio(null)
  }

  const mostrarActual = !archivo && !!adjuntoActualUrl
  const esPdfNuevo = !!archivo && archivo.type === 'application/pdf'

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ANUNCIO_ADJUNTO_MIME_PERMITIDOS.join(',')}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        aria-label="Subir imagen o PDF del anuncio"
      />

      {preview ? (
        // ── Imagen nueva seleccionada ───────────────────────────────────────
        <div className="relative rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
          <img src={preview} alt="Vista previa del adjunto" className="w-full h-48 object-cover" />
          <AccionesAdjunto archivo={archivo} disabled={disabled}
            onCambiar={() => inputRef.current?.click()} onQuitar={handleQuitar} />
        </div>
      ) : esPdfNuevo ? (
        // ── PDF nuevo seleccionado ──────────────────────────────────────────
        <div className="relative rounded-lg border border-warm-200 bg-warm-50 p-4 flex items-center gap-3">
          <IconoPdf />
          <span className="text-sm text-primary-800 truncate flex-1">{archivo?.name}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-warm-300 text-primary-700 hover:bg-white transition-colors cursor-pointer disabled:opacity-50">
              Cambiar
            </button>
            <button type="button" onClick={handleQuitar} disabled={disabled}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-error/80 hover:bg-error text-white transition-colors cursor-pointer disabled:opacity-50">
              Quitar
            </button>
          </div>
        </div>
      ) : mostrarActual ? (
        // ── Adjunto actual (edición) ────────────────────────────────────────
        <div className="relative rounded-lg overflow-hidden border border-warm-200 bg-warm-50">
          {adjuntoActualEsPdf ? (
            <div className="p-4 flex items-center gap-3">
              <IconoPdf />
              <a href={adjuntoActualUrl!} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary-700 underline flex-1 truncate">Ver PDF actual</a>
            </div>
          ) : (
            <img src={adjuntoActualUrl!} alt="Adjunto actual" className="w-full h-48 object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 flex justify-end">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors cursor-pointer disabled:opacity-50">
              Cambiar
            </button>
          </div>
        </div>
      ) : (
        // ── Estado vacío ────────────────────────────────────────────────────
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="w-full border-2 border-dashed border-warm-300 rounded-lg px-4 py-6 flex flex-col items-center gap-2 hover:border-primary-400 hover:bg-warm-50 transition-colors cursor-pointer disabled:opacity-50"
        >
          <svg className="w-8 h-8 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-medium text-primary-800">Subir imagen o PDF</span>
          <span className="text-xs text-warm-400">JPEG, PNG o PDF · máx. 2 MB</span>
        </button>
      )}

      {errorLocal && <p className="mt-2 text-xs text-error" role="alert">{errorLocal}</p>}
    </div>
  )
}

function AccionesAdjunto({ archivo, disabled, onCambiar, onQuitar }: {
  archivo: File | null; disabled?: boolean; onCambiar: () => void; onQuitar: () => void
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 flex items-center justify-between gap-2">
      <span className="text-xs text-white/90 truncate max-w-[55%]">{archivo?.name}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCambiar} disabled={disabled}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors cursor-pointer disabled:opacity-50">
          Cambiar
        </button>
        <button type="button" onClick={onQuitar} disabled={disabled}
          className="text-xs font-medium px-3 py-1.5 rounded-md bg-error/80 hover:bg-error text-white transition-colors cursor-pointer disabled:opacity-50">
          Quitar
        </button>
      </div>
    </div>
  )
}

function IconoPdf() {
  return (
    <span className="shrink-0 w-10 h-10 rounded-lg bg-error/10 text-error flex items-center justify-center">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </span>
  )
}
