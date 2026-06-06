# Cómo ver lo implementado del Sprint 11

Guía sencilla — en palabras simples — para ver con tus propios ojos cada feature del
Sprint 11 (**"Tienda interna v2 — carrito + integración con la factura"**). Pensada para
validar la entrega sin leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido**](#el-recorrido) y mira los pasos 1–3.

---

## ¿Qué te entregó el Sprint 11?

El Sprint 10 dejó el **catálogo** de la tienda. El Sprint 11 **cierra el ciclo** (Epic
TIENDA-01) y aplica por primera vez la **DoD v3**:

- **Carrito del residente** (`/residente/tienda`): agrega productos (con tope = stock), un
  **mini-carrito** en el header con badge de unidades, un **drawer** con subtotales y total, y
  **confirma** el pedido. Al confirmar, el **stock se descuenta de forma atómica** (sin
  sobreventa) y el carrito queda vacío.
- **Integración con la factura**: al **cierre de mes**, los pedidos confirmados se consolidan en
  una **factura de tipo "tienda"** que el residente paga junto a luz, agua y pensión. Reusa la
  notificación y los totales del módulo de facturas.
- **Historial de pedidos** (`/residente/tienda/historial`): fecha, estado, total y desglose;
  enlace a la factura si ya fue facturado.
- **Vista admin de pedidos** (`/admin/pedidos`): todas las órdenes con filtros (residente, rango
  de fecha, estado), totales del periodo y botón **"Cerrar periodo"**.
- **Chore no-PII (DoD v3)**: los logs de tienda y factura registran solo IDs (sin nombres ni
  correos). Ver [`docs/privacidad/no-pii.md`](../privacidad/no-pii.md).
- **Primer E2E real del flujo crítico** (carrito → confirmar → historial) con Playwright.

---

## Antes de empezar

```bash
npm install
npm run seed           # usuarios base + facturas demo (incluye 6-7 productos de tienda)
npm run dev            # http://localhost:5173
```

Credenciales demo: **Admin** `carlos@zity-demo.com` / `Admin1234!` ·
**Residente** `laura@zity-demo.com` / `Residente1!`. El resto del elenco usa **`Demo1234!`**.

> [!IMPORTANT]
> Las migraciones del Sprint 11 deben estar aplicadas en Supabase (ya lo están en `zity-br`):
> `…_sprint11_factura_tipo_tienda.sql`, `…_sprint11_carrito_esquema.sql`,
> `…_sprint11_carrito_rpc.sql` y `…_sprint11_facturar_pedidos.sql`.

---

## El recorrido

### 1. El residente arma el carrito y confirma (`/residente/tienda`)

1. Login como **residente** (Laura) → header **"Tienda"**.
2. En cualquier producto disponible, pulsa **"Agregar"**: el botón se vuelve un control
   **`− cantidad +`** (no deja pasar del **stock**) y el **mini-carrito** del header muestra el
   badge con las unidades. Los productos **agotados** muestran "Agotado" deshabilitado.
3. Abre el **mini-carrito** (ícono 🛒) → popover con el subtotal → **"Ver carrito"**.
4. En el **drawer**: ajusta cantidades, ve el subtotal por ítem y el **total**, y pulsa
   **"Confirmar pedido"** → un resumen → **"Confirmar pedido"**.
5. El stock baja, el **carrito queda vacío** y aparece un aviso de confirmación.

### 2. El historial de pedidos (`/residente/tienda/historial`)

1. En el header, **"Mis pedidos"**.
2. Verás el pedido recién confirmado con **fecha, estado (Confirmado), nº de ítems y total**.
3. Ábrelo: el **desglose** muestra producto, cantidad y `precio_unitario` (el precio del momento
   de pedir). Cuando esté facturado, aparece un enlace a su **factura de tienda**.

### 3. El admin ve las órdenes y cierra el periodo (`/admin/pedidos`)

1. Login como **admin** → menú lateral **"Pedidos"**.
2. Verás la tabla con **todas las órdenes** (residente, fecha, estado, ítems, total), los
   **totales del periodo** (Confirmado / Facturado) y **filtros** por estado, residente y fecha.
3. Pulsa **"Cerrar periodo"** → elige el periodo (por defecto el actual) → **"Cerrar periodo"**.
4. El pedido de Laura pasa a **"Facturado"** y su monto se mueve de *Confirmado* a *Facturado*.

> El cierre también corre solo cada mes (job `pg_cron` el día 1, 06:00 America/Lima). El botón
> sirve para la demo y para cerrar bajo demanda.

### 4. La factura de tienda en la bandeja del residente (`/residente/facturas`)

1. Vuelve como **residente** → **"Mis facturas"**.
2. Junto a luz, agua y pensión, verás una factura de tipo **"Tienda"** con el total de tus
   compras del mes y su notificación correspondiente (campana 🔔).

### 5. La prueba de no-sobreventa (descuento atómico)

El descuento de stock es **atómico**: si dos residentes compran la última unidad a la vez, solo
uno gana y nadie sobrevende. Se validó con una prueba de concurrencia contra la BD (producto con
`stock=1`, dos confirmaciones simultáneas → una gana, la otra recibe *"Sin stock suficiente"*,
`stock final = 0`). Detalle en [ADR-014](../adr/014-carrito-descuento-atomico.md).

### 6. El E2E del flujo crítico (smoke local) y los logs sin PII

```bash
npm run test:e2e:install   # primera vez: descarga Chromium
npm run test:e2e           # corre e2e/tests/carrito-pedido.spec.ts
```

Recorre login → carrito → confirmar → historial. Es un **smoke local** (no gate de CI por
alcance del S11). Los logs de tienda y factura registran **solo IDs**
([`docs/privacidad/no-pii.md`](../privacidad/no-pii.md)).

---

## Lo que pasa por dentro

- **Carrito**: el pedido se persiste como `borrador` en BD (sobrevive a recargar). Las mutaciones
  pasan por la RPC `actualizar_item_carrito` (fija el precio en el servidor y recalcula el total
  en SQL). (ADR-014)
- **Confirmación atómica**: `confirmar_pedido` usa `SELECT … FOR UPDATE` + `UPDATE … WHERE stock
  >= cantidad`; si algún ítem no alcanza, revierte todo. (ADR-014)
- **Integración factura**: `facturar_pedidos_periodo` consolida los pedidos `confirmado` del
  periodo en una factura `tipo='tienda'` (idempotente, reusa `UNIQUE(residente_id,tipo,periodo)`);
  `pedidos.factura_id` enlaza factura ↔ pedidos; el `INSERT` dispara la notificación del S8. (ADR-015)
- **Front**: `CarritoContext` (estado global del borrador) + `CarritoDrawer` + `MiniCarrito`;
  helpers puros en `src/lib/pedidos.ts` (tests en `src/test/tienda/pedidos-helpers.test.ts`).
- **no-PII (DoD v3)**: se limpiaron los logs de las Edge Functions de factura (ya no registran el
  correo del residente, solo IDs).
- **Ciclos de vida** (pedido y factura) documentados en [`conventions.md §10`](../conventions.md).
