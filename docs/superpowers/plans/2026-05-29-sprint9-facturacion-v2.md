# Sprint 9 — Facturación v2 · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: usar superpowers:test-driven-development por tarea. Los pasos usan checkbox (`- [ ]`).

**Goal:** Cerrar el ciclo de cobro de Zity: el admin marca facturas como pagadas (con notificación Realtime), un job diario (pg_cron + Edge Function) marca las vencidas y envía recordatorios 3 días antes, el residente descarga su comprobante PDF, el admin ve los totales del periodo, y `/health` cierra DoD v2.

**Architecture:** La transición de pago y los cálculos de fecha/dinero viven en Postgres (RPCs `SECURITY DEFINER` + trigger + función de cron en zona `America/Lima`), siguiendo el patrón del S8 (`emitir_facturas_lote`). El frontend solo invoca RPCs y consume Realtime (patrón S6). El comprobante PDF se genera 100% en el cliente con `pdf-lib`. `/health` es una función serverless de Vercel.

**Tech Stack:** React 19 + Vite 8 + Tailwind 4 · Supabase (Postgres 17 + Auth + Storage + Realtime + pg_cron + pg_net) · Resend · `pdf-lib` (nuevo) · Vitest · Vercel.

**Proyecto Supabase destino:** `zity-br` (`bhficjchwnnyjnenbhom`) — confirmado por `.env` (`VITE_SUPABASE_URL`).

---

## Decisiones técnicas (resueltas en este plan)

1. **`registrarPagoFactura` = RPC servidor.** RPC `registrar_pago_factura` (idempotente, atómica, audita) + wrapper TS. Resuelve R3 (doble click / dos admins) en el servidor. Consistente con `emitir_facturas_lote`.
2. **Numeración ADR.** El PDF proyecta "ADR-009 (ciclo de cobro)" y "ADR-010 (PDF)", pero `009-realtime-notificaciones.md` ya existe. Se crean **ADR-010** (ciclo de cobro/jobs) y **ADR-011** (comprobante PDF), anotando la correspondencia.
3. **`docs/conventions.md` no existe** (el PDF lo asume del Retro S8) → se crea ahora con las decisiones acumuladas.
4. **`/health` en Vite+Vercel:** función serverless `api/health.ts` + rewrite `/health → /api/health` antes del catch-all SPA.
5. **`pg_net` no instalado** → se habilita en la migración. El email del cron/pago es fire-and-forget (best-effort, `EXCEPTION` lo absorbe); la notificación in-app Realtime NO depende de pg_net.
6. **Zona horaria del cron:** pg_cron corre en UTC. `06:00 America/Lima` (UTC-5) = `11:00 UTC` → cron `0 11 * * *`. Los cálculos de fecha usan `(now() AT TIME ZONE 'America/Lima')::date`.
7. **`seed:tiempo`** (Acción 1 Retro): script `scripts/seed-tiempo.js` + npm script, adelanta vencimientos para mostrar recordatorios/vencidas reproduciblemente.

---

## File Structure

**SQL (Supabase, vía MCP `apply_migration`):**
- `supabase/migrations/20260529xxxxxx_sprint9_facturacion_v2.sql` (Crear) — columnas, índice, audit_acciones, CHECK notif, RPC `registrar_pago_factura`, trigger `after_factura_paid`, función `marcar_facturas_vencidas_y_recordatorios`, cron, RPC `totales_facturacion`, habilitar pg_net.

**Edge Function (Supabase, vía MCP `deploy_edge_function`):**
- `supabase/functions/recordatorios-facturas/index.ts` (Crear) — email "vence en 3 días".

**Serverless (Vercel):**
- `api/health.ts` (Crear) — health check DB+Auth+Storage.
- `vercel.json` (Modificar) — rewrite `/health`.

**Dominio TS:**
- `src/lib/facturas.ts` (Modificar) — tipos + helpers puros + wrappers RPC.
- `src/lib/comprobante.ts` (Crear) — generación PDF con pdf-lib.
- `src/lib/audit.ts` (Modificar) — acción `registrar_pago_factura` + entidad `facturas`.
- `src/types/database.ts` (Modificar) — `TipoNotificacion` += `factura_pagada`, `factura_por_vencer`.

**Hooks:**
- `src/hooks/useFacturasAdmin.ts` (Crear) — listado admin con filtros + totales.

**UI:**
- `src/pages/admin/Facturacion.tsx` (Modificar) — tabs: listado/totales/drawer + emisión existente.
- `src/components/admin/facturacion/TarjetaTotales.tsx` (Crear)
- `src/components/admin/facturacion/TablaFacturasAdmin.tsx` (Crear)
- `src/components/admin/facturacion/DrawerFacturaAdmin.tsx` (Crear) — detalle + "Marcar como pagada".
- `src/pages/residente/Facturas.tsx` (Modificar) — botón "Descargar comprobante" + fecha/método pago.
- `src/components/shared/CampanaNotificaciones.tsx` (Modificar) — iconos + deep-link de los nuevos tipos.

