// Sprint 12 · HU-ANUNCIO-02 — Modal de alta / edición de un comunicado.
//
// Orquesta el guardado: en alta crea el anuncio y luego sube el adjunto a su
// carpeta ({id}/...); en edición actualiza campos (+ adjunto si se cambió). El
// cuerpo admite markdown limitado con vista previa segura (MarkdownSeguro); la
// sanitización real (A03) y la auditoría las hace la BD (triggers).

import { useRef, useState } from 'react'
import { useModalBehavior } from '../../../hooks/useModalBehavior'
import { useFocusTrap } from '../../../hooks/useFocusTrap'
import {
  CATEGORIAS_ANUNCIO,
  PRIORIDADES_ANUNCIO,
  esPdf,
  TITULO_MAX,
  CUERPO_MAX,
  type Anuncio,
  type AnuncioCategoria,
  type AnuncioPrioridad,
  type AnuncioInsert,
} from '../../../lib/anuncios'
import {
  crearAnuncio,
  actualizarAnuncio,
  subirAdjuntoAnuncio,
} from '../../../hooks/useAnunciosAdmin'
import UploadAdjunto from './UploadAdjunto'
import MarkdownSeguro from '../../shared/MarkdownSeguro'

type Props = {
  /** null = alta; un anuncio = edición. */
  anuncio: Anuncio | null
  /** URL firmada del adjunto actual (edición). */
  adjuntoActualUrl?: string | null
  onClose: () => void
  onGuardado: (mensaje: string) => void
}

type Campos = {
  titulo: string
  cuerpo: string
  categoria: AnuncioCategoria
  prioridad: AnuncioPrioridad
  fijado: boolean
  vigente_hasta: string
}

