# Cierre del Sprint 6 — Diseño

**Fecha:** 2026-05-20
**Objetivo:** Dejar el Sprint 6 (Comunicación: Notificaciones Realtime, email simulado, foto de cierre, emergentes S4/S5) implementado al 100% según `Zity_Sprint6_Artefactos.pdf`, funcionando en runtime y con los artefactos del DoD v2.

## Diagnóstico previo (estado al iniciar)

La funcionalidad de UI existía parcialmente pero el **núcleo de notificaciones estaba roto en runtime**, verificado contra la BD del proyecto activo `zity-br`:

1. **Realtime deshabilitado**: la publicación `supabase_realtime` no incluía `notificaciones` → la suscripción del cliente nunca recibía eventos.
2. **Esquema desalineado**: la tabla `notificaciones` no tenía la columna `titulo` (el código la inserta/lee) y el CHECK de `tipo` no admitía `alerta_rechazo` → todos los inserts fallaban (tabla con 0 filas).
3. **RLS incompatible con el enfoque de cliente**: la política `notificaciones_insert_own` exige `usuario_id = auth.uid()`; notificar al técnico (al asignar) o a los admins (en rechazo) desde el navegador es imposible — requiere un trigger `SECURITY DEFINER`.

Además faltaban: migraciones 006/007, tabla `audit_acciones`, `docs/notificaciones.md`, ADR-009, variable `RESEND_FROM_ADDRESS`, `seed --notify`, y había **1 test roto** (CI rojo).

## Decisión arquitectónica

**Notificaciones por trigger de base de datos** (fiel al PDF), no por inserción desde el cliente. Validado con la documentación oficial de Supabase (vía context7):
- Las políticas RLS de `SELECT` controlan qué eventos de `postgres_changes` recibe cada usuario; `notificaciones_select_own` ya garantiza "cada usuario solo sus eventos".
- El patrón `SECURITY DEFINER set search_path = ''` permite que el trigger inserte para cualquier destinatario sin violar RLS.

## Diseño por capas

### 1. Base de datos (migraciones versionadas en `supabase/migrations/` y aplicadas a `zity-br`)
- **006_audit_acciones**: tabla catálogo `audit_acciones (codigo PK, descripcion, requiere_detalle bool)`, poblada con el catálogo de `src/lib/audit.ts` + `cambio_contrasena` + cualquier `accion` ya presente en `audit_log`; FK `audit_log.accion → audit_acciones.codigo`.
- **007_notificaciones_realtime**: `ADD COLUMN titulo`; CHECK de `tipo` += `alerta_rechazo`; `ALTER PUBLICATION supabase_realtime ADD TABLE notificaciones`; función + trigger `after_solicitud_estado_changed` (`AFTER UPDATE`, `WHEN OLD.estado IS DISTINCT FROM NEW.estado`, `SECURITY DEFINER`) que inserta 1 fila por destinatario:
  - **residente** (`estado_cambio`) en todo cambio de su solicitud;
  - **técnico** asignado (`asignacion`) cuando pasa a `asignada`;
  - **todos los admin activos** (`alerta_rechazo`) cuando detecta rechazo (`resuelta → en_progreso/pendiente`), con nombre del residente, código e intentos.

### 2. Edge Function `notificar-cambio-estado`
- Remitente desde `RESEND_FROM_ADDRESS` (default `no-reply@zity.local`); dry-run sin `RESEND_API_KEY`; se invoca fire-and-forget desde el cliente tras el cambio de estado (el email no se revierte si Resend falla).

### 3. Frontend
- **`NotificacionesContext`**: una sola suscripción Realtime por sesión + reconexión exponencial (1, 2, 4, 8, máx 30 s) + refetch al reconectar. `useNotificaciones` consume el contexto. Se eliminan los inserts de notificaciones del cliente (`solicitudes.ts`, `useConfirmarSolicitud.ts`); ahora los hace el trigger.
- **Campana**: clic marca leída **y navega** a la solicitud (drawer en `/admin/solicitudes` para admin; dashboard del rol en otros); `aria-live`, cierre con `Esc`, ancho completo en móvil, pulse al llegar nueva.
- **Centro `/notificaciones`**: paginación 25/página.
- **Marcar todas**: modal de confirmación + toast en rollback.
- **Foto cierre**: `FotosCierrePanel` apila en móvil.
- **Ver auditoría**: botón condicional a ≥1 entrada + tooltip con conteo.
- **Cambio de contraseña**: validar "1 número" y "≠ actual", countdown visual, registrar `cambio_contrasena` en `audit_log` sin payload.

### 4. Artefactos / DoD
`docs/notificaciones.md`, `docs/adr/009-realtime-notificaciones.md`, actualizar `docs/audit.md`, `.env.example` (+`RESEND_API_KEY`, `RESEND_FROM_ADDRESS`), `seed.js --notify`.

### 5. Tests y verificación
Arreglar el test roto; ajustar tests al `NotificacionesContext` (cobertura ≥60% del módulo); `typecheck` + `lint` + `test:run` + `build` verdes; probar el trigger con un cambio de estado real vía SQL; `get_advisors` de seguridad tras el DDL.

## Decisiones de diseño / desviaciones justificadas respecto al PDF

- **Path de la foto de cierre**: el PDF indica `{residente_id}/{solicitud_id}/...`, pero la RLS de Storage (`solicitudes_fotos_insert_propio`) exige que el primer segmento del path sea `auth.uid()` (el técnico que sube). Se mantiene `{tecnico_id}/...`; la lectura funciona porque el `SELECT` del bucket es para cualquier `authenticated`.
- **Email por trigger vs cliente**: el PDF menciona NOTIFY/LISTEN. Se mantiene la invocación fire-and-forget desde el cliente (más simple y suficiente para el dry-run académico); las notificaciones in-app + Realtime —lo crítico— sí van por trigger. Documentado en ADR-009.
- **Catálogo de acciones**: el PDF menciona "21 acciones"; el catálogo real son 12 (+`cambio_contrasena`). Se puebla con el catálogo real.