**Config / tests / docs:**
- `vite.config.ts` (Modificar) — coverage gate `src/lib/facturas.ts`.
- `package.json` (Modificar) — dep `pdf-lib` + script `seed:tiempo`.
- `scripts/seed-tiempo.js` (Crear)
- `src/test/admin/facturas-pago.test.ts` (Crear)
- `src/test/admin/facturas-cron.test.ts` (Crear)
- `src/test/admin/facturas-totales.test.ts` (Crear)
- `src/test/admin/comprobante.test.ts` (Crear)
- `src/test/admin/facturas-helpers.test.ts` (Modificar) — nuevos helpers.
- `docs/conventions.md` (Crear)
- `docs/adr/010-ciclo-de-cobro-jobs.md` (Crear)
- `docs/adr/011-comprobante-pdf.md` (Crear)
- `docs/ops/health.md` (Crear)
- `docs/sprints/Sprint9_Como_Verlo.md` (Crear)

---

## FASE A — Migración 010 (Postgres)

### Task A1: Aplicar migración `sprint9_facturacion_v2`

SQL completo (idempotente, patrón S8). Se aplica con MCP `apply_migration(project_id, name='sprint9_facturacion_v2', query=<SQL>)`.

Contenido clave:
- `create extension if not exists pg_net with schema extensions;`
- `alter table facturas`: `fecha_pago date`, `metodo_pago text` (+CHECK null|efectivo|transferencia|otro), `registrado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL`, `recordatorio_enviado boolean NOT NULL DEFAULT false`.
- `create index if not exists facturas_estado_vencimiento_idx on facturas (estado, vencimiento);`
- `insert into audit_acciones (codigo, descripcion, requiere_detalle) values ('registrar_pago_factura','Registro de pago de una factura', true) on conflict do nothing;`
- Ampliar `notificaciones_tipo_check` (drop dinámico + recreate) con `factura_pagada`, `factura_por_vencer`.
- `registrar_pago_factura(p_factura_id uuid, p_metodo text, p_fecha date default current_date) returns jsonb` — admin only, idempotente (ya pagada → `{ok:true, ya_pagada:true}`), UPDATE + audit_log, retorna `{ok, ya_pagada, numero}`.
- Trigger `after_factura_paid()` AFTER UPDATE WHEN `OLD.estado distinct from NEW.estado and NEW.estado='pagada'` → notif `factura_pagada` (metadata.factura_id) + email fire-and-forget.
- `marcar_facturas_vencidas_y_recordatorios() returns jsonb` — dos pasadas, zona Lima, idempotente. Retorna `{vencidas, recordatorios, fecha}`.
- `cron.schedule('facturas-vencidas-recordatorios','0 11 * * *', $$ select public.marcar_facturas_vencidas_y_recordatorios(); $$)` (con unschedule previo idempotente).
- `totales_facturacion(p_periodo text) returns jsonb` — admin only, suma numeric por estado → `{emitido, cobrado, pendiente, vencido}`.

- [ ] Verificar con `execute_sql`: columnas nuevas existen; `get_advisors(security)` sin nuevos hallazgos.
- [ ] Configurar settings runtime (no en git) para email del cron: `alter database postgres set app.supabase_url = '<url>'; alter database postgres set app.service_role_key = '<key>';`

---

## FASE B — Dominio TS (`src/lib/facturas.ts`) [TDD]

### Task B1: Tipos y helpers puros

- Extender `Factura` con `fecha_pago: string | null`, `metodo_pago: FacturaMetodoPago | null`, `registrado_por: string | null`, `recordatorio_enviado: boolean`.
- `export type FacturaMetodoPago = 'efectivo' | 'transferencia' | 'otro'`.
- `LABEL_METODO_PAGO: Record<FacturaMetodoPago, string>`.
- `export type TotalesPeriodo = { emitido: number; cobrado: number; pendiente: number; vencido: number }`.
- `puedeMarcarsePagada(estado: FacturaEstado): boolean` → `estado === 'pendiente' || estado === 'vencida'`.
- `mensajeYaPagada()` constante.
- `fechaHoyISO()` (local, `YYYY-MM-DD`) para el default del modal.

TDD: test → fail → implement → pass → commit.

### Task B2: Wrappers RPC (`registrarPagoFactura`, `obtenerTotalesPeriodo`)

- `registrarPagoFactura(facturaId, metodo, fecha)` → `supabase.rpc('registrar_pago_factura', {...})`, devuelve `{ok, yaPagada, error?}`.
- `obtenerTotalesPeriodo(periodo)` → `supabase.rpc('totales_facturacion', {p_periodo})`, devuelve `TotalesPeriodo`.
- Tests mockean `supabase.rpc` (patrón `rls-facturas.test.ts`).

---

## FASE C — Edge Function `recordatorios-facturas`

