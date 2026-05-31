// Sprint 10 · HU-TIENDA-02 — Gestión del catálogo de la tienda (admin).
// Ruta: /admin/tienda
//
// Lista los productos (activos e inactivos), permite alta/edición con foto y la
// baja lógica / reactivación. La auditoría es automática (trigger en BD).

import { useState } from 'react'
import AdminShell from '../../components/admin/AdminShell'
import { useTiendaAdmin, cambiarActivoProducto } from '../../hooks/useTiendaAdmin'
import TablaProductos from '../../components/admin/tienda/TablaProductos'
import ProductoFormModal from '../../components/admin/tienda/ProductoFormModal'
import type { Producto } from '../../lib/tienda'

type Toast = { tipo: 'success' | 'error'; msg: string } | null
/** Estado del modal: null (cerrado) · 'nuevo' (alta) · Producto (edición). */
type ModalState = null | 'nuevo' | Producto

export default function AdminTienda() {
  const { productos, fotos, loading, error, recargar } = useTiendaAdmin()
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

  async function handleCambiarActivo(p: Producto) {
    setProcesandoId(p.id)
    const res = await cambiarActivoProducto(p.id, !p.activo)
    setProcesandoId(null)
    if (!res.ok) { mostrarToast('error', res.error); return }
    mostrarToast('success', p.activo ? `"${p.nombre}" dado de baja.` : `"${p.nombre}" reactivado.`)
    recargar()
  }

  const productoEditando = modal !== null && modal !== 'nuevo' ? modal : null
  const fotoActualUrl =
    productoEditando?.imagen_url ? fotos.get(productoEditando.imagen_url) ?? null : null

  const activos = productos.filter(p => p.activo).length

  return (
    <AdminShell
      title="Tienda"
      subtitle="Gestiona el catálogo: alta, precio, stock, foto y baja de productos."
      actions={
        <button
          type="button"
          onClick={() => setModal('nuevo')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nuevo producto
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
      ) : productos.length === 0 ? (
        <div className="bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
          <p className="font-medium text-primary-900">Aún no hay productos</p>
          <p className="text-sm text-warm-400 mt-1">Crea el primero con el botón “Nuevo producto”.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-warm-400 mb-4">
            {productos.length} producto{productos.length !== 1 ? 's' : ''} · {activos} activo{activos !== 1 ? 's' : ''}
          </p>
          <TablaProductos
            productos={productos}
            fotos={fotos}
            onEditar={setModal}
            onCambiarActivo={handleCambiarActivo}
            procesandoId={procesandoId}
          />
        </>
      )}

      {modal !== null && (
        <ProductoFormModal
          producto={productoEditando}
          fotoActualUrl={fotoActualUrl}
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
