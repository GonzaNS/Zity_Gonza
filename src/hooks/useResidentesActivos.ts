// Sprint 8 · HU-FACT-02 — Hook para cargar residentes activos.
// Usado en el dropdown del formulario de emisión individual de facturas.
// Solo carga id, nombre, apellido, departamento — campos mínimos para la UI.

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type ResidenteActivo = {
  id: string
  nombre: string
  apellido: string
  departamento: string
  piso: string
}

export function useResidentesActivos() {
  const [residentes, setResidentes] = useState<ResidenteActivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      const { data, error: fetchError } = await supabase
        .from('usuarios')
        .select('id, nombre, apellido, departamento, piso')
        .eq('rol', 'residente')
        .eq('estado_cuenta', 'activo')
        .order('apellido', { ascending: true })

      if (cancelado) return

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setResidentes((data ?? []) as ResidenteActivo[])
      }
      setLoading(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [])

  return { residentes, loading, error }
}
