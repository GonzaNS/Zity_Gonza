# Deploy manual del módulo Facturación a staging

Documento creado en el **Chore-T técnico del Sprint 8** (0.5 h, P2): documentar el deploy manual del módulo Facturación. Prepara el camino para el chore de **CD del Sprint 10** que automatizará este flujo.

> [!NOTE]
> Este doc describe el deploy **manual** del módulo. Cuando el Sprint 10 entregue el workflow de CD, el deploy automático leerá esta lista como spec de verificación.

---

## TL;DR

```text
1. Aplicar las 4 migraciones SQL del Sprint 8 (en orden cronológico)
2. Desplegar Edge Function notificar-factura-nueva
3. (Opcional) Activar pg_net si quieres email fire-and-forget
4. Configurar settings de Postgres (app.supabase_url, app.service_role_key)
5. Verificación funcional con el flujo del E2E
```

---

## 1. Migraciones SQL

Aplicar **en orden cronológico** desde el SQL Editor de Supabase, o desde el CLI con `supabase db push`:

| Orden | Archivo | Qué crea |
|---|---|---|
| 1 | `20260527012000_sprint8_facturas.sql` | Tabla `facturas` + enums + 4 RLS policies + ampliación CHECK de `notificaciones.tipo` + trigger `after_factura_inserted` (v1) |
| 2 | `20260527013000_sprint8_facturas_lote.sql` | FK corregida (`usuarios` en vez de `perfiles`) + RPC `emitir_facturas_lote()` |
| 3 | `20260527014000_sprint8_facturas_numero.sql` | Columna `numero` + tabla `facturas_secuencia` + trigger `before_factura_numero` (asigna F-YYYY-MM-NNN) |
| 4 | `20260527015000_sprint8_notif_factura_realtime.sql` | Columna `notificaciones.metadata` + `after_factura_inserted` (v2 con email fire-and-forget via pg_net) |

> [!IMPORTANT]
> Si vas a copiar/pegar manualmente: las migraciones tienen `DROP POLICY IF EXISTS` y `CREATE OR REPLACE FUNCTION` para que sean idempotentes. Re-correrlas no rompe.

### Verificación post-migraciones

```sql
-- Comprobar que todo lo crítico está creado
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='facturas') AS tabla_facturas,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='facturas_secuencia') AS tabla_secuencia,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='emitir_facturas_lote') AS rpc_lote,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname='after_factura_inserted') AS trigger_func,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='facturas') AS num_policies,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='notificaciones' AND column_name='metadata') AS notif_metadata;
-- Esperado: todos true / 4 / true
```

---

## 2. Edge Function `notificar-factura-nueva`

### Deploy via CLI

```bash
cd supabase
supabase functions deploy notificar-factura-nueva --project-ref <project-ref>
```

### Deploy via MCP (lo que hicimos en este chat)

Subir el `index.ts` + el helper `_shared/auth.ts` con `verify_jwt: true` (mismo patrón que `notificar-cambio-estado` del Sprint 6).

### Verificación

```bash
# Edge Function debe responder 400 sin body (input validation activa)
curl -X POST \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  https://<project-ref>.supabase.co/functions/v1/notificar-factura-nueva
# → { "error": "Parámetros inválidos" }
```

### Configuración de secrets

En **Supabase Dashboard → Edge Functions → Manage Secrets**:

| Secret | Necesidad |
|---|---|
| `RESEND_API_KEY` | Opcional. Sin él, opera en dry-run (loguea en consola, responde 200). |
| `RESEND_FROM_ADDRESS` | Opcional. Default: `Zity <no-reply@zity.site>`. |
| `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectados por Supabase, no requieren configuración manual. |

---

## 3. (Opcional) `pg_net` para email fire-and-forget

El trigger `after_factura_inserted` v2 hace `net.http_post()` a la Edge Function. Sin `pg_net`, la notificación in-app sigue funcionando (el trigger envuelve la llamada en un EXCEPTION handler).

### Activación

1. **Supabase Dashboard → Database → Extensions** → buscar `pg_net` → Enable
2. Configurar settings de Postgres (necesarios para que el trigger sepa la URL del proyecto y la service role key):

```sql
ALTER DATABASE postgres SET app.supabase_url        = 'https://<project-ref>.supabase.co';
ALTER DATABASE postgres SET app.service_role_key    = '<SERVICE_ROLE_KEY>';
-- Reabrir conexiones para que tomen los nuevos settings.
```

> [!WARNING]
> Guardar la `service_role_key` en settings de Postgres es **necesario** para que el trigger pueda invocar la Edge Function con autorización válida. La key no se expone fuera de la BD.

### Verificación

```sql
-- Después de habilitar pg_net y configurar settings, emitir una factura test:
SELECT current_setting('app.supabase_url', true);     -- debe imprimir la URL
SELECT current_setting('app.service_role_key', true); -- debe imprimir la key (cuidado al loguear)