### Task C1: Crear y desplegar

`supabase/functions/recordatorios-facturas/index.ts` (patrón `notificar-factura-nueva`): recibe `{factura_id, residente_id, tipo, monto, vencimiento}`, arma email "tu factura vence en 3 días", Resend o dry-run. Deploy con MCP `deploy_edge_function(verify_jwt:false)` (la invoca el trigger con service key vía pg_net, no un usuario).

---

## FASE D — Frontend Admin (`/admin/facturacion`)

### Task D1: Hook `useFacturasAdmin(filtro, periodo)`
Lista facturas (todas, RLS admin) con filtro de estado + trae totales vía `obtenerTotalesPeriodo`. Expone `recargar()` para recalcular tras un pago.

### Task D2: `TarjetaTotales` — emitido/cobrado/pendiente/vencido + selector de mes.

### Task D3: `TablaFacturasAdmin` — filas con residente, tipo, monto, vencimiento, badge estado (rojo vencida). Click → drawer.

### Task D4: `DrawerFacturaAdmin` — detalle + botón "Marcar como pagada" (solo pendiente/vencida) → modal método+fecha → `registrarPagoFactura` → toast + recarga totales. Botón deshabilitado tras click (R3).

### Task D5: Integrar en `Facturacion.tsx` con tabs "Facturas emitidas" (nuevo, default) / "Emitir nueva" (formulario existente).

---

## FASE E — Comprobante PDF (residente)

### Task E1: `src/lib/comprobante.ts`
`generarComprobantePDF(factura, residente)`: pdf-lib — `embedPng(logo)`, `embedFont(Helvetica/HelveticaBold)`, encabezado Zity, datos residente, desglose (tipo/periodo/monto), `numero`, método+fecha de pago, sello 'PAGADO'. `descargarComprobante(...)` crea Blob y dispara descarga. Solo si `estado==='pagada'`.
Test: número del PDF == `factura.numero`; lanza si no está pagada.

### Task E2: Botón "Descargar comprobante" en `CardFactura` (pagadas) y `DetalleFactura` + mostrar fecha/método de pago.

---

## FASE F — Notificaciones, audit, config

### Task F1: `types/database.ts` — `TipoNotificacion` += `factura_pagada`, `factura_por_vencer`.
### Task F2: `CampanaNotificaciones.tsx` — iconos + `handleAbrir` navega `/residente/facturas?id=` para los nuevos tipos (reusa `metadata.factura_id`).
### Task F3: `audit.ts` — `registrar_pago_factura` en `ACCIONES_AUDIT_COMPLETO` + `labelAccion`; `facturas` en `ENTIDADES_AUDIT_FILTRO`.
### Task F4: `vite.config.ts` — threshold `src/lib/facturas.ts` 60%.

---

## FASE G — /health

### Task G1: `api/health.ts` — verifica DB (`select 1`), Auth (`auth.getUser` con service role), Storage (`storage.listBuckets`/list). Responde `{status, db, auth, storage, version}`, sin secretos. `vercel.json` rewrite.
### Task G2: `docs/ops/health.md`.

---

## FASE H — Tests de integración (mocks, patrón S8)

- `facturas-pago.test.ts`: pendiente→pagada, vencida→pagada, doble pago idempotente, notificación al residente correcto.
- `facturas-cron.test.ts`: marca vencida; recordatorio hoy+3; doble ejecución = 1 recordatorio (idempotencia).
- `facturas-totales.test.ts`: cobrado+pendiente+vencido = emitido.
- `comprobante.test.ts`: número coincide; solo pagada.

---

## FASE I — Docs, seed, verificación

### Task I1: `docs/conventions.md`, `docs/adr/010-*`, `docs/adr/011-*`.
### Task I2: `scripts/seed-tiempo.js` + `package.json` script `seed:tiempo`.
### Task I3: `docs/sprints/Sprint9_Como_Verlo.md`.
### Task I4: Verificación final — `npm run typecheck`, `npm run lint`, `npm run test:coverage`, `npm run build`. `get_advisors`. Limpiar archivos temporales (`extract_pdf.py`, `sprint9_text.txt`).

---

## Self-Review — cobertura del spec

| PBI | Tarea(s) |
|-----|----------|
| HU-FACT-04 (marcar pagada + notif) | A1 (RPC+trigger), B1/B2, D4, H |
| HU-FACT-06 (vencida + filtros admin) | A1 (cron pasada 1), D1/D3, H |
| HU-FACT-08 (recordatorio 3 días) | A1 (cron pasada 2), C1, F2, H |
| PBI-S8-E01 (comprobante PDF) | E1, E2, H |
| PBI-S8-E02 (totales periodo) | A1 (RPC totales), B2, D2, H |
| Chore /health | G1, G2 |
| Edge cases (doble pago, doble cron, zona, RLS PDF) | A1, H |
| ADR-010/011 + conventions | I1 |
| seed:tiempo (Acción 1) | I2 |
