# HU-MANT-03 · Vista del técnico: solicitudes asignadas
**Sprint 4 · 2.5 h · P1**

---

## Historia de usuario

Como **técnico**, quiero **ver la lista de solicitudes que me han sido asignadas con foto, descripción y datos de la unidad**, para entender el contexto antes de ir al sitio del trabajo.

---

## User Review Required — Supabase

> [!IMPORTANT]
> **RLS en `asignaciones`**: la query filtra por `tecnico_id = auth.uid()` a nivel de RLS. Debe existir una política SELECT en `asignaciones` como:
> ```sql
> CREATE POLICY "Tecnico ve sus asignaciones"
>   ON asignaciones FOR SELECT
>   USING (tecnico_id = auth.uid());
> ```
> Sin esta política, la query devuelve array vacío sin error, y el técnico verá "Sin solicitudes asignadas" aunque tenga asignaciones reales.

> [!IMPORTANT]
> **JOIN `asignaciones → solicitudes → usuarios`**: la query usa un embed de PostgREST en dos niveles:
> ```
> asignaciones → solicitud:solicitudes → residente:usuarios!solicitudes_residente_id_fkey
> ```
> Requiere que la FK `solicitudes_residente_id_fkey` exista en Supabase. Si la FK tiene otro nombre, el embed fallará con error `Could not find a relationship`.

> [!WARNING]
> **Columna `fecha_asignacion`**: se asume que existe en `asignaciones`. Si no tiene valor por defecto `DEFAULT now()` en Supabase, puede llegar como `null` y la card mostrará la fecha de creación de la solicitud como fallback.

> [!NOTE]
> **Filtros en cliente**: los filtros de estado y prioridad se aplican en el cliente (no en la query SQL) para evitar joins multi-tabla con filtros cruzados que PostgREST no siempre resuelve correctamente. En conjuntos grandes de datos esto puede ser ineficiente; se recomienda migrar a filtros SQL en una versión futura.

> [!NOTE]
> **Se asume** que `useFotosFirmadas` (de `useSolicitudes.ts`) tiene acceso al bucket `solicitudes-fotos` con RLS que permita lectura a usuarios con `rol = 'tecnico'`. Si no, las fotos no cargarán.

---

## Criterios de aceptación

- [ ] Vista `/tecnico` accesible solo para usuarios con `rol=tecnico` y `estado_cuenta=activo` (RLS + ProtectedRoute).
- [ ] Lista filtrada automáticamente por `tecnico_id = auth.uid()` (RLS hace el filtro, no el frontend).
- [ ] Cada card muestra: ID, tipo, categoría, prioridad (badge color), unidad (piso+depto), descripción truncada (primeros 80 chars), miniatura de foto, fecha de asignación.
- [ ] Filtros: por estado (`asignada` / `en_progreso` / `resuelta`) y por prioridad.
- [ ] Click en card abre detalle completo con foto en grande, descripción completa, datos del residente (nombre, depto, teléfono), nota de asignación del admin, historial de estados.
- [ ] La lista se actualiza al refrescar (Realtime se agrega en Sprint 6).
- [ ] Si no hay solicitudes asignadas, muestra estado vacío amigable con ilustración.
- [ ] Responsiva: en celular muestra cards apiladas verticalmente, en desktop muestra tabla.

---

## Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `src/hooks/useSolicitudesTecnico.ts` | **NUEVO** — fetch solicitudes asignadas al técnico logueado con datos residente + asignación |
| `src/components/tecnico/TecnicoShell.tsx` | **NUEVO** — layout base (header + nav) para vistas del técnico |
| `src/components/tecnico/solicitudes/CardSolicitudTecnico.tsx` | **NUEVO** — card responsive con todos los campos de la HU |
| `src/components/tecnico/solicitudes/DrawerDetalleTecnico.tsx` | **NUEVO** — panel lateral con detalle completo, foto, nota admin, historial |
| `src/components/tecnico/solicitudes/FiltrosTecnico.tsx` | **NUEVO** — filtros por estado y prioridad |
| `src/pages/TecnicoDashboard.tsx` | **REEMPLAZADO** — integra TecnicoShell + lista de cards + drawer detalle |

---

## Notas de implementación

- La query a `solicitudes` une con `asignaciones` para obtener `tecnico_id` y `notas` del admin.
- El RLS de Supabase ya filtra por `auth.uid()` en la tabla `asignaciones`; el frontend no necesita hardcodear el ID.
- Los estados disponibles en filtros son: `asignada`, `en_progreso`, `resuelta` (sin `pendiente` ni `cerrada`).
- Todos los bloques nuevos llevan el comentario `// HU-MANT-03 SPRINT-4`.
