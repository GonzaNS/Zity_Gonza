# ADR-014 — Carrito del residente y confirmación con descuento atómico de stock

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 11 |
| Fecha | Sprint 11, Semana 13 |
| Decisores | Scrum Team Zity |

> Nota de numeración: el artefacto del Sprint 11 llama "ADR-013" a esta decisión, pero el
> número 013 ya estaba tomado por [ADR-013 (CD a staging)](013-cd-staging.md) del Sprint 10.
> Se usa **ADR-014** (y [ADR-015](015-integracion-pedido-factura.md) para la integración con la factura).

## Contexto

El Sprint 11 (Tienda v2) cierra el Epic TIENDA-01: el residente arma un **carrito** y
**confirma** su pedido. Las tablas `pedidos` / `pedido_items` ya estaban modeladas en el S10
([ADR-012](012-modelo-tienda.md)), sin UI ni lógica. Restricciones a resolver:

1. **Sin sobreventa** — si dos residentes compran la última unidad a la vez, solo uno gana.
   El descuento de stock debe ser **atómico** (R1 del Sprint).
2. **El carrito sobrevive a recargar** — no puede vivir solo en memoria del navegador.
3. **Precio inmutable** — el `precio_unitario` de la línea es un snapshot del momento de
   pedir; un cambio de precio posterior no altera pedidos ya hechos. El residente **no**
   puede influir en el precio.
4. **Aritmética de montos en servidor** — convención del proyecto ([`conventions.md §1`](../conventions.md)).

## Opciones evaluadas

### Persistencia del carrito

| Opción | Pros | Contras |
|---|---|---|
| **A · Pedido `borrador` en BD** (seleccionada) | Sobrevive a recargar y a cambiar de dispositivo; deja el historial coherente; reusa `pedidos`/`pedido_items` y su RLS. | Una fila viva por residente mientras compra. |
| B · `localStorage` | Cero BD hasta confirmar. | Se pierde entre dispositivos; el precio/stock se desincroniza; duplica la validación en cliente. |
| C · Solo en memoria (estado React) | Simplísimo. | Se pierde al recargar (R3). |

### Descuento de stock al confirmar

| Opción | Pros | Contras |
|---|---|---|
| **A · `SELECT … FOR UPDATE` + `UPDATE … WHERE stock >= cantidad`** (seleccionada) | Bloqueo de fila por producto (orden estable por `producto_id` → sin deadlocks) y descuento condicional atómico: si no alcanza, `RAISE` revierte todo. Imposible sobrevender. | Requiere una RPC `SECURITY DEFINER`. |
| B · `UPDATE stock = stock - cantidad` sin guarda | Una línea. | Permite stock negativo (sobreventa). Inaceptable (R1). |
| C · Chequear stock en el cliente antes de confirmar | UX inmediata. | Carrera clásica: dos clientes leen el mismo stock y ambos confirman. |

### Mutaciones del carrito (agregar / cambiar / quitar)

| Opción | Pros | Contras |
|---|---|---|
| **A · RPC `actualizar_item_carrito`** (seleccionada) | Fija el `precio_unitario` desde el servidor, valida activo/stock y recalcula `total` en SQL; el cliente nunca manda precios ni totales. | Una RPC más. |
| B · INSERT/UPDATE directos vía RLS | Menos código de servidor. | El cliente tendría que calcular el total (viola §1) y podría mandar un `precio_unitario` arbitrario. |

## Decisión

Dos RPCs `SECURITY DEFINER` con `SET search_path`, validación de rol/identidad y aritmética en SQL:

- **`actualizar_item_carrito(p_producto_id, p_cantidad)`** — obtiene o crea el pedido
  `borrador` del residente (uno activo); `cantidad>0` hace upsert del ítem con
  `precio_unitario = productos.precio` (leído en servidor) validando `activo` y `cantidad ≤ stock`;
  `cantidad=0` lo quita (y borra el borrador si queda vacío). Recalcula `pedidos.total`.
- **`confirmar_pedido(p_pedido_id)`** — valida que el borrador sea del propio residente y tenga
  ítems; `SELECT … FOR UPDATE OF pr` de los productos (orden por `producto_id`); por cada ítem
  `UPDATE productos SET stock = stock - cantidad WHERE id = … AND activo AND stock >= cantidad`,
  y si `NOT FOUND` → `RAISE EXCEPTION` (revierte todo). Fija `total`, `periodo`
  (`America/Lima`) y estado `confirmado`. **Idempotente**: un pedido ya confirmado/facturado no
  se reprocesa.

### Cambios de esquema

- `ALTER TABLE pedido_items ADD CONSTRAINT pedido_items_pedido_producto_key UNIQUE (pedido_id, producto_id)`
  — una línea por producto, habilita el `ON CONFLICT` del upsert.
- Flag de sesión `zity.venta_en_curso`: `confirmar_pedido` lo activa (`set_config(..., true)`)
  para que el trigger de auditoría `log_producto_cambio` **no** registre el descuento por venta
  como un `editar_producto` del residente (esa trazabilidad la lleva el evento `confirmar_pedido`).

### Ciclo de vida del pedido

`borrador` (carrito activo, uno por residente) → `confirmado` (stock descontado) →
`facturado` (consolidado en la factura, [ADR-015](015-integracion-pedido-factura.md)).
Documentado en [`conventions.md`](../conventions.md) (Ciclos de vida de estado).

## Consecuencias

### Positivas

- **Sin sobreventa, por diseño** — el `FOR UPDATE` serializa y el `UPDATE` condicional garantiza
  que el stock nunca baje de 0, incluso con confirmaciones simultáneas.
- **Carrito robusto** — persiste como `borrador`; recargar o cambiar de dispositivo no lo pierde.
- **Precio y total confiables** — fijados en el servidor; el cliente solo muestra.
- **Sin migración estructural nueva de las tablas** — solo un `UNIQUE` y las RPCs (las tablas son del S10).

### Negativas

- **Un borrador vivo por residente** mientras compra (se borra solo al vaciarse o al confirmar).
- **El descuento de stock por venta no aparece en la auditoría del catálogo** (es intencional;
  se audita como `confirmar_pedido`). Si se quisiera trazar el stock por venta, habría que un
  movimiento de inventario aparte (fuera del alcance del S11).

## Evidencia

- **Migraciones:** `supabase/migrations/20260606120100_sprint11_carrito_esquema.sql` (UNIQUE + flag)
  y `20260606120200_sprint11_carrito_rpc.sql` (RPCs), aplicadas a `zity-br`.
- **No-sobreventa (concurrencia):** prueba ejecutada en `zity-br` — producto con `stock=1`, dos
  residentes con el ítem en su carrito; el primero confirma (`stock → 0`), el segundo recibe
  *"Sin stock suficiente"* y `stock_final = 0` (no `-1`). El `FOR UPDATE` serializa las dos
  confirmaciones aunque lleguen a la vez.
- **E2E smoke:** `e2e/tests/carrito-pedido.spec.ts` (carrito → confirmar → historial),
  verificado en navegador. Smoke local (no gate de CI por alcance del S11; ver [`docs/testing/e2e.md`](../testing/e2e.md)).
- **Unitarios:** `src/test/tienda/pedidos-helpers.test.ts` (subtotales, total, unidades, tope de stock).
