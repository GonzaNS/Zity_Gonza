# Auditoría — `audit_log`

> Sprint 5 · PBI-14 — Catálogo cerrado de acciones, formato del JSON de
> detalles y política no-PII aplicable a cada origen de escritura.

## 1. Tabla `audit_log`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | Auto |
| `usuario_id` | uuid (nullable) | FK a `usuarios.id`. `NULL` para acciones del sistema (triggers sin sesión) |
| `accion` | text | Catálogo cerrado, ver §2 |
| `entidad` | text | Catálogo cerrado, ver §3 |
| `entidad_id` | uuid (nullable) | UUID de la fila afectada |
| `detalles` | jsonb | Solo IDs/flags/estados. **Prohibido PII** — ver §4 |
| `resultado` | text | `exitoso` \| `fallido` (CHECK) |
| `created_at` | timestamptz | `now()` |

### RLS

- `audit_select_admin` — solo `rol=admin` puede leer.
- `audit_insert_authenticated` (Sprint 4) — cualquier `authenticated` puede
  insertar **su propia** entrada (`usuario_id = auth.uid()`) con `resultado`
  y `entidad` dentro de los catálogos.
- `service_role_audit_log` — `service_role` (Edge Functions) puede todo.

## 2. Catálogo cerrado de acciones

> **Sprint 6 (Acción 1 del Retro S5).** El catálogo es ahora una tabla en la BD,
> `audit_acciones (codigo PK, descripcion, requiere_detalle)`, que es la **única
> fuente de verdad** del dominio: `audit_log.accion` tiene una FK contra ella
> (reemplaza el antiguo CHECK). El frontend puede leerla vía el RPC
> `catalogo_acciones()`. El union `AccionAudit` de `src/lib/audit.ts` se mantiene
> como capa de presentación (etiquetas/orden) y debe quedar alineado con la tabla.
> Migración: `supabase/migrations/20260520152631_sprint6_audit_acciones.sql`.

Las acciones del frontend están tipadas en TypeScript (`AccionAudit` en
`src/lib/audit.ts`). Las generadas por triggers/Edge Functions aparecen
en el filtro pero no se pueden escribir desde el cliente.

### Originadas por el frontend (helper `logAuditAction`)

| Acción | Quién | Entidad | Cuando se registra |
|---|---|---|---|
| `asignar_solicitud` | admin | `solicitudes` | Asignar o reasignar técnico a una solicitud (HU-MANT-02) |
| `actualizar_estado_solicitud` | técnico | `solicitudes` | Transición asignada→en_progreso o en_progreso→resuelta (HU-MANT-04) |
| `confirmar_solicitud` | residente | `solicitudes` | Confirmación tras resuelta (HU-MANT-07) |
| `rechazar_solucion` | residente | `solicitudes` | Rechazo bajo el umbral de escalada (HU-MANT-07) |
| `escalada_solicitud` | residente | `solicitudes` | Rechazo #3 que vuelve la solicitud a `pendiente` |
| `editar_perfil` | residente / técnico / admin | `usuarios` | Edición de nombre/apellido/teléfono propio (PBI-S2-E03, opcional) |
| `cambio_contrasena` | residente / técnico / admin | `usuarios` | Cambio de contraseña desde `/perfil` (PBI-S5-E03). **Sin payload** (OWASP A02): solo se registra la acción |

### Originadas por triggers de la BD

| Acción | Trigger / Función | Entidad | Cuando |
|---|---|---|---|
| `crear_solicitud` | `log_solicitud_creada` AFTER INSERT | `solicitudes` | Toda nueva solicitud (Sprint 3) |
| `cambiar_prioridad` | `log_solicitud_prioridad_cambiada` | `solicitudes` | Admin cambia prioridad desde el drawer (Sprint 3) |

### Originadas por Edge Functions (service_role)

| Acción | Edge Function | Entidad | Cuando |
|---|---|---|---|
| `crear_invitacion` | `invitaciones` (`accion=crear`) | `invitaciones` | Admin crea/reenvía invitación |
| `activar_cuenta` | `bloquear-cuenta` | `usuarios` | Admin pasa cuenta a `activo` |
| `bloquear_cuenta` | `bloquear-cuenta` | `usuarios` | Admin pasa cuenta a `bloqueado` |
| `desbloquear_cuenta` | `bloquear-cuenta` | `usuarios` | Admin pasa `bloqueado` → `activo` |

## 3. Catálogo de entidades

Para `audit_insert_authenticated` (frontend), `entidad` está restringido a:

- `solicitudes`
- `asignaciones`
- `usuarios`
- `invitaciones` (solo via Edge Functions con service_role)
- `notificaciones` (Sprint 6)

## 4. Política del campo `detalles` (JSON)

### Reglas

