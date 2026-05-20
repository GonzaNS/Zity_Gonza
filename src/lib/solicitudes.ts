import { supabase } from './supabase'
import { logAuditAction, type AccionAudit } from './audit'
import type {
  TipoSolicitud,
  CategoriaSolicitud,
  EstadoSolicitud,
} from '../types/database'

// Catálogo de tipos y categorías compartido entre formulario y filtros del admin.
// Si se cambia, actualizar los CHECK constraints en la BD para mantenerlos
// alineados con el dominio de valores aquí.

export const TIPOS_SOLICITUD: Array<{ value: TipoSolicitud; label: string }> = [
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'reparacion', label: 'Reparación' },
  { value: 'queja', label: 'Queja' },
  { value: 'sugerencia', label: 'Sugerencia' },
  { value: 'otro', label: 'Otro' },
]

export const CATEGORIAS_SOLICITUD: Array<{ value: CategoriaSolicitud; label: string }> = [
  { value: 'plomeria', label: 'Plomería' },
  { value: 'electricidad', label: 'Electricidad' },
  { value: 'limpieza', label: 'Limpieza' },
  { value: 'seguridad', label: 'Seguridad' },
  { value: 'areas_comunes', label: 'Áreas comunes' },
  { value: 'otro', label: 'Otro' },
]

// Categorías filtradas por tipo: el formulario rehúsa la lista al cambiar el
// tipo para que sólo se ofrezcan combinaciones razonables. La BD acepta
// cualquier (tipo, categoría) válida individualmente.
const CATEGORIAS_POR_TIPO: Record<TipoSolicitud, CategoriaSolicitud[]> = {
  mantenimiento: ['plomeria', 'electricidad', 'limpieza', 'seguridad', 'areas_comunes', 'otro'],
  reparacion: ['plomeria', 'electricidad', 'areas_comunes', 'otro'],
  queja: ['limpieza', 'seguridad', 'areas_comunes', 'otro'],
  sugerencia: ['areas_comunes', 'otro'],
  otro: ['otro'],
}

export function categoriasParaTipo(tipo: TipoSolicitud): Array<{ value: CategoriaSolicitud; label: string }> {
  const valoresPermitidos = CATEGORIAS_POR_TIPO[tipo]
  return CATEGORIAS_SOLICITUD.filter(c => valoresPermitidos.includes(c.value))
}

export function labelTipo(tipo: TipoSolicitud): string {
  return TIPOS_SOLICITUD.find(t => t.value === tipo)?.label ?? tipo
}

export function labelCategoria(categoria: CategoriaSolicitud): string {
  return CATEGORIAS_SOLICITUD.find(c => c.value === categoria)?.label ?? categoria
}

export const PRIORIDADES = ['normal', 'urgente'] as const
export type Prioridad = (typeof PRIORIDADES)[number]

export const ESTADOS = ['pendiente', 'asignada', 'en_progreso', 'resuelta', 'cerrada'] as const

export const DESCRIPCION_MAX = 300
export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024
export const IMAGEN_MIME_PERMITIDOS = ['image/jpeg', 'image/png']
export const BUCKET_FOTOS = 'solicitudes-fotos'

export type ValidacionImagen = { ok: true } | { ok: false; mensaje: string }

export function validarImagen(file: File): ValidacionImagen {
  if (!IMAGEN_MIME_PERMITIDOS.includes(file.type)) {
    return { ok: false, mensaje: 'Formato no soportado. Usa JPEG o PNG.' }
  }
  if (file.size > IMAGEN_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, mensaje: `La imagen pesa ${mb} MB. Máximo permitido: 5 MB.` }
  }
  return { ok: true }
}

// Construye el path de almacenamiento determinístico: residente/solicitud/timestamp_nombre.
// El primer segmento (residente) es lo que las storage policies validan contra
// auth.uid() para evitar que un residente suba a la carpeta de otro.
export function pathFotoSolicitud(residenteId: string, solicitudId: string, file: File): string {
  const timestamp = Date.now()
  const nombreSeguro = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto'
  return `${residenteId}/${solicitudId}/${timestamp}_${nombreSeguro}`
}

