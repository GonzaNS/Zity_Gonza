// Sprint 13 · HU-PAGO-02 — Hook para gestionar los métodos de pago del residente.
//
// Expone:
//   - Lista de tarjetas tokenizadas del residente autenticado
//   - agregarTarjeta: valida con Luhn, tokeniza y persiste (sin PAN ni CVV)
//   - establecerPredeterminada: rotar la tarjeta default con audit log
//   - eliminarTarjeta: eliminar con audit log
//   - recargar: refresco manual de la lista

import { useState, useEffect, useCallback } from 'react'
import {
  listarMetodosPago,
  agregarMetodoPago,
  establecerPredeterminado,
  eliminarMetodoPago,
  luhnValido,
  tokenizarTarjeta,
  detectarMarca,
  type MetodoPago,
  type TarjetaMarca,
} from '../lib/metodos-pago'
import { logAuditAction } from '../lib/audit'
import { useAuth } from '../contexts/AuthContext'

// ─── Tipos de entrada (formulario de alta) ────────────────────────────────────

/**
 * Datos que el formulario de alta recopila del usuario.
 * CVV se pide solo para validación visual — NUNCA se persiste.
 */
export type FormTarjeta = {
  alias: string
  titular: string
  /** PAN en bruto (con espacios del input mask). Solo para Luhn + tokenizar. */
  pan: string
  /** Mes de expiración como string '01'–'12'. */
  expMes: string
  /** Año de expiración como string 'YYYY'. */
  expAnio: string
  /** CVV: se pide para UX realista pero NUNCA se persiste ni se envía al servidor. */
  cvv: string
  predeterminada: boolean
}

export type UseMetodosPagoResult = {
  tarjetas: MetodoPago[]
  loading: boolean
  error: string | null
  guardando: boolean
  recargar: () => void
  agregarTarjeta: (form: FormTarjeta) => Promise<{ ok: boolean; error?: string }>
  establecerPredeterminada: (id: string) => Promise<{ ok: boolean; error?: string }>
  eliminarTarjeta: (id: string) => Promise<{ ok: boolean; error?: string }>
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMetodosPago(): UseMetodosPagoResult {
  const { profile } = useAuth()
  const [tarjetas, setTarjetas] = useState<MetodoPago[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await listarMetodosPago()
    if (err) setError(err)
    else setTarjetas(data)
    setLoading(false)
  }, [])

  useEffect(() => { void cargar() }, [cargar])

  // ── Alta de tarjeta ───────────────────────────────────────────────────────────
  const agregarTarjeta = useCallback(async (form: FormTarjeta) => {
    // 1. Validar con Luhn ANTES de tokenizar
    if (!luhnValido(form.pan)) {
      return { ok: false, error: 'Número de tarjeta inválido (Luhn).' }
    }

    // 2. Tokenizar: extrae ultimos4, genera token, descarta el PAN
    //    CVV NO participa en la tokenización — solo se usó para la UX del formulario.
    const { token, ultimos4 } = tokenizarTarjeta(form.pan)
    // form.pan y form.cvv quedan fuera del scope de persistencia a partir de aquí.

    // 3. Detectar marca
    const marca: TarjetaMarca = detectarMarca(form.pan.replace(/\D/g, ''))

    // 4. Persistir solo los datos tokenizados (sin PAN, sin CVV)
    setGuardando(true)
    const { data, error: insertErr } = await agregarMetodoPago({
      alias:          form.alias.trim(),
      marca,
      titular:        form.titular.trim(),
      ultimos4,
      exp_mes:        parseInt(form.expMes, 10),
      exp_anio:       parseInt(form.expAnio, 10),
      token_simulado: token,
      predeterminada: form.predeterminada,
    })
    setGuardando(false)

    if (insertErr || !data) return { ok: false, error: insertErr ?? 'Error desconocido' }

    // 5. Audit log — SIN datos sensibles
    if (profile?.id) {
      void logAuditAction(
        {
          accion: 'alta_metodo_pago',
          entidad: 'usuarios',
          entidadId: profile.id,
          detalles: { marca, ultimos4, predeterminada: form.predeterminada },
        },
        profile.id,
      )
    }

    // 6. Recargar lista
    void cargar()
    return { ok: true }
  }, [cargar, profile])

  // ── Cambiar predeterminada ────────────────────────────────────────────────────
  const establecerPredeterminada = useCallback(async (id: string) => {
    setGuardando(true)
    const result = await establecerPredeterminado(id)
    setGuardando(false)

    if (!result.ok) return result

    if (profile?.id) {
      void logAuditAction(
        { accion: 'predeterminada_metodo_pago', entidad: 'usuarios', entidadId: profile.id,
          detalles: { metodo_pago_id: id } },
        profile.id,
      )
    }

    void cargar()
    return { ok: true }
  }, [cargar, profile])

  // ── Eliminar tarjeta ──────────────────────────────────────────────────────────
  const eliminarTarjeta = useCallback(async (id: string) => {
    setGuardando(true)
    const result = await eliminarMetodoPago(id)
    setGuardando(false)

    if (!result.ok) return result

    if (profile?.id) {
      void logAuditAction(
        { accion: 'eliminar_metodo_pago', entidad: 'usuarios', entidadId: profile.id,
          detalles: { metodo_pago_id: id } },
        profile.id,
      )
    }

    void cargar()
    return { ok: true }
  }, [cargar, profile])

  return { tarjetas, loading, error, guardando, recargar: cargar,
    agregarTarjeta, establecerPredeterminada, eliminarTarjeta }
}
