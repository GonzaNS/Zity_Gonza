// Sprint 13 · HU-HOME-01 — Resumen integral del residente para el dashboard home.
//
// Consulta las 3 vistas Postgres ligeras en paralelo:
//   vw_resumen_solicitudes_residente
//   vw_resumen_facturas_residente
//   vw_resumen_pedidos_residente
//
// Todas usan security_invoker=true → la RLS de las tablas base aplica al
// residente autenticado, sin necesidad de filtrar por residente_id en cliente.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ─── Tipos de retorno de las vistas ───────────────────────────────────────────

export type ResumenSolicitudes = {
  total: number
  pendientes: number
  en_progreso: number
  pendientes_confirmacion: number
}

export type ResumenFacturas = {
  total_pendiente_mes: number
  facturas_vencidas: number
  proxima_vencimiento: string | null  // 'YYYY-MM-DD'
}

export type ResumenPedidos = {
  total_pedidos: number
  ultimo_pedido_at: string | null
  ultimo_total: number | null
}

export type ResumenResidente = {
  solicitudes: ResumenSolicitudes
  facturas: ResumenFacturas
  pedidos: ResumenPedidos
}

const RESUMEN_SOLICITUDES_VACIO: ResumenSolicitudes = {
  total: 0,
  pendientes: 0,
  en_progreso: 0,
  pendientes_confirmacion: 0,
}

const RESUMEN_FACTURAS_VACIO: ResumenFacturas = {
  total_pendiente_mes: 0,
  facturas_vencidas: 0,
  proxima_vencimiento: null,
}

const RESUMEN_PEDIDOS_VACIO: ResumenPedidos = {
  total_pedidos: 0,
  ultimo_pedido_at: null,
  ultimo_total: null,
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useResumenResidente() {
  const [resumen, setResumen] = useState<ResumenResidente>({
    solicitudes: RESUMEN_SOLICITUDES_VACIO,
    facturas:    RESUMEN_FACTURAS_VACIO,
    pedidos:     RESUMEN_PEDIDOS_VACIO,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [
      { data: dataSol, error: errSol },
      { data: dataFact, error: errFact },
      { data: dataPed, error: errPed },
    ] = await Promise.all([
      supabase.from('vw_resumen_solicitudes_residente').select('*').maybeSingle(),
      supabase.from('vw_resumen_facturas_residente').select('*').maybeSingle(),
      supabase.from('vw_resumen_pedidos_residente').select('*').maybeSingle(),
    ])

    const primerError = errSol ?? errFact ?? errPed
    if (primerError) {
      setError(primerError.message)
      setLoading(false)
      return
    }

    setResumen({
      solicitudes: dataSol
        ? {
            total:                   Number(dataSol.total ?? 0),
            pendientes:              Number(dataSol.pendientes ?? 0),
            en_progreso:             Number(dataSol.en_progreso ?? 0),
            pendientes_confirmacion: Number(dataSol.pendientes_confirmacion ?? 0),
          }
        : RESUMEN_SOLICITUDES_VACIO,

      facturas: dataFact
        ? {
            total_pendiente_mes:  Number(dataFact.total_pendiente_mes ?? 0),
            facturas_vencidas:    Number(dataFact.facturas_vencidas ?? 0),
            proxima_vencimiento:  dataFact.proxima_vencimiento ?? null,
          }
        : RESUMEN_FACTURAS_VACIO,

      pedidos: dataPed
        ? {
            total_pedidos:    Number(dataPed.total_pedidos ?? 0),
            ultimo_pedido_at: dataPed.ultimo_pedido_at ?? null,
            ultimo_total:     dataPed.ultimo_total !== null ? Number(dataPed.ultimo_total) : null,
          }
        : RESUMEN_PEDIDOS_VACIO,
    })

    setLoading(false)
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  return { resumen, loading, error, recargar: cargar }
}
