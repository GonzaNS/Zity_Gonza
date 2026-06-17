// Sprint 5 · PBI-14 + Refactor de auditoría
// Helper centralizado para escribir entradas en `audit_log`.
//
// Reglas de uso:
//   • Toda escritura desde el frontend pasa por aquí. El code review rechaza
//     `supabase.from('audit_log').insert(...)` directos.
//   • El helper fija usuario_id = auth.uid() vía RLS WITH CHECK (la policy
//     `audit_insert_authenticated` añadida en Sprint 4 lo exige).
//   • `accion` y `entidad` son uniones cerradas. TypeScript impide registrar
//     valores fuera del catálogo. El catálogo debe coincidir con
//     /docs/audit.md.
//   • La inserción es fire-and-forget: si falla, se loguea en consola pero
//     NO bloquea la operación principal. La trazabilidad es deseable, no
//     crítica para el flujo del usuario final.

import { supabase } from './supabase'

// ─── Catálogo cerrado ────────────────────────────────────────────────────────

/** Acciones que el frontend (rol authenticated) puede registrar. */
export type AccionAudit =
  // Solicitudes — cambios de estado
  | 'asignar_solicitud'
  | 'actualizar_estado_solicitud'
  | 'confirmar_solicitud'
  | 'rechazar_solucion'
  | 'escalada_solicitud'
  // Usuarios — perfil propio (gestión administrativa va por Edge Functions
  // con service_role; no se loguean desde frontend)
  | 'editar_perfil'
  // Sprint 6 · PBI-S5-E03 — cambio de contraseña (sin payload por OWASP A02)
  | 'cambio_contrasena'
  // Sprint 13 · PBI-S6-E03 — gestión de sesiones activas
  | 'cerrar_sesiones'
  // Sprint 13 · HU-PAGO-02 — gestión de métodos de pago (sin datos sensibles)
  | 'alta_metodo_pago'
  | 'predeterminada_metodo_pago'
  | 'eliminar_metodo_pago'

/** Entidades sobre las que se audita desde el frontend authenticated. */
export type EntidadAudit =
  | 'solicitudes'
  | 'asignaciones'
  | 'usuarios'

/** Resultado de la acción auditada. */
export type ResultadoAudit = 'exitoso' | 'fallido'

// ─── Tipo del payload ────────────────────────────────────────────────────────

export type AuditEntry = {
  accion: AccionAudit
  entidad: EntidadAudit
  /** UUID de la fila afectada (solicitud, asignacion, perfil, …). */
  entidadId: string
  /**
   * Detalles JSON arbitrarios. Política no-PII: solo IDs, flags, valores de
   * estado o números. No incluir nombres, emails, teléfonos ni descripciones
   * libres. Ver /docs/audit.md y /docs/privacidad.md.
   */
  detalles?: Record<string, unknown>
  /** Por defecto 'exitoso'. Si la acción falló pero el audit es relevante igual, pasar 'fallido'. */
  resultado?: ResultadoAudit
}

// ─── Helper principal ────────────────────────────────────────────────────────

/**
 * Sprint 5 · PBI-14
 * Inserta una entrada en audit_log. Devuelve { ok } para el llamador que
 * quiera reportarlo en logs; el llamador NO debe propagar errores al usuario
 * — la auditoría es secundaria al flujo principal.
 *
 * El RLS (`audit_insert_authenticated`) exige que:
 *   - usuario_id = auth.uid() (el helper lo deja vacío, RLS lo materializa)
 *   - resultado ∈ {exitoso, fallido}
 *   - entidad ∈ {solicitudes, asignaciones, usuarios, invitaciones, notificaciones}
 *
 * @returns { ok: true } o { ok: false, error: string } — el llamador puede
 *          loguear el error pero no debe abortar su flujo principal.
 */
