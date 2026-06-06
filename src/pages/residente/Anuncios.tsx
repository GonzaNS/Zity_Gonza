// Sprint 12 · HU-ANUNCIO-03 + Mejora — Tablón de anuncios para el residente.
// Ruta: /residente/anuncios
//
// Feed de comunicados vigentes (la RLS filtra archivados/vencidos) con los
// fijados arriba, badge 'Nuevo' por no leído, filtro por categoría y detalle en
// un panel lateral. Abrir el detalle registra la lectura (anuncio_lecturas).

import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ResidenteHeader from '../../components/residente/ResidenteHeader'
import { useAnunciosResidente } from '../../hooks/useAnunciosResidente'
import {
  filtrarPorCategoria,
  CATEGORIAS_ANUNCIO,
  type AnuncioConLectura,
  type FiltroCategoriaAnuncio,
} from '../../lib/anuncios'
import CardAnuncio from '../../components/residente/anuncios/CardAnuncio'
import DrawerAnuncio from '../../components/residente/anuncios/DrawerAnuncio'

const FILTROS: Array<{ value: FiltroCategoriaAnuncio; label: string }> = [
  { value: 'todas', label: 'Todas' },
  ...CATEGORIAS_ANUNCIO,
]

export default function ResidenteAnuncios() {
  const { user } = useAuth()
  const { anuncios, adjuntos, loading, error, marcarLeido } = useAnunciosResidente(user?.id)
  const [filtro, setFiltro] = useState<FiltroCategoriaAnuncio>('todas')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)

  const visibles = filtrarPorCategoria(anuncios, filtro)
  const noLeidos = anuncios.filter(a => !a.leido).length

  async function abrir(a: AnuncioConLectura) {
    setSeleccionadoId(a.id)
    if (!a.leido) await marcarLeido(a.id)
  }

  // El detalle refleja siempre el estado más reciente del feed.
  const detalle = seleccionadoId ? anuncios.find(a => a.id === seleccionadoId) ?? null : null
  const detalleAdjunto = detalle?.imagen_url ? adjuntos.get(detalle.imagen_url) : undefined

  return (
    <div className="min-h-screen bg-warm-50">
      <ResidenteHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Tablón de anuncios
          </h2>
          <p className="mt-1 text-warm-400 text-sm">
            Comunicados oficiales del edificio
            {noLeidos > 0 && <> · <span className="text-primary-700 font-medium">{noLeidos} sin leer</span></>}
          </p>
        </div>

        {/* Filtro por categoría */}
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTROS.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFiltro(f.value)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                filtro === f.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-primary-700 border-warm-200 hover:border-primary-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="mt-6 bg-white rounded-xl border border-warm-200 p-10 sm:p-14 text-center animate-fade-in">
            <div className="w-14 h-14 rounded-full bg-warm-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-warm-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </div>
            <p className="text-primary-800 font-medium">
              {filtro === 'todas' ? 'Aún no hay comunicados' : 'No hay comunicados en esta categoría'}
            </p>
            <p className="text-sm text-warm-400 mt-1">Aquí verás los avisos que publique la administración.</p>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-fade-in">
            {visibles.map(a => (
              <CardAnuncio
                key={a.id}
                anuncio={a}
                adjuntoUrl={a.imagen_url ? adjuntos.get(a.imagen_url) : undefined}
                onAbrir={abrir}
              />
            ))}
          </ul>
        )}
      </main>

      {detalle && (
        <DrawerAnuncio
          anuncio={detalle}
          adjuntoUrl={detalleAdjunto}
          onCerrar={() => setSeleccionadoId(null)}
        />
      )}
    </div>
  )
}