// Sprint 5 · PBI-S4-E04 — Path para foto del rechazo del residente.
// Comparte el bucket `solicitudes-fotos` y respeta las storage policies
// (primer segmento = residente_id). Se diferencia con prefijo `rechazo_`
// en el nombre del archivo para distinguirla de la foto del problema.
export function pathFotoRechazo(residenteId: string, solicitudId: string, file: File): string {
  const timestamp = Date.now()
  const nombreSeguro = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'foto'
  return `${residenteId}/${solicitudId}/rechazo_${timestamp}_${nombreSeguro}`
}

// Sprint 5 · PBI-S4-E04 — Sufijo que se añade a historial_estados.nota cuando
// el residente adjunta foto al rechazar. Convención simple: la vista de
// detalle lo detecta y renderiza un botón "Ver foto" que abre URL firmada.
// Formato: " [foto: <path>]" al final de la nota.
export const FOTO_RECHAZO_PREFIJO = '[foto: '

export function appendFotoARechazo(nota: string, path: string): string {
  return `${nota} ${FOTO_RECHAZO_PREFIJO}${path}]`
}

/** Extrae el path de foto adjunto a una nota de rechazo, si lo hay. */
export function extraerFotoDeNota(nota: string | null | undefined): string | null {
  if (!nota) return null
  const match = nota.match(/\[foto: ([^\]]+)\]/)
  return match?.[1] ?? null
}

// =============================================================================
// Helper centralizado de cambio de estado
// =============================================================================
// Sprint 4 — Toda transición de estado de una solicitud debe pasar por esta
// función. Garantiza que las 3 escrituras (UPDATE solicitudes, INSERT
// historial_estados, INSERT audit_log) se ejecutan de forma uniforme, con la
// misma forma de error y los mismos campos de auditoría.
//
// Diseño:
//   1. UPDATE solicitudes.estado (+ camposExtraSolicitud) — si falla, abortamos.
//   2. INSERT historial_estados — si falla devolvemos error explícito; el
//      estado ya cambió, así que el llamador debe alertar al usuario.
//   3. INSERT audit_log — fire-and-forget: el cambio de estado y el historial
//      ya están escritos; un fallo aquí degrada la observabilidad pero no
//      bloquea la operación. La RLS exige usuario_id = auth.uid() y
//      resultado ∈ {exitoso, fallido}.

export type CambioEstadoInput = {
  /** UUID de la solicitud a modificar */
  solicitudId: string
  /** Estado actual (usado para historial_estados.estado_anterior) */
  estadoAnterior: EstadoSolicitud
  /** Estado destino (UPDATE solicitudes.estado) */
  estadoNuevo: EstadoSolicitud
  /** Texto que se guarda en historial_estados.nota; null si no aplica */
  nota: string | null
  /** UUID del usuario que dispara el cambio (auth.uid()) */
  usuarioId: string
  /**
   * Acción a registrar en audit_log.accion. Tipado contra el catálogo
   * cerrado de auditoría (Sprint 5).
   */
  accionAudit: AccionAudit
  /** Detalles JSON adicionales para audit_log.detalles */
  detallesAudit?: Record<string, unknown>
  /**
   * Campos adicionales a incluir en el UPDATE de solicitudes. Útil para
   * HU-MANT-07 (confirmada_por_residente, intentos_resolucion). Si está vacío,
   * solo se actualiza `estado`.
   */
  camposExtraSolicitud?: Record<string, unknown>
}

