# HU-MANT-04 · Técnico actualiza estado y agrega nota de cierre
**Sprint 4 · 2 h · P1**

---

## Historia de usuario

Como **técnico**, quiero **actualizar el estado de una solicitud asignada y agregar una nota de trabajo realizado al cerrarla**, para informar al residente y al admin del avance y dejar evidencia de lo hecho.

---

## User Review Required — Supabase

> [!IMPORTANT]
> **RLS en `solicitudes` — UPDATE para técnico**: el técnico solo puede actualizar el estado de solicitudes que le han sido asignadas. Debe existir una política:
> ```sql
> CREATE POLICY "Tecnico actualiza estado de su solicitud"
>   ON solicitudes FOR UPDATE
>   USING (
>     EXISTS (
>       SELECT 1 FROM asignaciones
>       WHERE asignaciones.solicitud_id = solicitudes.id
>         AND asignaciones.tecnico_id = auth.uid()
>     )
>   )
>   WITH CHECK (estado IN ('en_progreso', 'resuelta'));
> ```
> Sin esta política, el UPDATE será bloqueado por RLS y el técnico verá error al guardar.

> [!IMPORTANT]
> **Tabla `historial_estados`**: la inserción de la nota requiere que la columna `nota` exista. La tabla ya está declarada en `database.ts`. Verificar en Supabase:
> ```sql
> -- columna requerida:
> nota text NULL
> ```
> RLS requerida para que el técnico pueda insertar:
> ```sql
> CREATE POLICY "Tecnico inserta en historial de sus solicitudes"
>   ON historial_estados FOR INSERT
>   WITH CHECK (
>     EXISTS (
>       SELECT 1 FROM asignaciones
>       WHERE asignaciones.solicitud_id = historial_estados.solicitud_id
>         AND asignaciones.tecnico_id = auth.uid()
>     )
>   );
> ```

> [!IMPORTANT]
> **Tabla `audit_log`**: INSERT permitido para `rol = 'tecnico'`. Si la política solo permite admin, el insert fallará silenciosamente (fire-and-forget).

> [!WARNING]
> **Validación "nota obligatoria" para `resuelta`**: se valida en el frontend (min 20, max 500 chars). La HU especifica que también debe validarse en RLS. Para eso se necesita un CHECK constraint en BD o un trigger que rechace el update si el historial no tiene nota. Actualmente solo se hace en frontend — suficiente para MVP, pero se recomienda agregar constraint en BD para Sprint futuro.

> [!WARNING]
> **Transición de estados desde el cliente**: se ejecutan dos operaciones secuenciales (UPDATE solicitudes + INSERT historial_estados). No hay transacción real. Si el INSERT en historial falla, el estado ya cambió. Se recomienda en el futuro usar una Edge Function para atomicidad.

> [!NOTE]
> **Se asume** que solo existen dos transiciones válidas para el técnico:
> - `asignada → en_progreso` (nota opcional)
> - `en_progreso → resuelta` (nota obligatoria, min 20, max 500 chars)
> El estado `resuelta` NO cierra la solicitud — queda pendiente de confirmación del residente (HU-MANT-07).

---

## Estados permitidos para el técnico

| Estado actual | Puede transicionar a | Nota |
|---|---|---|
| `asignada` | `en_progreso` | Opcional |
| `en_progreso` | `resuelta` | **Obligatoria** (min 20 / max 500 chars) |
| `resuelta` | — | Sin acciones disponibles |

---

## Criterios de aceptación

- [ ] El selector de estado solo muestra transiciones válidas según el estado actual.
- [ ] Al pasar a `en_progreso`: nota opcional, transición inmediata.
- [ ] Al pasar a `resuelta`: nota **OBLIGATORIA**, mínimo 20 caracteres, máximo 500. Validación en frontend y RLS.
- [ ] La nota queda guardada en `historial_estados.nota` y visible para residente y admin.
- [ ] El estado `resuelta` NO cierra la solicitud — queda pendiente de confirmación del residente (HU-MANT-07).
- [ ] Si el cambio falla, el estado y la nota se preservan en el formulario para reintento.
- [ ] Cualquier cambio de estado registra entrada en `historial_estados` y `audit_log`.
- [ ] Solo el técnico asignado puede cambiar el estado de su solicitud (RLS + verificación de `tecnico_id`).
- [ ] UX: durante el guardado, botón deshabilitado con spinner. Si falla, mensaje de error claro y accionable.

---

## Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `src/hooks/useActualizarEstadoTecnico.ts` | **NUEVO** — función `actualizarEstadoTecnico` con validación, UPDATE + INSERT historial + audit_log |
| `src/components/tecnico/solicitudes/SeccionActualizarEstado.tsx` | **NUEVO** — UI con selector de transición válida, textarea nota con validación |
| `src/components/tecnico/solicitudes/DrawerDetalleTecnico.tsx` | **MODIFICADO** — agrega `SeccionActualizarEstado` y callback `onEstadoActualizado` |
| `src/pages/TecnicoDashboard.tsx` | **MODIFICADO** — pasa `onEstadoActualizado={refetch}` al drawer |

---

## Notas de implementación

- La máquina de estados está en el cliente: un mapa `TRANSICIONES_VALIDAS` define qué destinos son posibles desde cada estado.
- La nota mínima de 20 chars para `resuelta` se valida antes de enviar; el botón permanece deshabilitado si no se cumple.
- El mensaje de error persiste en el formulario para que el técnico pueda reintentar sin perder la nota escrita.
- Todos los bloques nuevos llevan el comentario `// HU-MANT-04 SPRINT-4`.
