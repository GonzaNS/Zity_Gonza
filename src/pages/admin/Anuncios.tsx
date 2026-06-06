// Sprint 12 · HU-ANUNCIO-02 — Gestión del tablón de anuncios (admin).
// Ruta: /admin/anuncios
//
// Lista los comunicados (vigentes, vencidos y archivados), permite alta/edición
// con adjunto, fijar/desfijar y la baja lógica (archivar) / restauración. La
// sanitización del contenido (A03) y la auditoría son automáticas (triggers BD).

import { useState } from 'react'
import AdminShell from '../../components/admin/AdminShell'
import { useAnunciosAdmin, archivarAnuncio, fijarAnuncio } from '../../hooks/useAnunciosAdmin'
import TablaAnuncios from '../../components/admin/anuncios/TablaAnuncios'
import AnuncioFormModal from '../../components/admin/anuncios/AnuncioFormModal'
import type { Anuncio } from '../../lib/anuncios'

type Toast = { tipo: 'success' | 'error'; msg: string } | null
/** Estado del modal: null (cerrado) · 'nuevo' (alta) · Anuncio (edición). */
type ModalState = null | 'nuevo' | Anuncio

export default function AdminAnuncios() {
  const { anuncios, adjuntos, loading, error, recargar } = useAnunciosAdmin()
  const [modal, setModal] = useState<ModalState>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)

  function mostrarToast(tipo: 'success' | 'error', msg: string) {
    setToast({ tipo, msg })
    setTimeout(() => setToast(null), 4500)
  }

  function handleGuardado(mensaje: string) {
    setModal(null)
    mostrarToast('success', mensaje)
    recargar()
  }

  async function handleArchivar(a: Anuncio) {
    setProcesandoId(a.id)
    const res = await archivarAnuncio(a.id, !a.archivado)
    setProcesandoId(null)
    if (!res.ok) { mostrarToast('error', res.error); return }
    mostrarToast('success', a.archivado ? `"${a.titulo}" restaurado.` : `"${a.titulo}" archivado.`)
    recargar()
  }

  async function handleFijar(a: Anuncio) {
    setProcesandoId(a.id)
    const res = await fijarAnuncio(a.id, !a.fijado)
    setProcesandoId(null)
    if (!res.ok) { mostrarToast('error', res.error); return }
    mostrarToast('success', a.fijado ? `"${a.titulo}" desfijado.` : `"${a.titulo}" fijado arriba.`)
    recargar()
  }

  const anuncioEditando = modal !== null && modal !== 'nuevo' ? modal : null
  const adjuntoActualUrl =
    anuncioEditando?.imagen_url ? adjuntos.get(anuncioEditando.imagen_url) ?? null : null

  const vigentes = anuncios.filter(a => !a.archivado).length

  return (
    <AdminShell
      title="Anuncios"
      subtitle="Publica comunicados del edificio: categoría, prioridad, imagen, fijar y vigencia."
      actions={
        <button
          type="button"
          onClick={() => setModal('nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo comunicado
        </button>
      }
    >
      {error && (
        <div className="mb-5 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : anuncios.length === 0 ? (
        <div className="bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
          <p className="font-medium text-primary-900">Aún no hay comunicados</p>
          <p className="text-sm text-warm-400 mt-1">Publica el primero con el botón “Nuevo comunicado”.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-warm-400 mb-4">
            {anuncios.length} comunicado{anuncios.length !== 1 ? 's' : ''} · {vigentes} en el tablón
          </p>
          <TablaAnuncios
            anuncios={anuncios}
            adjuntos={adjuntos}
            onEditar={setModal}
            onArchivar={handleArchivar}
            onFijar={handleFijar}
            procesandoId={procesandoId}
          />
        </>
      )}

      {modal !== null && (
        <AnuncioFormModal
          anuncio={anuncioEditando}
          adjuntoActualUrl={adjuntoActualUrl}
          onClose={() => setModal(null)}
          onGuardado={handleGuardado}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in text-white ${
            toast.tipo === 'error' ? 'bg-error' : 'bg-success'
          }`}
        >
          {toast.tipo === 'success' ? '✓ ' : '✗ '}{toast.msg}
        </div>
      )}
    </AdminShell>
  )
}