-- Y luego emitir una factura desde el admin:
INSERT INTO public.facturas (residente_id, tipo, monto, periodo, vencimiento)
VALUES ('<uuid-residente-test>', 'luz', 50, '2099-12', '2099-12-31');

-- En los logs de la Edge Function debe aparecer:
-- "----- DRY-RUN EMAIL [notificar-factura-nueva] -----"
-- (o el envío real de Resend si RESEND_API_KEY está configurado)
```

---

## 4. Verificación funcional del módulo

### Flujo end-to-end (espejo del E2E de Playwright)

1. Login como admin (`carlos@zity-demo.com` / `Admin1234!`)
2. Navegar a `/admin/facturacion`
3. Modo individual: seleccionar residente (Laura), tipo Luz, monto 120, periodo del mes actual
4. Click "Emitir factura" → toast verde "Factura emitida correctamente"
5. Logout → login como residente (`laura@zity-demo.com` / `Residente1!`)
6. Ver badge en la campana con `+1` notificación
7. Navegar a `/residente/facturas` → la nueva factura aparece como **Pendiente**
8. Click en la tarjeta → detalle con número `F-YYYY-MM-NNN`

### Smoke test del lote

```sql
-- Como admin (en sesión Supabase con JWT admin):
SELECT public.emitir_facturas_lote('agua', 40, '2099-12', '2099-12-31', 'Test masivo');
-- → {"emitidas": 3, "error": null}  (asumiendo 3 residentes activos en el seed)

-- Re-ejecutar el mismo lote debe fallar con mensaje claro:
SELECT public.emitir_facturas_lote('agua', 40, '2099-12', '2099-12-31', 'Test masivo');
-- → ERROR: Ya existe una factura de tipo "agua" para el período "2099-12" en uno o más residentes.
```

---

## 5. Rollback

Si algo sale mal y necesitas revertir el deploy del Sprint 8:

```sql
-- Orden de DROP (inverso al orden de aplicación)
DROP FUNCTION IF EXISTS public.after_factura_inserted() CASCADE;
DROP FUNCTION IF EXISTS public.before_factura_numero() CASCADE;
DROP FUNCTION IF EXISTS public.emitir_facturas_lote(text, numeric, text, date, text) CASCADE;
DROP TABLE IF EXISTS public.facturas CASCADE;
DROP TABLE IF EXISTS public.facturas_secuencia CASCADE;
DROP TYPE IF EXISTS public.factura_tipo;
DROP TYPE IF EXISTS public.factura_estado;

ALTER TABLE public.notificaciones DROP CONSTRAINT notificaciones_tipo_check;
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo IN ('estado_cambio','asignacion','nueva_solicitud','sistema','alerta_rechazo'));

ALTER TABLE public.notificaciones DROP COLUMN IF EXISTS metadata;
```

Y revertir la Edge Function:

```bash
supabase functions delete notificar-factura-nueva --project-ref <project-ref>
```

---

## Plan futuro (Sprint 10 — CD)

Cuando el chore de CD del Sprint 10 esté listo, esta lista será automatizada:

1. **GitHub Actions** detecta merge a `main`
2. **`supabase db push`** aplica migraciones nuevas automáticamente
3. **`supabase functions deploy`** sube las Edge Functions modificadas
4. **Smoke tests** corren contra staging para validar el deploy
5. **Slack notification** al equipo

Por ahora, este documento queda como spec de qué debe automatizarse.