1. **Solo IDs, flags booleanos, valores de estado o números.**
2. **Prohibido**: nombres, emails, teléfonos, descripciones libres, paths de
   foto, notas. Si el JSON necesita texto del usuario, replantear la acción
   o resumirla a un flag.
3. Schema **abierto** — cada acción documenta sus propios campos a continuación.

### Schema por acción

#### `asignar_solicitud`

```json
{
  "estado_anterior": "pendiente | asignada | en_progreso | resuelta | cerrada",
  "estado_nuevo": "asignada",
  "tecnico_id": "uuid",
  "empresa_tercero": "string | null",
  "es_reasignacion": "boolean"
}
```

> `empresa_tercero` es texto pero refiere a un identificador comercial fijo
> (TecnoEdif SAC, Mantenex SRL…), no a PII del usuario.

#### `actualizar_estado_solicitud`

```json
{
  "estado_anterior": "asignada | en_progreso",
  "estado_nuevo": "en_progreso | resuelta"
}
```

#### `confirmar_solicitud`

```json
{
  "estado_anterior": "resuelta",
  "estado_nuevo": "cerrada"
}
```

#### `rechazar_solucion`

```json
{
  "estado_anterior": "resuelta",
  "estado_nuevo": "en_progreso",
  "intentos": 1,
  "escalada": false,
  "con_foto": "boolean (Sprint 5)"
}
```

#### `escalada_solicitud`

```json
{
  "estado_anterior": "resuelta",
  "estado_nuevo": "pendiente",
  "intentos": 3,
  "escalada": true,
  "con_foto": "boolean"
}
```

#### `editar_perfil`

```json
{
  "campos": ["nombre", "apellido", "telefono"]
}
```

> Solo los **nombres** de los campos modificados, **nunca** los valores anteriores
> o nuevos. La política no-PII prohíbe escribir nombres/emails/teléfonos en
> `detalles`.

#### `crear_solicitud` (trigger)

```json
{
  "tipo": "mantenimiento | reparacion | queja | sugerencia | otro",
  "categoria": "plomeria | electricidad | ...",
  "prioridad": "normal | urgente"
}
```

#### `cambiar_prioridad` (trigger)

```json
{
  "prioridad_anterior": "normal | urgente",
  "prioridad_nueva": "normal | urgente"
}
```

#### `bloquear_cuenta` / `desbloquear_cuenta` / `activar_cuenta` (Edge Function)

```json
{
  "usuario_id_afectado": "uuid",
  "estado_anterior": "pendiente | activo | bloqueado",
  "estado_nuevo": "pendiente | activo | bloqueado"
}
```

#### `crear_invitacion` (Edge Function)

```json
{
  "invitacion_id": "uuid",
  "rol_invitado": "residente | tecnico | admin",
  "es_reenvio": "boolean"
}
```

## 5. Cómo extender el catálogo

Para añadir una acción nueva:

1. Agregar el literal al union `AccionAudit` en `src/lib/audit.ts`.
2. Si la entidad no estaba en el catálogo, agregarla a `EntidadAudit` **y** al
   `CHECK` de la policy `audit_insert_authenticated`.
3. Documentar el schema del JSON `detalles` en este archivo.
4. Si la acción la dispara un trigger o una Edge Function (no el helper),
   agregarla a `ACCIONES_AUDIT_COMPLETO` en `src/lib/audit.ts` para que
   aparezca en el filtro de la vista admin.
5. Agregar una etiqueta humana en `labelAccion()`.

## 6. Cómo consumir el audit log

Desde la vista admin (`/admin/auditoria`):

- Tabla paginada (`AUDIT_PAGE_SIZE = 50`) con orden `created_at desc`.
- Filtros combinables sincronizados con la URL (query params `desde`, `hasta`,
  `usuario`, `accion`, `entidad`, `p`). Compartir el link reproduce los filtros.
- Cada fila tiene un botón "Ver detalles" que abre el JSON crudo de `detalles`.

Desde código no-frontend (e.g. RPCs futuras), llamar a la BD con
`service_role` y respetar el mismo catálogo. **No** introducir acciones
ad-hoc sin documentarlas aquí.

## 7. Performance

- Índice por defecto sobre `(created_at desc)` cubre la tabla principal.
- Filtros por `usuario_id`, `accion` y `entidad` son ilike sobre columnas
  no indexadas individualmente — para el volumen del curso (estimado < 10k
  filas) no es relevante. Si el volumen creciera, añadir índice compuesto en
  Sprint 13 (Hardening).

## 8. Referencias

- `src/lib/audit.ts` — Helper y catálogo en TS.
- `src/hooks/useAuditLog.ts` — Hooks de consulta para la vista admin.
- `src/pages/admin/Auditoria.tsx` — Vista admin (HU-AUDIT-01).
- `docs/privacidad.md` — Política no-PII detallada.
- `docs/security/checklist.md` — Cómo se cubre A09 (Logging & Monitoring).
