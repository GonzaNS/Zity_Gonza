# Setup de Supabase — extensiones que requieren activación manual

Documento creado como **Acción 3 del Retro del Sprint 7**: cada vez que clonas el repo o levantas un entorno nuevo de Supabase, hay un puñado de pasos que **no se pueden automatizar con migraciones SQL** porque dependen del panel web de Supabase.

> [!IMPORTANT]
> Si en un sprint futuro alguien clona el repo desde cero, debería poder activar todo en ~5 minutos siguiendo este documento.

---

## TL;DR

```text
1. Crear proyecto Supabase (si es nuevo)
2. Habilitar extensiones: pg_cron
3. Correr todas las migraciones de supabase/migrations/ en orden
4. Programar los cron jobs (sección abajo)
5. Configurar Storage buckets (ver ADR-005)
6. Configurar Edge Functions secrets (RESEND_API_KEY, etc.)
7. Ejecutar `npm run seed` para poblar la BD
```

---

## Extensiones Postgres a habilitar manualmente

Estas extensiones **no se activan con `CREATE EXTENSION` en una migración** dentro del free tier — Supabase requiere activarlas desde el panel.

### `pg_cron` — Sprint 7

**Para qué:** ejecutar `refresh_metricas_on_demand()` cada hora y mantener la vista materializada `vw_metricas_solicitudes` fresca.

**Activación:**

1. **Supabase Dashboard → Database → Extensions**
2. Buscar `pg_cron`
3. Clic en **Enable**
4. Una vez habilitada, abrir el **SQL Editor** y ejecutar:

```sql
-- Programar el refresh horario
SELECT cron.schedule(
  'refresh-metricas-hourly',   -- nombre del job
  '0 * * * *',                  -- cada hora en punto
  $$SELECT refresh_metricas_on_demand()$$
);

-- Verificar que el job quedó registrado
SELECT jobid, jobname, schedule, command FROM cron.job;
```

**Para desactivarlo (si necesitas pausar el refresh):**

```sql
SELECT cron.unschedule('refresh-metricas-hourly');
```

**Para inspeccionar las últimas corridas:**

```sql
SELECT runid, jobid, status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'refresh-metricas-hourly')
ORDER BY start_time DESC
LIMIT 10;
```

**Fallback si `pg_cron` no está disponible:** el hook [`useMetricasMantenimiento`](../src/hooks/useMetricasMantenimiento.ts) tiene una heurística que dispara `refresh_metricas_on_demand()` cuando detecta que `vista_refreshed_at` tiene más de 1 hora. El panel funciona incluso sin `pg_cron`, solo que el refresh se hace al primer acceso del admin (vs. cada hora en background).

---

## Migraciones — orden de ejecución

Aplicar **en orden cronológico** los archivos de `supabase/migrations/` usando el SQL Editor (copiar/pegar) o el Supabase CLI.

| Sprint | Archivo | Qué crea |
|---|---|---|
| 6 | `20260520152631_sprint6_audit_acciones.sql` | Audit log v2 |
| 6 | `20260520152753_sprint6_notificaciones_realtime.sql` | Notificaciones Realtime |
| 7 | `20260526183900_sprint7_metricas_mantenimiento.sql` | RPC `get_metricas_mantenimiento` |
| 7 | `20260526190700_sprint7_graficas_mantenimiento.sql` | RPC `get_graficas_mantenimiento` |
| 7 | `20260526201500_sprint7_export_csv.sql` | RPC `export_solicitudes_csv` |
| 7 | `20260527010000_sprint7_vw_metricas_solicitudes.sql` | Vista materializada + `refresh_metricas_on_demand` + sobreescribe RPCs de S7 para leer la vista |
| 8 | `20260527012000_sprint8_facturas.sql` | Tabla `facturas` + RLS |
| 8 | `20260527013000_sprint8_facturas_lote.sql` | RPC para emitir en lote |
| 8 | `20260527014000_sprint8_facturas_numero.sql` | Numeración correlativa |
| 8 | `20260527015000_sprint8_notif_factura_realtime.sql` | Notificación al residente |

> [!NOTE]
> La migración `20260527010000_sprint7_vw_metricas_solicitudes.sql` **sobreescribe** los RPCs de las migraciones `20260526183900` y `20260526190700` para que lean de la vista materializada en lugar de calcular en vivo. Asegúrate de aplicarla **después** de las dos anteriores.

---

## Storage Buckets — Sprint 3

Ya cubiertos por su migración propia (`sprint3_storage_solicitudes_fotos_bucket`). Detalle en [ADR-005](adr/005-storage.md) y [docs/storage.md](storage.md).

Bucket actual: `solicitudes-fotos` (privado, 5 MB max, JPEG/PNG).

---

## Edge Functions — Secrets a configurar

Las Edge Functions de Supabase (Sprint 2+, Sprint 6) leen secrets que deben configurarse en **Supabase Dashboard → Edge Functions → Manage Secrets**.

| Secret | Sprint | Para qué |
|---|---|---|
| `RESEND_API_KEY` | 2 | Envío de emails transaccionales (Resend) |
| `RESEND_FROM_ADDRESS` | 6 | Remitente del email de cambio de estado |

> [!NOTE]
> Si `RESEND_API_KEY` está ausente, las Edge Functions operan en **dry-run** (loguean el email en vez de enviarlo). Eso es el modo por defecto en local y CI.

---

## Variables de entorno del frontend

Ver [`.env.example`](../.env.example) para la lista completa. Las clave públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) van en `.env.local`. La `SUPABASE_SERVICE_ROLE_KEY` solo se usa en Edge Functions y en `scripts/seed.js` — nunca en el frontend.

Para CI, configurar como GitHub Secrets:

| Secret | Usado en |
|---|---|
| `VITE_SUPABASE_URL` | `.github/workflows/e2e.yml` (workflow E2E) |
| `VITE_SUPABASE_ANON_KEY` | `.github/workflows/e2e.yml` |
| `E2E_RESIDENTE_EMAIL` | `.github/workflows/e2e.yml` (opcional; default `laura@zity-demo.com`) |
| `E2E_RESIDENTE_PASSWORD` | `.github/workflows/e2e.yml` (opcional; default `Residente1!`) |

---

## Validación post-setup

Después de seguir todos los pasos, verifica que todo está conectado:

```bash
# 1. Migraciones aplicadas
psql $SUPABASE_DB_URL -c "\\dt public.*"
# Deberías ver: solicitudes, usuarios, audit_log, historial_estados, facturas, ...

# 2. Vista materializada existe y tiene datos
psql $SUPABASE_DB_URL -c "SELECT refreshed_at FROM vw_metricas_solicitudes;"

# 3. pg_cron job registrado
psql $SUPABASE_DB_URL -c "SELECT jobname, schedule FROM cron.job;"

# 4. Seed corre limpio
npm run seed:clean
```

Si llegas hasta acá sin errores, el entorno está listo. El admin puede abrir `/admin/metricas` y ver los KPIs reales del seed.

---

## Sprints futuros

Cuando un Sprint requiera una extensión nueva de Postgres (`pg_net`, `pg_graphql`, etc.) que no se pueda activar con `CREATE EXTENSION` en una migración, **agregarla a la sección "Extensiones a habilitar manualmente"** de este documento como parte del DoR del Sprint.

Variables proyectadas (del PDF del Sprint 7):

- **Sprint 10 (CD):** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
- **Sprint 12 (Push):** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
