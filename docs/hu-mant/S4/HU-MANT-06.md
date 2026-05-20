# HU-MANT-06 · Captura desde cámara móvil al subir foto
**Sprint 4 · 1 h · P1**

## User Review Required — Supabase

> [!NOTE]
> Esta HU **no requiere cambios en BD ni RLS**. Solo modifica la UI de `UploadFoto`. El archivo se sube al bucket igual que antes.

> [!NOTE]
> El atributo `capture="environment"` es ignorado en desktop — el navegador abre el selector de archivos normal (degradación elegante automática).

## Criterios de aceptación

- [ ] Segundo botón `Tomar foto` con `capture="environment"` en `<input>` oculto.
- [ ] Misma validación JPEG/PNG máx. 5 MB para fotos de cámara.
- [ ] Viewport `matchMedia("(max-width: 640px)")`: móvil muestra `Tomar foto` como CTA principal; desktop lo oculta.
- [ ] Tests existentes siguen pasando. Se agregan tests nuevos.
- [ ] Comportamiento documentado en `docs/solicitudes.md`.

## Archivos

| Archivo | Acción |
|---|---|
| `src/components/residente/UploadFoto.tsx` | **MODIFICADO** — input capture, hook `useMobileViewport`, nueva UI |
| `src/test/residente/UploadFoto.test.tsx` | **MODIFICADO** — tests botón cámara, viewport, validación |
| `docs/solicitudes.md` | **NUEVO** — documenta comportamiento capture en Android/iOS/Desktop |

## Notas

- Guard `typeof window.matchMedia === 'function'` evita crash en jsdom; `isMobile = false` en tests.
- `<input aria-label="Subir foto del problema">` se preserva intacto (no rompe tests).
- Nuevo input con `aria-label="Tomar foto con cámara"` para testabilidad.
- Todos los bloques nuevos: `// HU-MANT-06 SPRINT-4`.
