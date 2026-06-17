// Sprint 13 · HU-PAGO-01 — Tipos, constantes y helpers para el módulo de métodos de pago.
//
// Política no-PII (OWASP A02):
//   • El PAN completo NUNCA se procesa ni se persiste en este módulo.
//   • El CVV NUNCA se recibe como parámetro de las funciones de escritura BD.
//   • Las funciones reciben el 'token_simulado' opaco de la pasarela, que
//     en producción sería el PaymentMethod ID de Stripe/Culqi.
//
// Flujo de tokenización simulada:
//   1. El frontend captura los datos de la tarjeta en un iframe de la pasarela.
//   2. La pasarela devuelve un token opaco (token_simulado).
//   3. El frontend llama agregarMetodoPago() con el token + datos de presentación.
//   4. NUNCA el PAN ni el CVV pasan por el código de la aplicación.

import { supabase } from './supabase'

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export type TarjetaMarca = 'visa' | 'mastercard' | 'amex' | 'diners' | 'discover' | 'otro'

/** Método de pago tokenizado tal como se guarda en metodos_pago. */
export type MetodoPago = {
  id: string
  residente_id: string
  alias: string
  marca: TarjetaMarca
  titular: string
  /** Últimos 4 dígitos del PAN — solo para identificación visual. NO es el PAN completo. */
  ultimos4: string
  exp_mes: number
  exp_anio: number
  /** Token opaco de la pasarela. En producción: Stripe PaymentMethod ID. */
  token_simulado: string
  predeterminada: boolean
  created_at: string
}

/**
 * Payload para agregar un método de pago.
 * NOTA: NO incluye PAN completo ni CVV — esos datos nunca salen del iframe
 * de la pasarela y nunca llegan al código de la aplicación.
 */
export type MetodoPagoInsert = {
  alias: string
  marca: TarjetaMarca
  titular: string
  /** Últimos 4 dígitos, devueltos por la pasarela al tokenizar. */
  ultimos4: string
  exp_mes: number
  exp_anio: number
  /** Token opaco devuelto por la pasarela tras capturar la tarjeta en su iframe. */
  token_simulado: string
  predeterminada?: boolean
}

// ─── Labels y estilos ─────────────────────────────────────────────────────────

export const LABEL_MARCA: Record<TarjetaMarca, string> = {
  visa:       'Visa',
  mastercard: 'Mastercard',
  amex:       'American Express',
  diners:     'Diners Club',
  discover:   'Discover',
  otro:       'Otra',
}

/** Color de fondo del chip de marca para la UI. */
export const COLOR_MARCA: Record<TarjetaMarca, string> = {
  visa:       'bg-blue-600',
  mastercard: 'bg-red-600',
  amex:       'bg-teal-600',
  diners:     'bg-slate-600',
  discover:   'bg-orange-500',
  otro:       'bg-warm-500',
}

// ─── Utilidades ───────────────────────────────────────────────────────────────

/** Formatea la expiración para mostrar: 'MM/YY' */
export function formatearExpiracion(mes: number, anio: number): string {
  return `${String(mes).padStart(2, '0')}/${String(anio).slice(-2)}`
}

/** Genera el número enmascarado para mostrar en la UI: '**** **** **** 1234' */
export function mascaraTarjeta(ultimos4: string): string {
  return `•••• •••• •••• ${ultimos4}`
}

/**
 * Detecta la marca de tarjeta a partir del BIN (primeros dígitos).
 * Solo se llama DESPUÉS de que la pasarela tokeniza y devuelve los
 * primeros dígitos — nunca se procesa el PAN completo.
 */
export function detectarMarca(primerosDig: string): TarjetaMarca {
  const d = primerosDig.replace(/\D/g, '')
  if (/^4/.test(d))                    return 'visa'
  if (/^5[1-5]/.test(d))              return 'mastercard'
  if (/^2[2-7]/.test(d))              return 'mastercard'   // Mastercard 2xxx
  if (/^3[47]/.test(d))               return 'amex'
  if (/^3(?:0[0-5]|[68])/.test(d))   return 'diners'
  if (/^6(?:011|5)/.test(d))          return 'discover'
  return 'otro'
}

/**
 * HU-PAGO-02 — Algoritmo de Luhn (mod 10) para validar el número de tarjeta.
 * Solo se llama desde el UI para validar ANTES de tokenizar; el PAN
 * NO se envía al servidor ni se persiste.
 *
 * @param pan Número de tarjeta como string (puede contener espacios/guiones).
 * @returns true si el número supera la comprobación de Luhn.
 */
