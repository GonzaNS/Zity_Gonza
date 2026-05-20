// HU-MANT-05 SPRINT-4
// Componente reutilizable de línea de tiempo vertical para el historial de
// estados de una solicitud. Usado en:
//   - DrawerSolicitud (admin)
//   - DrawerDetalleTecnico (técnico)
//   - DrawerDetalleSolicitudResidente (residente)
//
// Características:
//   - Badge de color por estado (línea de tiempo vertical)
//   - Autor con privacidad según rol del observador
//   - Fecha relativa con tooltip de fecha absoluta
//   - Nota del cambio si la hay
//   - Paginación con botón "Ver más"
//   - Estado vacío y estado de carga

import { useState } from 'react'
import { useHistorialEstados } from '../../hooks/useHistorialEstados'
import { tiempoTranscurrido } from '../../lib/format'
import { extraerFotoDeNota, BUCKET_FOTOS } from '../../lib/solicitudes'
import { supabase } from '../../lib/supabase'
import { parsearNotaCierre } from '../../hooks/useSolicitudesTecnico'
import FotosCierrePanel from '../tecnico/solicitudes/FotosCierrePanel'
import type { Rol } from '../../types/database'

// Sprint 5 · PBI-S4-E04 — Sufijo `[foto: path]` que el residente añade al
// rechazar con foto. Lo extraemos para renderizar un botón aparte y mostrar
// la nota limpia.
function notaSinFoto(nota: string | null): string | null {
  if (!nota) return null
  return nota.replace(/\s*\[foto: [^\]]+\]\s*$/, '').trim() || null
}

// ─── Config de badges por estado ─────────────────────────────────────────────

// HU-MANT-05 SPRINT-4 — Colores del badge de la línea de tiempo por estado
const BADGE_ESTADO: Record<string, { dot: string; text: string; label: string }> = {
  pendiente: { dot: 'bg-accent-400', text: 'text-accent-700', label: 'Pendiente' },
  asignada: { dot: 'bg-primary-400', text: 'text-primary-700', label: 'Asignada' },
  en_progreso: { dot: 'bg-primary-600', text: 'text-primary-800', label: 'En progreso' },
  resuelta: { dot: 'bg-success', text: 'text-success', label: 'Resuelta' },
  cerrada: { dot: 'bg-warm-400', text: 'text-warm-500', label: 'Cerrada' },
}

function badgePara(estado: string) {
  return BADGE_ESTADO[estado] ?? { dot: 'bg-warm-300', text: 'text-warm-500', label: estado }
}

// ─── Lógica de privacidad de autor ───────────────────────────────────────────

/**
 * HU-MANT-05 SPRINT-4
 * Devuelve la etiqueta del autor según el rol del observador:
 *   - Admin: nombre completo de todos
 *   - Residente: 'Tú', 'Admin', 'Técnico Mario P.'
 *   - Técnico: 'Tú', 'Admin', 'Residente Laura V.'
 *   - null (sistema): 'Sistema'
 */
function etiquetaAutor(
  autor: { nombre: string; apellido: string; rol: Rol } | null,
  cambiado_por: string | null,
  rolObservador: Rol,
  userId: string,
): string {
  if (!autor || !cambiado_por) return 'Sistema'

  // Es el propio usuario
  if (cambiado_por === userId) return 'Tú'

  const inicial = autor.apellido.trim()[0]?.toUpperCase() ?? ''

  if (rolObservador === 'admin') {
    // Admin ve nombre completo
    const rolLabel: Record<Rol, string> = { admin: 'Admin', tecnico: 'Técnico', residente: 'Residente' }
    return `${rolLabel[autor.rol]} ${autor.nombre} ${autor.apellido}`
  }

  if (rolObservador === 'residente') {
    if (autor.rol === 'admin') return 'Admin'
    if (autor.rol === 'tecnico') return `Técnico ${autor.nombre} ${inicial}.`
    return `Residente ${autor.nombre} ${inicial}.`
  }

  // Técnico
  if (autor.rol === 'admin') return 'Admin'
  if (autor.rol === 'residente') return `Residente ${autor.nombre} ${inicial}.`
  return `Técnico ${autor.nombre} ${inicial}.`
}

