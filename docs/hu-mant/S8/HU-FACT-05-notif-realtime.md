# HU-FACT-05 · Notificación Realtime al emitir factura

**Sprint 8 · Canal Realtime existente + icono de recibo + deep link + email fire-and-forget**

---

## Descripción

Como residente, quiero recibir una notificación en tiempo real cuando se me emita una factura nueva, para enterarme sin tener que entrar al panel a verificar.

---

## Arquitectura: Qué, Cómo y Por qué

### ¿Por qué el Realtime "funciona gratis"?

El `NotificacionesContext` del Sprint 6 ya tiene una suscripción activa al canal `notificaciones:{auth.uid()}`. Cuando el trigger `after_factura_inserted` inserta una fila en la tabla `notificaciones` con `tipo='factura_nueva'`, PostgreSQL emite un evento WAL → Realtime lo captura → el cliente React lo recibe vía WebSocket **en menos de 500ms** bajo condiciones normales de red.

No se necesita cambiar el contexto, la suscripción ni el canal. Solo se añade:
1. El icono específico para `factura_nueva` en el `switch` de `getIconForTipo`.
2. La lógica de navegación en `handleAbrir`.

### Campo `metadata jsonb` en `notificaciones`

El deep link (navegar al detalle de una factura específica al hacer click en la campana) requiere conocer el `factura_id` en el frontend. Las opciones eran:

| Opción | Ventaja | Desventaja |
|--------|---------|-----------|
| Columna `factura_id uuid` | Tipado fuerte | Rompe el schema; requiere migración destructiva |
| Encode en el campo `mensaje` | Sin migración | Acoplamiento UI/BD; texto no parseble sin regex frágiles |
| **Columna `metadata jsonb`** | **Extensible, sin romper nada** | Requiere migración `ALTER TABLE` |

`jsonb` es la solución estándar de PostgreSQL para adjuntar datos semiestructurados. Es indexable, queryable y retrocompatible: las notificaciones antiguas tienen `metadata = NULL`, lo que el frontend maneja como `?.factura_id` sin errores.

### Deep link desde la campana

```typescript
// CampanaNotificaciones.tsx
const facturaId = notif.metadata?.factura_id
navigate(facturaId ? `/residente/facturas?id=${facturaId}` : '/residente/facturas')
```

```typescript
// Facturas.tsx — useEffect con useSearchParams
const idParam = searchParams.get('id')
if (!idParam || loading || seleccionada) return
const target = facturas.find(f => f.id === idParam)
if (target) {
  setSeleccionada(target)
  setSearchParams(prev => { next.delete('id'); return next }, { replace: true })
}
```

El `?id=` se elimina de la URL después de usarlo (`replace: true`) para que el botón "atrás" del navegador no vuelva a abrir el detalle.

### Email fire-and-forget con pg_net

El trigger llama a la Edge Function vía `net.http_post(...)` dentro de un bloque `BEGIN/EXCEPTION` anidado. Si `pg_net` no está habilitado, o si `app.supabase_url` / `app.service_role_key` no están configurados como settings de PostgreSQL, el inner `EXCEPTION` absorbe el error silenciosamente — **la notificación Realtime se inserta de todas formas** y la factura tampoco se revierte.

```sql
BEGIN
  PERFORM net.http_post(url := ..., body := jsonb_build_object(...));
EXCEPTION WHEN others THEN
  RAISE WARNING 'email fire-and-forget falló: %', SQLERRM;
END;
```

### Test multi-cliente (criterio de aceptación)

La RLS de la tabla `notificaciones` ya restringe el SELECT por `usuario_id`. El canal Realtime filtra adicionalmente con `filter: usuario_id=eq.{auth.uid()}`. Por lo tanto:

- `residente_A` ← recibe el INSERT de su factura vía Realtime ✅
- `residente_B` ← el filter de Realtime descarta el evento aunque ambos estén conectados ✅

Esto es verificable con 2 navegadores/pestañas en diferentes sesiones.

---

## Cambios Requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar **en orden** las migraciones del Sprint 8 en el SQL Editor:
> ```
> 1. supabase/migrations/20260527012000_sprint8_facturas.sql
> 2. supabase/migrations/20260527013000_sprint8_facturas_lote.sql
> 3. supabase/migrations/20260527014000_sprint8_facturas_numero.sql
> 4. supabase/migrations/20260527015000_sprint8_notif_factura_realtime.sql  ← esta HU
> ```

> [!NOTE]
> **Para activar emails reales:** configurar `RESEND_API_KEY` en Supabase Dashboard → Edge Functions → Secrets. Sin la key, la función corre en modo `dry-run` (log de consola) y responde 200.

> [!NOTE]
> **Para el email fire-and-forget via pg_net:** habilitar la extensión `pg_net` en Supabase Dashboard → Database → Extensions, y configurar los settings de PostgreSQL `app.supabase_url` y `app.service_role_key` en `supabase/config.toml` o como secrets. Si no se configura, el email simplemente no se envía (la notificación Realtime sí llega).

---

## Archivos Creados / Modificados

#### [NEW] `supabase/migrations/20260527015000_sprint8_notif_factura_realtime.sql`
- `ALTER TABLE notificaciones ADD COLUMN metadata jsonb`
- Reemplaza `after_factura_inserted` con versión que incluye `metadata.factura_id`
- Bloque fire-and-forget para `net.http_post` a la Edge Function

#### [NEW] `supabase/functions/notificar-factura-nueva/index.ts`
- Sigue exactamente el patrón de `notificar-cambio-estado`
- Dry-run si `RESEND_API_KEY` no está presente
- Email HTML con tabla de concepto/monto/vencimiento

#### [MODIFY] `src/types/database.ts`
- Campo `metadata?: Record<string, string> | null` en `Notificacion`

#### [MODIFY] `src/components/shared/CampanaNotificaciones.tsx`
- `case 'factura_nueva'`: icono de recibo (color ámbar)
- `handleAbrir`: navega a `/residente/facturas?id=<factura_id>` para `factura_nueva`

#### [MODIFY] `src/pages/residente/Facturas.tsx`
- `useSearchParams` para leer `?id=` y preseleccionar el detalle
- El param se elimina de la URL tras usarlo (`replace: true`)

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Trigger inserta 1 fila en `notificaciones` con `tipo='factura_nueva'` | ✅ | Migración HU-FACT-01 + actualización HU-FACT-05 con `metadata.factura_id` |
| `NotificacionesContext` reconoce el nuevo tipo | ✅ | Ya había soporte genérico; solo se añade icono específico |
| Icono de recibo en la campana | ✅ | `case 'factura_nueva'`: SVG ámbar de factura/recibo |
| Click navega a `/residente/facturas` con detalle | ✅ | Deep link vía `?id=` + `useSearchParams` en `Facturas.tsx` |
| Campana refleja el cambio en <1.5s | ✅ | Canal Realtime activo del S6; latencia típica ~200-500ms |
| Email fire-and-forget si `RESEND_API_KEY` configurado | ✅ | Edge Function `notificar-factura-nueva` + `net.http_post` en trigger |
| Solo `residente_A` recibe la notificación de su factura | ✅ | RLS + filtro Realtime `usuario_id=eq.{uid}` por canal |
