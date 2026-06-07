import { useEffect, useRef, useState } from 'react'

type VideoLoopProps = {
  src: string
  className?: string
  /** Segundos antes del final en que arranca el crossfade hacia la otra copia. */
  fade?: number
}

/**
 * VideoLoop — loop continuo sin corte brusco.
 *
 * Monta dos <video> con el mismo origen y, cuando la copia activa se acerca
 * a su final, arranca la otra desde 0 y hace un crossfade de opacidad entre
 * ambas. Así el salto fin→inicio queda disimulado y el bucle se siente
 * perpetuo aunque el archivo no sea un loop perfecto.
 */
export default function VideoLoop({ src, className = '', fade = 0.9 }: VideoLoopProps) {
  const aRef = useRef<HTMLVideoElement>(null)
  const bRef = useRef<HTMLVideoElement>(null)
  const [active, setActive] = useState<0 | 1>(0)

  useEffect(() => {
    const a = aRef.current
    const b = bRef.current
    if (!a || !b) return

    // Arranca la primera copia; la segunda espera en pausa (invisible).
    a.play().catch(() => {})

    const handleTimeUpdate = (event: Event) => {
      const current = event.target as HTMLVideoElement
      const other = current === a ? b : a
      if (!current.duration || Number.isNaN(current.duration)) return

      // Cerca del final y la otra copia aún en pausa → relevo + crossfade.
      if (current.currentTime >= current.duration - fade && other.paused) {
        other.currentTime = 0
        other.play().catch(() => {})
        setActive(current === a ? 1 : 0)
      }
    }

    const handleEnded = (event: Event) => {
      // La copia que terminó se rebobina y queda lista para el próximo relevo.
      const current = event.target as HTMLVideoElement
      current.pause()
      current.currentTime = 0
    }

    for (const v of [a, b]) {
      v.addEventListener('timeupdate', handleTimeUpdate)
      v.addEventListener('ended', handleEnded)
    }
    return () => {
      for (const v of [a, b]) {
        v.removeEventListener('timeupdate', handleTimeUpdate)
        v.removeEventListener('ended', handleEnded)
      }
    }
  }, [fade, src])

  const transition = { transition: 'opacity 900ms ease-out' as const }

  return (
    <>
      <video
        ref={aRef}
        className={className}
        style={{ ...transition, opacity: active === 0 ? 1 : 0 }}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={src} type="video/mp4" />
      </video>
      <video
        ref={bRef}
        className={className}
        style={{ ...transition, opacity: active === 1 ? 1 : 0 }}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        tabIndex={-1}
      >
        <source src={src} type="video/mp4" />
      </video>
    </>
  )
}
