// Sprint 10 · HU-TIENDA-05/06 + Mejora — Catálogo de la tienda para el residente.
// Ruta: /residente/tienda
//
// Grilla responsive de tarjetas (1 col móvil, 2 tablet, 3-4 desktop) con
// paginación lazy (24), filtros por categoría y disponibilidad, y búsqueda por
// nombre con debounce (300 ms). Badges de stock bajo/agotado en la tarjeta y
// detalle del producto con el botón "Agregar al carrito" deshabilitado (S11).

import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useTiendaResidente } from '../../hooks/useTiendaResidente'
import CardProducto from '../../components/residente/tienda/CardProducto'
import DetalleProductoModal from '../../components/residente/tienda/DetalleProductoModal'
import {
  CATEGORIAS_PRODUCTO,
  BUSQUEDA_DEBOUNCE_MS,
  type Producto,
  type FiltroCategoria,
  type FiltroDisponibilidad,
} from '../../lib/tienda'
import zityLogo from '../../assets/zity_logo.png'
import CampanaNotificaciones from '../../components/shared/CampanaNotificaciones'
import MiniCarrito from '../../components/residente/tienda/MiniCarrito'

const CATEGORIAS: Array<{ value: FiltroCategoria; label: string }> = [
  { value: 'todas', label: 'Todas' },
  ...CATEGORIAS_PRODUCTO,
]

const DISPONIBILIDAD: Array<{ value: FiltroDisponibilidad; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'en_stock', label: 'En stock' },
  { value: 'agotado', label: 'Agotado' },
]

export default function ResidenteTienda() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [categoria, setCategoria] = useState<FiltroCategoria>('todas')
  const [disponibilidad, setDisponibilidad] = useState<FiltroDisponibilidad>('todas')
  const [busquedaInput, setBusquedaInput] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [seleccionado, setSeleccionado] = useState<Producto | null>(null)

  // Debounce de la búsqueda (HU-TIENDA-06): no dispara una query por cada tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(busquedaInput), BUSQUEDA_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [busquedaInput])

  const { productos, fotos, loading, loadingMore, error, hayMas, cargarMas } =
    useTiendaResidente({ categoria, disponibilidad, busqueda })

  // Scroll infinito: observa un centinela al final de la grilla.
  const centinelaRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = centinelaRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      entries => { if (entries[0]?.isIntersecting) cargarMas() },
      { rootMargin: '200px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [cargarMas])

  const hayFiltros = categoria !== 'todas' || disponibilidad !== 'todas' || busquedaInput !== ''

  function limpiar() {
    setCategoria('todas')
    setDisponibilidad('todas')
    setBusquedaInput('')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/residente" className="flex items-center gap-4">
            <img src={zityLogo} alt="Zity" className="h-9 w-auto" />
            <span className="text-xs font-semibold bg-accent-500 text-white px-2.5 py-1 rounded-full tracking-wider uppercase">
              Residente
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <CampanaNotificaciones />
            <MiniCarrito />
            <Link
              to="/residente/tienda/historial"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
            >
              Mis pedidos
            </Link>
            <Link
              to="/residente/facturas"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
            >
              Mis facturas
            </Link>
            <Link
              to="/perfil"
              className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
            >
              {profile?.nombre} {profile?.apellido}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Tienda del edificio
          </h2>
          <p className="mt-1 text-warm-400 text-sm">
            Explora el catálogo, arma tu carrito y confirma tu pedido.
          </p>
        </div>

        {/* Filtros + búsqueda */}
        <div className="mt-6 space-y-3 animate-fade-in">
          <div className="relative max-w-md">
            <svg className="w-4 h-4 text-warm-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              value={busquedaInput}
              onChange={e => setBusquedaInput(e.target.value)}
              placeholder="Buscar por nombre…"
              aria-label="Buscar productos por nombre"
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIAS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategoria(c.value)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer border ${
                  categoria === c.value
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-warm-500 border-warm-200 hover:border-primary-300 hover:text-primary-700'
                }`}
              >
                {c.label}
              </button>
            ))}

            <span className="mx-1 h-5 w-px bg-warm-200 hidden sm:inline-block" aria-hidden="true" />

            <select
              value={disponibilidad}
              onChange={e => setDisponibilidad(e.target.value as FiltroDisponibilidad)}
              aria-label="Filtrar por disponibilidad"
              className="h-9 px-3 rounded-full text-sm font-medium text-primary-700 bg-white border border-warm-200 focus:outline-none focus:ring-2 focus:ring-primary-400 cursor-pointer"
            >
              {DISPONIBILIDAD.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>

            {hayFiltros && (
              <button
                type="button"
                onClick={limpiar}
                className="px-3 py-1.5 rounded-full text-sm font-medium text-warm-500 hover:text-error transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
        )}

        {/* Grilla */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : productos.length === 0 ? (
          <div className="mt-8 bg-white border border-warm-200 rounded-xl p-10 sm:p-14 text-center animate-fade-in">
            <p className="font-medium text-primary-900">No se encontraron productos</p>
            <p className="text-sm text-warm-400 mt-1">
              {hayFiltros ? 'Prueba con otros filtros o limpia la búsqueda.' : 'El catálogo aún no tiene productos.'}
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
              {productos.map(p => (
                <CardProducto
                  key={p.id}
                  producto={p}
                  fotoUrl={p.imagen_url ? fotos.get(p.imagen_url) : null}
                  onClick={() => setSeleccionado(p)}
                />
              ))}
            </div>

            {/* Centinela de scroll infinito (solo si quedan más páginas) */}
            {hayMas && <div ref={centinelaRef} className="h-10" />}
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            )}
          </>
        )}
      </main>

      {seleccionado && (
        <DetalleProductoModal
          producto={seleccionado}
          fotoUrl={seleccionado.imagen_url ? fotos.get(seleccionado.imagen_url) : null}
          onClose={() => setSeleccionado(null)}
        />
      )}
    </div>
  )
}