export type ResultadoCambioEstado =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Sprint 4 — Helper centralizado de transición de estado para solicitudes.
 *
 * Encapsula el patrón de 3 escrituras (estado + historial + audit) que se
 * repetía en useAsignarTecnico, useActualizarEstadoTecnico y
 * useConfirmarSolicitud. Devuelve un Result discriminado para que el llamador
 * pueda mostrar mensajes precisos al usuario.
 *
 * Reglas de fallo:
 *   - Si UPDATE solicitudes falla → { ok: false }. Nada se escribe.
 *   - Si INSERT historial falla → { ok: false } pero el estado YA cambió.
 *     El llamador debe informarlo al usuario para que pueda reintentar la
 *     escritura del historial manualmente si fuera necesario.
 *   - Si INSERT audit_log falla → ignoramos el error (fire-and-forget).
 */
export async function cambiarEstadoSolicitud(
  input: CambioEstadoInput,
): Promise<ResultadoCambioEstado> {
  const {
    solicitudId,
    estadoAnterior,
    estadoNuevo,
    nota,
    usuarioId,
    accionAudit,
    detallesAudit,
    camposExtraSolicitud,
  } = input

  // 1) UPDATE solicitudes.estado (+ campos extra)
  const updatePayload: Record<string, unknown> = {
    estado: estadoNuevo,
    ...(camposExtraSolicitud ?? {}),
  }

  const { error: errorUpdate } = await supabase
    .from('solicitudes')
    .update(updatePayload)
    .eq('id', solicitudId)

  if (errorUpdate) {
    return { ok: false, error: errorUpdate.message }
  }

  // 2) INSERT historial_estados — fallo aquí significa que el estado cambió
  //    pero no quedó registrado. Reportamos para que el usuario reintente.
  const { error: errorHistorial } = await supabase
    .from('historial_estados')
    .insert({
      solicitud_id: solicitudId,
      estado_anterior: estadoAnterior,
      estado_nuevo: estadoNuevo,
      cambiado_por: usuarioId,
      nota: nota?.trim() || null,
    })

  if (errorHistorial) {
    return {
      ok: false,
      error: `Estado actualizado, pero no se pudo registrar en el historial: ${errorHistorial.message}`,
    }
  }

  // 3) Audit log via helper centralizado (Sprint 5 refactor)
  //    fire-and-forget — el helper loguea internamente si falla.
  await logAuditAction(
    {
      accion: accionAudit,
      entidad: 'solicitudes',
      entidadId: solicitudId,
      detalles: {
        estado_anterior: estadoAnterior,
        estado_nuevo: estadoNuevo,
        ...(detallesAudit ?? {}),
      },
    },
    usuarioId,
  )

  // 4) Notificaciones PBI-12 — Simulación frontend del trigger after_solicitud_estado_changed
  // Consultamos el residente asociado a esta solicitud
  const { data: solData } = await supabase
    .from('solicitudes')
    .select('residente_id, codigo')
    .eq('id', solicitudId)
    .single()

  if (solData?.residente_id) {
    const titulos: Record<string, string> = {
      asignada: 'Solicitud asignada a técnico',
      en_progreso: 'Solicitud en progreso',
      resuelta: 'Solución reportada por técnico',
      cerrada: 'Solicitud cerrada',
    }
    
    if (titulos[estadoNuevo]) {
      await supabase.from('notificaciones').insert({
        usuario_id: solData.residente_id,
        solicitud_id: solicitudId,
        tipo: 'estado_cambio',
        titulo: titulos[estadoNuevo],
        mensaje: `Tu solicitud ${solData.codigo || ''} ha cambiado su estado a: ${estadoNuevo.replace('_', ' ')}.`,
        leida: false
      })

      // PBI-12 — Invocar Edge Function de email en modo fire-and-forget
      if (supabase.functions) {
        void supabase.functions.invoke('notificar-cambio-estado', {
          body: {
            solicitud_id: solicitudId,
            estado_nuevo: estadoNuevo,
            cambiado_por: usuarioId,
          },
        }).catch(err => {
          console.warn('[PBI-12] Error al disparar Edge Function de email:', err)
        })
      }
    }
  }

  return { ok: true }
}