export default function AnuncioFormModal({ anuncio, adjuntoActualUrl, onClose, onGuardado }: Props) {
  const esEdicion = !!anuncio

  const [campos, setCampos] = useState<Campos>(() => ({
    titulo:        anuncio?.titulo ?? '',
    cuerpo:        anuncio?.cuerpo ?? '',
    categoria:     anuncio?.categoria ?? 'general',
    prioridad:     anuncio?.prioridad ?? 'normal',
    fijado:        anuncio?.fijado ?? false,
    vigente_hasta: anuncio?.vigente_hasta ?? '',
  }))
  const [adjuntoNuevo, setAdjuntoNuevo] = useState<File | null>(null)
  const [verPreview, setVerPreview] = useState(false)
  const [errores, setErrores] = useState<Partial<Record<keyof Campos, string>>>({})
  const [enviando, setEnviando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)

  useModalBehavior(onClose, enviando)
  const panelRef = useRef<HTMLElement>(null)
  useFocusTrap(panelRef)

  function setCampo<K extends keyof Campos>(k: K, v: Campos[K]) {
    setCampos(prev => ({ ...prev, [k]: v }))
    setErrores(prev => ({ ...prev, [k]: undefined }))
  }

  function validar(): boolean {
    const errs: Partial<Record<keyof Campos, string>> = {}
    if (!campos.titulo.trim()) errs.titulo = 'El título es obligatorio.'
    if (!campos.cuerpo.trim()) errs.cuerpo = 'El cuerpo es obligatorio.'
    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    if (!validar()) return
    setEnviando(true)
    setErrorGeneral(null)

    const datos: AnuncioInsert = {
      titulo:        campos.titulo.trim(),
      cuerpo:        campos.cuerpo.trim(),
      categoria:     campos.categoria,
      prioridad:     campos.prioridad,
      fijado:        campos.fijado,
      vigente_hasta: campos.vigente_hasta || null,
    }

    // 1. Alta o edición de los campos base.
    let anuncioId = anuncio?.id
    if (!esEdicion) {
      const res = await crearAnuncio(datos)
      if (!res.ok) { setEnviando(false); setErrorGeneral(res.error); return }
      anuncioId = res.id
    }

    // 2. Subir adjunto nuevo (si lo hay) a la carpeta del anuncio.
    let adjuntoPath: string | undefined
    if (adjuntoNuevo && anuncioId) {
      const up = await subirAdjuntoAnuncio(adjuntoNuevo, anuncioId)
      if (!up.ok) {
        setEnviando(false)
        setErrorGeneral(
          esEdicion
            ? `No se pudo subir el adjunto: ${up.error}`
            : `Anuncio creado, pero el adjunto falló: ${up.error}. Edítalo para reintentar.`,
        )
        return
      }
      adjuntoPath = up.path
    }

    // 3. Persistir campos (edición) y/o el path del adjunto.
    if (esEdicion && anuncioId) {
      const res = await actualizarAnuncio(anuncioId, {
        ...datos,
        ...(adjuntoPath ? { imagen_url: adjuntoPath } : {}),
      })
      if (!res.ok) { setEnviando(false); setErrorGeneral(res.error); return }
    } else if (!esEdicion && adjuntoPath && anuncioId) {
      await actualizarAnuncio(anuncioId, { imagen_url: adjuntoPath })
    }

    setEnviando(false)
    onGuardado(esEdicion ? 'Comunicado actualizado.' : 'Comunicado publicado.')
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={() => { if (!enviando) onClose() }}
      />
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={esEdicion ? 'Editar comunicado' : 'Nuevo comunicado'}
          className="bg-white rounded-2xl shadow-2xl max-w-xl w-full my-8 animate-fade-in"
        >
          <form onSubmit={handleGuardar} noValidate>
            <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-warm-100">
              <h2 className="font-display text-lg font-semibold text-primary-900">
                {esEdicion ? 'Editar comunicado' : 'Nuevo comunicado'}
              </h2>
              <button
                type="button"
                onClick={() => { if (!enviando) onClose() }}
                className="text-warm-400 hover:text-primary-700 transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <Campo label="Título" error={errores.titulo}>
                <input
                  type="text"
                  value={campos.titulo}
                  onChange={e => setCampo('titulo', e.target.value)}
                  placeholder="Ej: Corte de agua programado"
                  maxLength={TITULO_MAX}
                  className={inputClass(!!errores.titulo)}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-4">
                <Campo label="Categoría">
                  <select
                    value={campos.categoria}
                    onChange={e => setCampo('categoria', e.target.value as AnuncioCategoria)}
                    className={selectClass()}
                  >
                    {CATEGORIAS_ANUNCIO.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Campo>
                <Campo label="Prioridad">
                  <select
                    value={campos.prioridad}
                    onChange={e => setCampo('prioridad', e.target.value as AnuncioPrioridad)}
                    className={selectClass()}
                  >
                    {PRIORIDADES_ANUNCIO.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </Campo>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-primary-900">Cuerpo</label>
                  <button
                    type="button"
                    onClick={() => setVerPreview(v => !v)}
                    className="text-xs font-medium text-primary-600 hover:text-primary-800 cursor-pointer"
                  >
                    {verPreview ? '✎ Escribir' : '👁 Vista previa'}
                  </button>
                </div>
                {verPreview ? (
                  <div className="min-h-[8rem] px-3 py-2 rounded-lg border border-warm-200 bg-warm-50 text-sm text-primary-900">
                    {campos.cuerpo.trim()
                      ? <MarkdownSeguro>{campos.cuerpo}</MarkdownSeguro>
                      : <p className="text-warm-400 italic">Nada que previsualizar…</p>}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={campos.cuerpo}
                    onChange={e => setCampo('cuerpo', e.target.value)}
                    placeholder="Escribe el comunicado. Admite **negrita**, *cursiva*, listas y [enlaces](https://…)."
                    maxLength={CUERPO_MAX}
                    className={`w-full px-3 py-2 rounded-lg border text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y ${
                      errores.cuerpo ? 'border-error focus:ring-error/40' : 'border-warm-300'
                    }`}
                  />
                )}
                {errores.cuerpo && <p className="mt-1 text-xs text-error">{errores.cuerpo}</p>}
                <p className="mt-1 text-xs text-warm-400">
                  Markdown limitado. El HTML se neutraliza por seguridad.
                </p>
              </div>

              <Campo label="Imagen o PDF (opcional)">
                <UploadAdjunto
                  archivo={adjuntoNuevo}
                  onCambio={setAdjuntoNuevo}
                  adjuntoActualUrl={adjuntoActualUrl}
                  adjuntoActualEsPdf={esPdf(anuncio?.imagen_url)}
                  disabled={enviando}
                />
              </Campo>

              <div className="grid grid-cols-2 gap-4 items-start">
                <Campo label="Vigente hasta (opcional)">
                  <input
                    type="date"
                    value={campos.vigente_hasta}
                    onChange={e => setCampo('vigente_hasta', e.target.value)}
                    className={inputClass(false)}
                  />
                </Campo>
                <div className="pt-7">
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={campos.fijado}
                      onChange={e => setCampo('fijado', e.target.checked)}
                      className="w-4 h-4 rounded border-warm-300 text-primary-600 focus:ring-primary-400 cursor-pointer"
                    />
                    <span className="text-sm text-primary-900">Fijar arriba del tablón</span>
                  </label>
                </div>
              </div>

              {errorGeneral && <p className="text-sm text-error" role="alert">{errorGeneral}</p>}
            </div>

            <div className="flex gap-3 justify-end px-6 py-5 border-t border-warm-100">
              <button
                type="button"
                onClick={() => { if (!enviando) onClose() }}
                disabled={enviando}
                className="px-4 py-2 text-sm font-medium text-warm-500 hover:text-primary-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
              >
                {enviando && (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {enviando ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Publicar comunicado'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  )
}

function Campo({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-primary-900 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  )
}

function inputClass(hasError: boolean) {
  return `w-full h-10 px-3 rounded-lg border text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 transition-colors ${
    hasError ? 'border-error focus:ring-error/40' : 'border-warm-300'
  }`
}

function selectClass() {
  return 'w-full h-10 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer transition-colors'
}