export function luhnValido(pan: string): boolean {
  const digitos = pan.replace(/\D/g, '')
  if (digitos.length < 13 || digitos.length > 19) return false

  let suma = 0
  let doblar = false
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = parseInt(digitos[i]!, 10)
    if (doblar) {
      d *= 2
      if (d > 9) d -= 9
    }
    suma += d
    doblar = !doblar
  }
  return suma % 10 === 0
}

/**
 * HU-PAGO-02 — Tokenización simulada del lado del frontend.
 * En producción esta función NO existiría: el PAN nunca tocaría JS de la app;
 * lo capturaría un iframe de la pasarela (Stripe Elements, Culqi, etc.).
 *
 * En SIMULACIÓN: genera un token opaco a partir del PAN, extrae los últimos
 * 4 dígitos y DESCARTA el PAN. El token no es reversible al PAN.
 *
 * @param pan Número de tarjeta (solo dígitos). NUNCA se persiste.
 * @returns { token, ultimos4 } — PAN descartado aquí, solo se usa para generar el token.
 */
export function tokenizarTarjeta(pan: string): { token: string; ultimos4: string } {
  const digitos = pan.replace(/\D/g, '')
  const ultimos4 = digitos.slice(-4)
  // Token opaco: prefijo + hash simple no reversible (XOR rotativo de los dígitos)
  // En producción esto sería un UUID devuelto por la pasarela.
  const hash = digitos
    .split('')
    .reduce((acc, d, i) => acc ^ (parseInt(d, 10) << (i % 8)), 0)
    .toString(16)
    .padStart(8, '0')
  const token = `tok_sim_${hash}_${Date.now().toString(36)}`
  // digitos queda fuera del scope aquí → GC lo limpia
  return { token, ultimos4 }
}

// ─── Operaciones de datos ─────────────────────────────────────────────────────

/**
 * Lista los métodos de pago del residente autenticado.
 * La RLS garantiza que solo ve los suyos.
 */
export async function listarMetodosPago(): Promise<{ data: MetodoPago[]; error: string | null }> {
  const { data, error } = await supabase
    .from('metodos_pago')
    .select('*')
    .order('predeterminada', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as MetodoPago[], error: null }
}

/**
 * Agrega un nuevo método de pago tokenizado para el residente autenticado.
 * PRECONDICIÓN: el 'token_simulado' fue generado por la pasarela (no por el frontend).
 * El PAN completo y el CVV NUNCA son parámetros de esta función.
 */
export async function agregarMetodoPago(
  payload: MetodoPagoInsert,
): Promise<{ data: MetodoPago | null; error: string | null }> {
  // Si este método va a ser predeterminado, primero quitamos la marca anterior
  // para no violar el índice único parcial.
  if (payload.predeterminada) {
    const { error: clearErr } = await supabase
      .from('metodos_pago')
      .update({ predeterminada: false })
      .eq('predeterminada', true)

    if (clearErr) return { data: null, error: clearErr.message }
  }

  const { data, error } = await supabase
    .from('metodos_pago')
    .insert({
      alias:          payload.alias.trim(),
      marca:          payload.marca,
      titular:        payload.titular.trim(),
      ultimos4:       payload.ultimos4,
      exp_mes:        payload.exp_mes,
      exp_anio:       payload.exp_anio,
      token_simulado: payload.token_simulado,
      predeterminada: payload.predeterminada ?? false,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as MetodoPago, error: null }
}

/**
 * Establece un método de pago como predeterminado, quitando la marca a los demás.
 * Se ejecuta en dos pasos secuenciales (Supabase no tiene transacciones en cliente).
 */
export async function establecerPredeterminado(
  metodoPagoId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. Quitar predeterminada=true a todos
  const { error: clearErr } = await supabase
    .from('metodos_pago')
    .update({ predeterminada: false })
    .eq('predeterminada', true)

  if (clearErr) return { ok: false, error: clearErr.message }

  // 2. Marcar el elegido
  const { error: setErr } = await supabase
    .from('metodos_pago')
    .update({ predeterminada: true })
    .eq('id', metodoPagoId)

  if (setErr) return { ok: false, error: setErr.message }
  return { ok: true }
}

/**
 * Elimina un método de pago del residente.
 * La RLS garantiza que solo puede eliminar los suyos.
 */
export async function eliminarMetodoPago(
  metodoPagoId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('metodos_pago')
    .delete()
    .eq('id', metodoPagoId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