export async function logAuditAction(
  entry: AuditEntry,
  usuarioId: string,
): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    usuario_id: usuarioId,
    accion: entry.accion,
    entidad: entry.entidad,
    entidad_id: entry.entidadId,
    detalles: entry.detalles ?? {},
    resultado: entry.resultado ?? 'exitoso',
  }

  const { error } = await supabase.from('audit_log').insert(payload)

  if (error) {
    // Loguear pero no bloquear. La auditoría desde el frontend es
    // best-effort; los triggers de la BD cubren las acciones críticas
    // (crear_solicitud, cambiar_prioridad).
     
    console.warn('[audit] Failed to log action:', entry.accion, error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

// ─── Re-exportar tipos derivados útiles ─────────────────────────────────────

/** Catálogo en runtime para selects de filtros (HU-AUDIT-01). */
export const ACCIONES_AUDIT: ReadonlyArray<AccionAudit> = [
  'asignar_solicitud',
  'actualizar_estado_solicitud',
  'confirmar_solicitud',
  'rechazar_solucion',
  'escalada_solicitud',
  'editar_perfil',
  'cambio_contrasena',
  'cerrar_sesiones',
  'alta_metodo_pago',
  'predeterminada_metodo_pago',
  'eliminar_metodo_pago',
] as const

/** Catálogo de entidades en runtime. Incluye también las que escriben las
 *  Edge Functions con service_role (que no usan el helper). */
export const ENTIDADES_AUDIT_FILTRO: ReadonlyArray<string> = [
  'solicitudes',
  'asignaciones',
  'usuarios',
  'invitaciones',
  'notificaciones',
  'facturas',        // Sprint 9 · HU-FACT-04 — pagos registrados
  'productos',       // Sprint 10 · HU-TIENDA-02 — alta/baja/edición del catálogo
] as const

/** Acciones que también aparecen en audit_log pero las generan Edge Functions
 *  o triggers — útil para construir el select de filtros. */
export const ACCIONES_AUDIT_COMPLETO: ReadonlyArray<string> = [
  ...ACCIONES_AUDIT,
  // Origen: trigger log_solicitud_creada (Sprint 3)
  'crear_solicitud',
  // Origen: trigger log_solicitud_prioridad_cambiada (Sprint 3)
  'cambiar_prioridad',
  // Origen: Edge Function `invitaciones` (Sprint 2)
  'crear_invitacion',
  // Origen: Edge Function `bloquear-cuenta` (Sprint 2)
  'activar_cuenta',
  'bloquear_cuenta',
  'desbloquear_cuenta',
  // Origen: RPC `registrar_pago_factura` (Sprint 9)
  'registrar_pago_factura',
  // Origen: RPC `pagar_factura_residente` (Sprint 10 · HU-FACT-09)
  'pagar_factura_residente',
  // Origen: trigger log_producto_cambio (Sprint 10 · HU-TIENDA-02)
  'crear_producto',
  'editar_producto',
  'baja_producto',
  'reactivar_producto',
] as const

/** Etiqueta humana para presentar la acción en la vista admin. */
export function labelAccion(accion: string): string {
  const labels: Record<string, string> = {
    asignar_solicitud: 'Asignar solicitud',
    actualizar_estado_solicitud: 'Actualizar estado',
    confirmar_solicitud: 'Confirmar solución',
    rechazar_solucion: 'Rechazar solución',
    escalada_solicitud: 'Escalada al admin',
    editar_perfil: 'Editar perfil',
    cambio_contrasena: 'Cambio de contraseña',
    crear_solicitud: 'Crear solicitud',
    cambiar_prioridad: 'Cambiar prioridad',
    crear_invitacion: 'Crear invitación',
    activar_cuenta: 'Activar cuenta',
    bloquear_cuenta: 'Bloquear cuenta',
    desbloquear_cuenta: 'Desbloquear cuenta',
    registrar_pago_factura: 'Registrar pago de factura',
    pagar_factura_residente: 'Pago en línea (residente)',
    crear_producto: 'Crear producto',
    editar_producto: 'Editar producto',
    baja_producto: 'Dar de baja producto',
    reactivar_producto: 'Reactivar producto',
  }
  return labels[accion] ?? accion
}
