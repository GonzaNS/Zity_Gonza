// Fix post Sprint 13/14 (PBI-S6-E03) — Verificación activa de "sesión única".
//
// Acompaña a las RPC `cerrar_otras_sesiones()` / `limpiar_sesion_unica()` y a la
// columna `usuarios.sesion_unica_id`. El cierre de las demás sesiones es
// PERCEPTIBLE porque el cliente compara, de forma activa, el `session_id` de SU
// access token (JWT) contra la marca guardada en la BD y cierra la sesión local
// si dejó de ser la válida — sin esperar a que expire el JWT (~1 h).

import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Extrae el claim `session_id` del access token (JWT). Es el `id` de la fila en
 * `auth.sessions` e identifica de forma estable la sesión a través de los
 * refresh de token (el refresh rota el access token pero conserva el session_id).
 * Devuelve `null` si el token falta o no se puede decodificar.
 */
export function getSessionIdFromToken(accessToken: string | undefined | null): string | null {
  if (!accessToken) return null
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return null
    // base64url → base64 (+ relleno de padding) + decodificación UTF-8 segura.
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    )
    const claims = JSON.parse(json) as { session_id?: string }
    return claims.session_id ?? null
  } catch {
    return null
  }
}

// Durante operaciones de auth sensibles (p. ej. el re-login del cambio de
// contraseña, que crea una sesión nueva en el acto) la verificación se pausa para
// no cerrar por error la sesión que se está re-creando en ese instante.
let verificacionPausada = false
export function pausarVerificacionSesion(pausar: boolean): void {
  verificacionPausada = pausar
}
export function estaVerificacionPausada(): boolean {
  return verificacionPausada
}

/**
 * Indica si una marca `sesion_unica_id` invalida a la sesión dada: hay marca y
 * NO coincide con el session_id de su JWT.
 */
export function marcaInvalidaSesion(
  marca: string | null | undefined,
  session: Session | null,
): boolean {
  if (!marca || !session) return false
  const sid = getSessionIdFromToken(session.access_token)
  if (!sid) return false
  return marca !== sid
}

/**
 * Consulta la marca en la BD y resuelve si la sesión local debe CERRARSE.
 * Devuelve `true` solo cuando hay constancia de invalidación; ante cualquier
 * duda (verificación pausada, sin sesión, sin session_id, error de red) devuelve
 * `false` para no expulsar al usuario por un fallo transitorio.
 */
export async function sesionFueInvalidada(session: Session | null): Promise<boolean> {
  if (verificacionPausada || !session) return false
  const sid = getSessionIdFromToken(session.access_token)
  if (!sid) return false

  const { data, error } = await supabase
    .from('usuarios')
    .select('sesion_unica_id')
    .eq('id', session.user.id)
    .single()

  if (error || !data) return false
  const marca = (data as { sesion_unica_id: string | null }).sesion_unica_id
  return marca !== null && marca !== sid
}
