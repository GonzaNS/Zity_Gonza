# Cómo ver lo implementado del Sprint 9

Guía sencilla — en palabras simples — para ver con tus propios ojos cada feature del
Sprint 9 (**"Facturación v2"**), que cierra el ciclo de cobro. Pensada para validar la
entrega sin leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido**](#el-recorrido).

---

## ¿Qué te entregó el Sprint 9?

El Sprint 8 abrió la facturación (emitir + ver). El Sprint 9 **cierra el ciclo de cobro**:

- El **admin marca una factura como pagada** (método + fecha) desde `/admin/facturacion`,
  y el **residente recibe una notificación en tiempo real** ("Tu factura de Luz fue
  registrada como pagada"). El badge pasa de ámbar a verde.
- Un **job diario** (06:00 America/Lima) marca solas las facturas **vencidas** (badge rojo)
  y envía un **recordatorio 3 días antes** del vencimiento (notificación + email).
- El **residente descarga el comprobante PDF** de cada factura pagada (con sello `PAGADO`).
- El admin ve una **tarjeta de totales del periodo** (Emitido / Cobrado / Pendiente / Vencido).
- Nuevo endpoint **`/health`** que cierra el último criterio de DoD v2.

---

## Antes de empezar

```bash
npm install
npm run seed:clean       # usuarios + facturas demo (mes pasado pagadas, mes actual pendientes)
npm run dev              # http://localhost:5173
```

Credenciales demo: **Admin** `carlos@zity-demo.com` / `Admin1234!` ·
**Residente** `laura@zity-demo.com` / `Residente1!`

> [!IMPORTANT]
> Las migraciones del Sprint 9 (`supabase/migrations/20260529120000_sprint9_facturacion_v2.sql`)
> deben estar aplicadas en Supabase, junto con la Edge Function `recordatorios-facturas`.

---

## El recorrido

### 1. El admin marca una factura como pagada

1. Login como **admin** → `/admin/facturacion`.
2. Pestaña **"Facturas emitidas"**: arriba, la **tarjeta de totales** del periodo
   (Emitido / Cobrado / Pendiente / Vencido) con selector de mes.
3. Click en una factura **pendiente** → se abre el **drawer** de detalle.
4. Botón **"Marcar como pagada"** → elige método (efectivo / transferencia / otro) y
   fecha (por defecto hoy) → **Confirmar pago**.
5. La tarjeta de totales **se recalcula al instante** (Cobrado sube, Pendiente baja).

> **Idempotencia (R3):** si marcas pagada dos veces la misma factura, la segunda vez
> responde *"La factura ya estaba pagada"* y no reescribe la fecha de pago.

### 2. El residente recibe la notificación y descarga su comprobante

1. En otro navegador, login como **residente** (Laura).
2. En la **campana** aparece *"Pago registrado: Electricidad…"* (Realtime, < 1.5 s).
   Click → abre el detalle de esa factura.
3. En `/residente/facturas`, la factura pagada tiene **badge verde** y un botón
   **"Descargar comprobante"** (también en el detalle).
4. Descarga el PDF: logo Zity, tus datos, desglose, número **F-2026-05-001**, método y
   fecha de pago, y el **sello `PAGADO`**.

### 3. Simula el avance del tiempo (recordatorios + vencidas)

```bash
npm run seed:tiempo
```

Este script (Acción 1 del Retro S9) reposiciona los vencimientos de las facturas demo y
ejecuta el job diario. Verás algo como:

```
→ {"fecha":"...","vencidas":3,"recordatorios":3}
```

- En la campana del residente aparece *"Tu factura de Agua vence en 3 días"*.
- Una factura pasa sola a **"vencida"** (badge rojo), filtrable con el filtro
  **"Vencidas"** en `/admin/facturacion`.

> **Idempotencia (R1):** vuelve a correr `npm run seed:tiempo` — el job no duplica el
> recordatorio (la segunda corrida del cron devuelve menos/0 recordatorios nuevos).

### 4. Verifica `/health`

Tras desplegar a staging:

```bash
curl -s https://<tu-deploy>/health
# → {"status":"ok","db":"ok","auth":"ok","storage":"ok","version":"…"}
```

Verifica DB + Auth + Storage sin exponer secretos. Cierra DoD v2.
Detalle en [`docs/ops/health.md`](../ops/health.md).

---

## Lo que pasa por dentro

- **Transición de pago**: RPC `registrar_pago_factura` (idempotente, audita en
  `audit_log`); el trigger `after_factura_paid` emite la notificación Realtime. (ADR-010)
- **Job diario**: `marcar_facturas_vencidas_y_recordatorios` (pg_cron 11:00 UTC = 06:00
  Lima), dos pasadas, zona `America/Lima`, idempotente vía `recordatorio_enviado`. (ADR-010)
- **Totales**: RPC `totales_facturacion(periodo)` suma en servidor (`numeric`), nunca en JS.
- **Comprobante**: `pdf-lib` en el cliente, solo facturas pagadas, reusa el `numero`. (ADR-011)
- **Tests**: 176 en verde; cobertura de `src/lib/facturas.ts` = 100 % líneas (gate ≥ 60 %).
