# Notificaciones — Realtime + email simulado

> Sprint 6 · PBI-12 / HU-NOTIF-01 / HU-NOTIF-02 / PBI-S4-E01
> Arquitectura de notificaciones en tiempo real, email transaccional simulado y
> el centro de notificaciones.

## 1. Resumen

Cada cambio de estado relevante de una solicitud genera notificaciones in-app que
llegan **en tiempo real** (Supabase Realtime) al destinatario correcto, además de
un **email simulado** (dry-run por defecto). Los usuarios ven una campana con
badge de no leídas en la navbar y un centro completo en `/notificaciones`.

## 2. Tabla `notificaciones`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | Auto |
| `usuario_id` | uuid | FK a `usuarios.id` — destinatario |
| `solicitud_id` | uuid (nullable) | FK a `solicitudes.id` |
| `tipo` | text | CHECK: `estado_cambio`, `asignacion`, `nueva_solicitud`, `sistema`, `alerta_rechazo` |
| `titulo` | text | Título corto (añadido Sprint 6) |
| `mensaje` | text | Cuerpo legible |
| `leida` | boolean | Default `false` |
| `created_at` | timestamptz | `now()` |

### RLS

- `notificaciones_select_own` / `notificaciones_update_own` — cada usuario solo
  **lee y actualiza sus propias** filas (`usuario_id = auth.uid()`). Esto también
  rige qué eventos Realtime recibe cada cliente.
- `notificaciones_insert_own` — un usuario solo puede insertar notificaciones
  para sí mismo. **No** puede crear notificaciones para otros.
- `notificaciones_insert_service_role` — `service_role` (trigger / seed) puede
  insertar cualquier fila.

## 3. Generación por trigger (no desde el cliente)

Como la RLS impide crear notificaciones para *otros* usuarios, las notificaciones
las genera un **trigger `SECURITY DEFINER`** en la BD, no el frontend:

`after_solicitud_estado_changed` (`AFTER UPDATE ON solicitudes`,
`WHEN OLD.estado IS DISTINCT FROM NEW.estado`) inserta 1 fila por destinatario:

| Destinatario | Tipo | Condición |
|---|---|---|
| Residente de la solicitud | `estado_cambio` | El cambio NO lo hizo el propio residente (`auth.uid() <> residente_id`) |
| Técnico asignado | `asignacion` | `NEW.estado = 'asignada'` (técnico de la asignación más reciente) |
| Todos los admin activos | `alerta_rechazo` | Rechazo del residente: `OLD.estado='resuelta'` y `NEW.estado ∈ {en_progreso, pendiente}` |

El trigger envuelve la lógica en un bloque `exception when others` (best-effort):
una notificación fallida **nunca** revierte el cambio de estado.

Migración: `supabase/migrations/20260520152753_sprint6_notificaciones_realtime.sql`.

## 4. Realtime

- La tabla está en la publicación `supabase_realtime` y con `REPLICA IDENTITY FULL`
  (para que los eventos `UPDATE` traigan el valor anterior de `leida` y el cliente
  recalcule el contador).
- El cliente abre **una sola** suscripción por sesión al canal
  `notificaciones:{auth.uid()}` con filtro `usuario_id=eq.{uid}`, centralizada en
  `src/contexts/NotificacionesContext.tsx` (ver ADR-009).
- **Reconexión exponencial**: 1s, 2s, 4s, 8s, … máx 30s. Al (re)conectar se hace
  un refetch para recuperar eventos perdidos (mitiga el Riesgo R1: WiFi inestable).
- La autorización la dan las policies de `SELECT`: cada usuario solo recibe sus
  propias filas.

## 5. Email simulado (Edge Function `notificar-cambio-estado`)

- Tras un cambio de estado, el cliente invoca la función **fire-and-forget**: si
  Resend responde 4xx/5xx, el cambio de estado NO se revierte (el error queda en
  los logs de la función).
- **Modo dry-run**: si falta `RESEND_API_KEY`, la función responde `200` y loguea
  el cuerpo del email en vez de enviarlo. Es el modo por defecto en local y CI.
- **Modo real**: si `RESEND_API_KEY` está configurado (Supabase → Edge Functions →
  Secrets), envía el correo de verdad por Resend y registra en el log el id del
  envío (`Email REAL enviado…`).
- Remitente configurable con `RESEND_FROM_ADDRESS` (default `"Zity <no-reply@zity.site>"`).
  Debe pertenecer a un dominio **verificado** en Resend.

## 6. Centro de notificaciones (UI)

- **Campana** (`CampanaNotificaciones`) en la navbar de los 3 dashboards: badge de
  no leídas (máx `99+`) con pulse, dropdown con las últimas 10, navegación al
  detalle de la solicitud al hacer click (marca como leída), accesible (Tab/Enter,
  cierre con `Esc`, `aria-live`), ancho completo en móvil.
- **Página `/notificaciones`**: lista paginada (25/página) con filtro por estado y
  por rango de fechas, marcar como leída por fila y "Marcar todas" con modal de
  confirmación. Las acciones usan *optimistic update* con rollback + toast si falla.
- Marcar como leída **no** se registra en `audit_log` (no es acción crítica).

## 7. Variable de entorno

| Variable | Descripción | Desde |
|---|---|---|
| `RESEND_FROM_ADDRESS` | Remitente del email de cambio de estado (default `"Zity <no-reply@zity.site>"`) | Sprint 6 |

Configurar como Secret en GitHub Actions, Vercel y Supabase Edge Functions. Nunca
hardcodear en el código (ver `.env.example`).

## 8. Deuda técnica (futuros sprints)

- **Retención** (Sprint 11, privacidad): purgar notificaciones leídas a los 90 días
  y no leídas a los 180. Por ahora sin TTL (Riesgo R6).
- **Test E2E de Realtime** (Sprint 7): con Playwright, abrir 2 contextos y verificar
  que un cambio de estado dispara la notificación en < 3s.
- **Prueba de email real** (Sprint 7, Acción 2 Retro S6): enviar 1 email real desde
  staging a Gmail/Outlook/ProtonMail y validar la plantilla. Documentar el resultado
  en la sección siguiente.

### Prueba de email real

✅ **Realizada en el Sprint 6** (se adelantó la Acción 2 del Retro). Con
`RESEND_API_KEY` y `RESEND_FROM_ADDRESS="Zity <no-reply@zity.site>"` configurados
como secrets en Supabase (Edge Functions) y el dominio `zity.site` verificado en
Resend, un cambio de estado disparó el envío real: la Edge Function respondió
`200` (~2.1 s, llamada efectiva a Resend) y el correo llegó a la bandeja del
destinatario. Validación adicional opcional pendiente: revisar el render de la
plantilla en varios clientes (Gmail / Outlook / ProtonMail).

## 9. Referencias

- `src/lib/notificaciones.ts` — lógica pura + operaciones de datos.
- `src/contexts/NotificacionesContext.tsx` — suscripción Realtime centralizada.
- `src/components/shared/CampanaNotificaciones.tsx`, `src/pages/Notificaciones.tsx`.
- `supabase/functions/notificar-cambio-estado/index.ts` — email simulado.
- `docs/adr/009-realtime-notificaciones.md` — decisiones de arquitectura.
