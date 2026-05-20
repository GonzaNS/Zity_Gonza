# HU-MANT-02 · Admin asigna técnico a solicitud
**Sprint 4 · 3.5 h · P1**

---

## Historia de usuario

Como **administrador**, quiero **asignar una solicitud de mantenimiento a un técnico (interno o de empresa tercera) con una nota de instrucción**, para delegar el trabajo de forma trazable y con contexto claro.

---

## User Review Required — Supabase

> [!IMPORTANT]
> **Tabla `asignaciones`**: debe existir en Supabase con las columnas exactas:
> ```sql
> id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
> solicitud_id   uuid REFERENCES solicitudes(id)
> tecnico_id     uuid REFERENCES usuarios(id)
> asignado_por   uuid REFERENCES usuarios(id)
> notas          text NULL
> empresa_tercero text NULL
> fecha_asignacion timestamptz DEFAULT now()
> ```
> El tipo `Asignacion` ya está declarado en `src/types/database.ts`, pero si la tabla no existe en Supabase el insert fallará con error `relation "asignaciones" does not exist`.

> [!IMPORTANT]
> **Tabla `audit_log`**: debe existir con las columnas:
> ```sql
> id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
> usuario_id  uuid NULL
> accion      text
> entidad     text NULL
> entidad_id  uuid NULL
> resultado   text NULL
> created_at  timestamptz DEFAULT now()
> ```
> El insert en `audit_log` es fire-and-forget (no bloquea el flujo), pero si la tabla no existe se generará un error silencioso en consola.

> [!WARNING]
> **Cambio de estado desde el cliente**: la transición `pendiente → asignada` se ejecuta con dos operaciones secuenciales (insert asignaciones + update solicitudes.estado). No hay transacción real en el cliente. Si el update falla, el hook elimina la fila de asignaciones para mantener consistencia. Se recomienda en el futuro mover esta lógica a una **Edge Function** o **stored procedure** para atomicidad real.

> [!WARNING]
> **RLS requeridas**:
> - `asignaciones`: INSERT permitido para `rol = 'admin'`
> - `asignaciones`: DELETE permitido para `rol = 'admin'` (para el rollback)
> - `solicitudes`: UPDATE del campo `estado` permitido para `rol = 'admin'`
> - `audit_log`: INSERT permitido para `rol = 'admin'`

> [!NOTE]
> **Se asume** que la columna `empresa_tercero` existe en la tabla `usuarios` (ya declarada en `Profile` de `database.ts`). El hook filtra técnicos con `rol = 'tecnico'` y `estado_cuenta = 'activo'`.

---

## Campos del formulario

- **Selector de técnico:** dropdown agrupado por empresa (Internos / TecnoEdif SAC / Mantenex SRL / Otros), filtra solo perfiles con `rol=tecnico` y `estado_cuenta=activo`
- **Nota de asignación:** textarea opcional, máx. 300 caracteres, contador visible
- **Información de la solicitud (solo lectura):** ID, tipo, categoría, prioridad, descripción y foto

---

## Criterios de aceptación

- [ ] El admin solo puede asignar solicitudes en estado **pendiente**. Si la solicitud ya está asignada, el botón `Asignar` se reemplaza por `Reasignar`.
- [ ] El dropdown de técnicos está agrupado por `empresa_tercero` del perfil. Técnicos sin empresa aparecen como `Internos`.
- [ ] Al confirmar la asignación: se crea registro en `asignaciones`, el estado cambia a **asignada**, se inserta entrada en `historial_estados` y `audit_log`.
- [ ] La nota de asignación queda guardada en `asignaciones.notas` y visible al técnico desde su detalle.
- [ ] Si la asignación falla (ej. técnico bloqueado entre selección y confirmación), el sistema muestra mensaje claro y rollback completo.
- [ ] La acción se registra en `audit_log` con `{accion: 'asignar_solicitud', admin_id, solicitud_id, tecnico_id, empresa_tercero}`.
- [ ] Solo el administrador puede ejecutar esta acción (RLS + ProtectedRoute).

---

## Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `src/hooks/useAsignarTecnico.ts` | **NUEVO** — fetch técnicos activos agrupados + función `asignarTecnico` con rollback |
| `src/components/admin/solicitudes/ModalAsignarTecnico.tsx` | **NUEVO** — modal con dropdown agrupado, textarea nota (300 chars), info solicitud |
| `src/components/admin/solicitudes/DrawerSolicitud.tsx` | **MODIFICADO** — botón Asignar/Reasignar + apertura del modal |
| `src/pages/admin/Solicitudes.tsx` | **MODIFICADO** — prop `onAsignacionRealizada` para refetch |

---

## Notas de implementación

- El cambio de estado `pendiente → asignada` se ejecuta desde el cliente (no trigger BD) para tener control total del rollback.
- Si el step de `update estado` falla, se elimina la fila de `asignaciones` recién insertada.
- El registro en `audit_log` no bloquea el flujo (fire and forget).
- Todos los bloques de código nuevos llevan el comentario `// HU-MANT-02 SPRINT-4`.