function fechaAbsoluta(iso: string): string {
  try {
    return new Intl.DateTimeFormat('es', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  solicitudId: string
  rolObservador: Rol
  userId: string
  fotoOriginalUrl?: string
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function HistorialEstados({ solicitudId, rolObservador, userId, fotoOriginalUrl }: Props) {
  // HU-MANT-05 SPRINT-4 — Hook con paginación y embed de autor
  const {
    entradas,
    loading,
    loadingMore,
    error,
    hayMas,
    cargarMas,
  } = useHistorialEstados(solicitudId)

  // ── Estado de carga inicial ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="w-4 h-4 border-2 border-warm-200 border-t-primary-500 rounded-full animate-spin" />
        <p className="text-xs text-warm-400">Cargando historial…</p>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <p className="text-xs text-error py-2">{error}</p>
    )
  }

  // ── Estado vacío ─────────────────────────────────────────────────────────
  // HU-MANT-05 SPRINT-4 — Mensaje cuando no hay cambios registrados
  if (entradas.length === 0) {
    return (
      <p className="text-xs text-warm-400 py-2">Sin cambios de estado registrados.</p>
    )
  }

  // ── Línea de tiempo ──────────────────────────────────────────────────────
  return (
    <div>
      <ol className="relative space-y-0">
        {entradas.map((h, idx) => {
          const bdgNuevo = badgePara(h.estado_nuevo)
          const bdgAnterior = h.estado_anterior ? badgePara(h.estado_anterior) : null
          const esUltimo = idx === entradas.length - 1 && !hayMas
          const autorLabel = etiquetaAutor(h.autor, h.cambiado_por, rolObservador, userId)

          return (
            <li key={h.id} className="flex gap-3 pb-4 relative">
              {/* Línea vertical conectora */}
              {!esUltimo && (
                <div className="absolute left-[5px] top-3 bottom-0 w-px bg-warm-200" />
              )}

              {/* Dot de estado */}
              {/* HU-MANT-05 SPRINT-4 — Badge coloreado por estado nuevo */}
              <div className={`shrink-0 mt-1 w-3 h-3 rounded-full border-2 border-white ring-1 ring-warm-200 z-10 ${bdgNuevo.dot}`} />

              {/* Contenido */}
              <div className="min-w-0 flex-1 pt-0.5">

                {/* Transición de estado */}
                <p className="text-sm text-primary-900 leading-snug flex items-center gap-1.5 flex-wrap">
                  {bdgAnterior ? (
                    <>
                      <span className={`text-xs font-semibold capitalize ${bdgAnterior.text}`}>
                        {bdgAnterior.label}
                      </span>
                      <svg className="w-3 h-3 text-warm-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className={`text-xs font-semibold capitalize ${bdgNuevo.text}`}>
                        {bdgNuevo.label}
                      </span>
                    </>
                  ) : (
                    <span className={`text-xs font-semibold capitalize ${bdgNuevo.text}`}>
                      {bdgNuevo.label}
                    </span>
                  )}
                </p>

                {/* Autor y fecha */}
                {/* HU-MANT-05 SPRINT-4 — Autor con privacidad + tooltip fecha absoluta */}
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[0.6875rem] text-warm-500 font-medium">
                    {autorLabel}
                  </span>
                  <span className="text-warm-300 text-[0.6875rem]">·</span>
                  <span
                    className="text-[0.6875rem] text-warm-400 cursor-default"
                    title={fechaAbsoluta(h.created_at)}
                  >
                    {tiempoTranscurrido(h.created_at)}
                  </span>
                </div>

                {/* Nota del cambio (+ foto opcional Sprint 5 PBI-S4-E04) */}
                {h.nota && (() => {
                  const { texto: notaParseada, pathFoto: pathFotoCierre } = parsearNotaCierre(h.nota)
                  const fotoPath = extraerFotoDeNota(notaParseada)
                  const notaLimpia = notaSinFoto(notaParseada)
                  
                  if (!notaLimpia && !fotoPath && !pathFotoCierre) return null
                  
                  return (
                    <div className="mt-1.5 space-y-1.5">
                      {(notaLimpia || fotoPath) && (
                        <div className="bg-warm-50 border border-warm-200 rounded-md px-2.5 py-1.5 space-y-1.5">
                          {notaLimpia && (
                            <p className="text-xs text-primary-700 leading-relaxed">{notaLimpia}</p>
                          )}
                          {fotoPath && <FotoRechazoBoton path={fotoPath} />}
                        </div>
                      )}
                      
                      {pathFotoCierre && (
                        <FotosCierrePanel 
                          pathFotoCierre={pathFotoCierre} 
                          fotoOriginalUrl={fotoOriginalUrl} 
                        />
                      )}
                    </div>
                  )
                })()}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Botón "Ver más" */}
      {/* HU-MANT-05 SPRINT-4 — Paginación bajo demanda */}
      {hayMas && (
        <button
          type="button"
          onClick={cargarMas}
          disabled={loadingMore}
          className="mt-1 flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loadingMore ? (
            <>
              <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
              Cargando…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Ver más
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Sprint 5 · PBI-S4-E04 · Botón "Ver foto" del rechazo ───────────────────
// Genera una URL firmada (TTL corto) al hacer click y la abre en una pestaña
// nueva. No pre-carga la URL para no consumir requests por cada historial.

function FotoRechazoBoton({ path }: { path: string }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir() {
    setCargando(true)
    setError(null)
    const { data, error: signError } = await supabase
      .storage
      .from(BUCKET_FOTOS)
      .createSignedUrl(path, 60 * 5) // 5 minutos
    setCargando(false)
    if (signError || !data) {
      setError('No se pudo cargar la foto.')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      <button
        type="button"
        onClick={abrir}
        disabled={cargando}
        className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-800 font-medium cursor-pointer disabled:opacity-50"
      >
        {cargando ? (
          <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        )}
        Ver foto del rechazo
      </button>
      {error && <p className="text-xs text-error mt-1">{error}</p>}
    </div>
  )
}
