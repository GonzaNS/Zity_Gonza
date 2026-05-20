import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

type Props = {
  pathFotoCierre: string
  fotoOriginalUrl?: string
}

export default function FotosCierrePanel({ pathFotoCierre, fotoOriginalUrl }: Props) {
  const [fotoCierreUrl, setFotoCierreUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true

    async function cargarUrl() {
      const { data, error } = await supabase.storage
        .from('solicitudes-fotos')
        .createSignedUrl(pathFotoCierre, 3600)

      if (!active) return

      if (error || !data) {
        setError(true)
      } else {
        setFotoCierreUrl(data.signedUrl)
      }
    }

    cargarUrl()

    return () => {
      active = false
    }
  }, [pathFotoCierre])

  return (
    <div className="mt-3 bg-warm-50 rounded-lg p-3 border border-warm-200">
      <p className="text-xs font-medium text-primary-900 mb-2 uppercase tracking-wider">
        Evidencia de solución
      </p>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase text-warm-500 font-semibold text-center tracking-wider">
            Antes
          </p>
          <div className="aspect-[4/3] rounded-md overflow-hidden bg-warm-100 border border-warm-200 relative group">
            {fotoOriginalUrl ? (
              <img 
                src={fotoOriginalUrl} 
                alt="Problema original" 
                className="w-full h-full object-cover group-hover:object-contain transition-all"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-warm-400">
                Sin foto
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] uppercase text-success font-semibold text-center tracking-wider">
            Después
          </p>
          <div className="aspect-[4/3] rounded-md overflow-hidden bg-warm-100 border border-warm-200 relative group">
            {error ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-error text-center px-2">
                No disponible
              </div>
            ) : fotoCierreUrl ? (
              <img 
                src={fotoCierreUrl} 
                alt="Trabajo terminado" 
                className="w-full h-full object-cover group-hover:object-contain transition-all"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
