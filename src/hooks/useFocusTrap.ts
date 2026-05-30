import { useEffect, type RefObject } from 'react'

// Atrapa el foco dentro de `ref` mientras `active` sea true:
//   • al activarse, mueve el foco al primer elemento focusable del panel;
//   • Tab / Shift+Tab ciclan dentro del panel (no se escapan al fondo);
//   • al desactivarse, restaura el foco al elemento que lo tenía antes (el botón
//     que abrió el diálogo).
//
// Pensado para usarse junto a `useModalBehavior` (que aporta Escape + scroll-lock)
// en modales y drawers. Es defensivo: si el panel no tiene elementos focusables,
// no hace nada (nunca "encierra" al usuario sin salida); Escape siempre cierra.

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),' +
  'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true) {
  useEffect(() => {
    if (!active) return
    const cont = ref.current
    if (!cont) return

    const prevFocus = document.activeElement as HTMLElement | null

    const focusables = (): HTMLElement[] =>
      Array.from(cont.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null || el === document.activeElement)

    // Foco inicial dentro del panel.
    const iniciales = focusables()
    if (iniciales.length > 0) iniciales[0]!.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const els = focusables()
      if (els.length === 0) return
      const first = els[0]!
      const last = els[els.length - 1]!
      const activeEl = document.activeElement
      if (e.shiftKey) {
        if (activeEl === first || !cont!.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else if (activeEl === last || !cont!.contains(activeEl)) {
        e.preventDefault()
        first.focus()
      }
    }

    cont.addEventListener('keydown', onKeyDown)
    return () => {
      cont.removeEventListener('keydown', onKeyDown)
      // Restaurar el foco al disparador si sigue en el DOM.
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus()
    }
  }, [ref, active])
}
