# Sprint 11 — Tienda interna v2 (carrito + integración con factura) · Design / Spec

> Estado: **Aprobado** (2026-06-06) · Deriva de `docs/sprints/Zity_Sprint11_Artefactos.pdf`
> Cierra el **Epic TIENDA-01** (catálogo S10 + carrito e integración con factura S11).
> Primera aplicación parcial de **DoD v3**.

## 1. Contexto

La Tienda v1 (S10) entregó el catálogo (`productos`) y modeló `pedidos`/`pedido_items`
con RLS pero **sin UI de carrito**. La v2 cierra el ciclo: el residente arma un carrito,
confirma el pedido (descuento **atómico** de stock, sin sobreventa) y, al cierre de mes,
el pedido se consolida como una **factura de tipo `tienda`** en sus cargos. El admin ve
todas las órdenes con filtros.

Estado real verificado en `zity-br` (Postgres 17) al iniciar:
- Migraciones aplicadas hasta `sprint10_historial_nota_inicial`.
- `factura_tipo = (luz, agua, pension, multa)` → falta `tienda`.
- `pedido_estado = (borrador, confirmado, facturado)` → completo.
- `pedidos` **sin** columna `factura_id`.
- 7 productos (6 disponibles), 0 pedidos, 1171 facturas, 16 residentes activos.

## 2. Decisiones tomadas (incluye respuestas del usuario)

| Tema | Decisión |
|---|---|
| Aplicación BD | Migraciones aditivas aplicadas a `zity-br` vía MCP **y** guardadas en `supabase/migrations/`. |
| Rigor de tests/CI | **Mínimo**: unitarios con mocks + E2E smoke local + concurrencia probada vía MCP como evidencia. CI (`ci.yml`) se mantiene (lint/typecheck/vitest). |
| UX del carrito | **Drawer lateral** + paso de confirmación; mini-carrito en el header del residente. |
| Cierre de periodo | `pg_cron` mensual **+** botón "Cerrar periodo" para el admin (demo / seed:tiempo). |
| Numeración ADR | **ADR-014 + ADR-015** (el `013-cd-staging.md` ya existe del S10; el PDF los llama 013/014). |
| Numeración migración | Timestamp real + comentario "Migración 012 (nominal)" (patrón del repo). |

## 3. Capa de base de datos (4 migraciones)

Orden y separación (la restricción de PG17 impide usar un valor de enum recién creado en
la misma transacción):

1. `sprint11_factura_tipo_tienda` — `ALTER TYPE public.factura_tipo ADD VALUE IF NOT EXISTS 'tienda'` (sola).
2. `sprint11_pedidos_factura_link` —
   - `ALTER TABLE public.pedidos ADD COLUMN factura_id uuid REFERENCES public.facturas(id) ON DELETE SET NULL` + índice `pedidos_factura_idx`.
   - `CREATE OR REPLACE` de `after_factura_inserted` y `after_factura_paid` extendiendo el `CASE NEW.tipo` con `WHEN 'tienda' THEN 'Tienda'`.
3. `sprint11_carrito_rpc` — RPCs `actualizar_item_carrito` y `confirmar_pedido` (§4).
4. `sprint11_facturar_pedidos` — función `facturar_pedidos_periodo` + job `pg_cron` mensual (§4).

## 4. Capa de backend (RPCs `SECURITY DEFINER`, patrón del proyecto)

Todas: `SET search_path`, validan rol/identidad con `auth.uid()` / `public.get_user_rol()`,
aritmética de montos 100% en SQL, `REVOKE`/`GRANT` explícitos, idempotencia donde aplica.

- **`actualizar_item_carrito(p_producto_id uuid, p_cantidad integer) → jsonb`**
  - Solo `residente`. Obtiene o crea el pedido `borrador` del residente (uno activo).
  - `p_cantidad > 0`: upsert del ítem con `precio_unitario` = `productos.precio` **leído en servidor**
    (ignora cualquier precio del cliente); valida `productos.activo` y `p_cantidad ≤ stock`.
  - `p_cantidad = 0`: elimina el ítem (y el pedido si queda vacío).
  - Recalcula `pedidos.total = Σ(cantidad·precio_unitario)` en SQL. Devuelve el carrito.

- **`confirmar_pedido(p_pedido_id uuid) → jsonb`** — núcleo atómico:
  - Valida que el pedido sea `borrador` y del propio residente; que tenga ≥ 1 ítem.
  - `SELECT … FOR UPDATE` de los productos del carrito (orden estable por `producto_id` → evita deadlocks).
  - Revalida `stock ≥ cantidad` por ítem; si **alguno** falla → `RAISE EXCEPTION` (revierte todo, nadie sobrevende), informando el producto que falló.
  - Descuenta stock, fija `total` (recalculado) y `periodo` (`America/Lima`, `YYYY-MM`), pasa a `confirmado`.
  - Devuelve `{ ok, pedido_id, total, periodo }`.

- **`facturar_pedidos_periodo(p_periodo text) → jsonb`** — cierre de mes:
  - Ejecutable por `admin` (UI) o por `pg_cron` (sin sesión). Valida: `admin` o `auth.uid() IS NULL`.
  - Por cada residente con pedidos `confirmado` del `p_periodo`: inserta **una** factura
    `tipo='tienda'` con `monto = Σ(pedidos.total)`, `vencimiento` = día 15 del mes siguiente
    (regla documentada), `descripcion` = "Compras en la tienda — N pedido(s)".
  - Marca esos pedidos `facturado` y setea `pedidos.factura_id`.
  - **Idempotente**: solo toma pedidos `confirmado`; reusa `UNIQUE(residente_id, tipo, periodo)`;
    re-ejecutar no duplica ni re-factura.
  - El `INSERT` dispara `after_factura_inserted` → notificación Realtime (reusa S8/S9).
  - Job `pg_cron` mensual (día 1, 11:00 UTC = 06:00 Lima) que factura el mes anterior.

Lectura de carrito/historial/admin: `SELECT` directo con RLS existente (embedding de `pedido_items`→`productos`).

## 5. Capa de frontend (React 19, patrones existentes)

- **`src/lib/pedidos.ts`** (módulo puro, testeable): tipos (`Pedido`+`factura_id`, `PedidoItem`,
  `PedidoConItems`, `CarritoItem`), `LABEL_PEDIDO_ESTADO`, `BADGE_PEDIDO_ESTADO`, helpers
  `subtotalItem`, `totalCarrito`, `unidadesCarrito`, `puedeAgregar(stock, enCarrito)`.
- **`src/contexts/CarritoContext.tsx`**: carga el `borrador` del residente; expone `items`,
  `unidades`, `total`, `agregar/cambiar/quitar` (→ `actualizar_item_carrito`), `confirmar`
  (→ `confirmar_pedido`), `recargar`. Optimista con rollback (patrón `NotificacionesContext`).
  Montado solo bajo rol residente.
- **`/residente/tienda`**: activar "Agregar" en `CardProducto`/`DetalleProductoModal`;
  control `− cantidad +` con tope=stock; **`CarritoDrawer`** (ítems, subtotales, total,
  "Confirmar pedido") + confirmación con resumen; **mini-carrito** en el header (ícono + badge + popover).
- **`/residente/tienda/historial`** (HU-07): lista (fecha, total, estado, nº ítems) + detalle
  (ítems, `precio_unitario`, total) + enlace a factura si `facturado`.
- **`/admin/pedidos`** (HU-08): tabla con filtros (residente / rango fecha / estado) + totales
  de periodo; ítem nuevo en `AdminShell`. RLS: solo admin (técnico sin acceso).
- **`src/lib/facturas.ts`**: añadir `'tienda'` a `FacturaTipo`, `LABEL_FACTURA_TIPO`, icono/badge.
  Las vistas de facturas (residente/admin) ya iteran tipos → muestran "Tienda".

## 6. Chore no-PII (DoD v3)

Auditar `RAISE WARNING/LOG`/`audit_log` de funciones de tienda y factura y `console.*` de las
edge functions de factura → garantizar **solo IDs** (`pedido_id`, `residente_id`, `factura_id`),
nunca nombres ni correos. Entregable: `docs/privacidad/no-pii.md` + checklist en PR.

## 7. Tests (nivel mínimo elegido)

- **Unitarios (Vitest + mock Supabase)**: helpers de `lib/pedidos.ts` (subtotales, total, unidades,
  topes, transiciones, labels) y `'tienda'` en `lib/facturas.ts`. Umbral de cobertura para módulos nuevos.
- **Concurrencia (evidencia, no CI)**: script/SQL vía MCP que lanza dos `confirmar_pedido`
  simultáneos por la última unidad → solo uno gana. Resultado citado en ADR-014.
- **E2E smoke (Playwright, local)**: `playwright.config.ts` + 1 spec `carrito → confirmar → historial`.
  `npm run test:e2e`. **No** es gate de CI.

## 8. Documentación

- **ADR-014** Carrito + descuento atómico de stock · **ADR-015** Integración pedido → factura (tipo tienda).
- `conventions.md`: "Ciclos de vida de estado" (pedido: borrador→confirmado→facturado; factura:
  pendiente→pagada/vencida) + "Tests de concurrencia para RPC de stock/saldo".
- `docs/privacidad/no-pii.md`; actualizar `docs/testing/e2e.md`; guía `docs/sprints/Sprint11_Como_Verlo.md`.

## 9. Desviaciones del PDF (transparencia)

1. **ADRs 014/015** (no 013/014): el `013` ya está ocupado por CD-staging del S10.
2. **E2E/concurrencia no son gate de CI** (el usuario eligió rigor "mínimo"): quedan como smoke
   local + evidencia probada vía MCP. La verificación de DoD v3 del Sprint lo reflejará con honestidad.

## 10. Plan por fases (verificación incremental)

1. **BD**: migraciones 1–4; aplicar a `zity-br`; probar `actualizar_item_carrito`/`confirmar_pedido`
   y la **concurrencia** vía SQL; probar `facturar_pedidos_periodo` (idempotencia).
2. **lib/pedidos** + tests unitarios (TDD).
3. **CarritoContext** + drawer + mini-carrito + "Agregar" (HU-03).
4. **Integración factura** + labels `tienda` (HU-04).
5. **Historial residente** (HU-07).
6. **Admin pedidos** (HU-08).
7. **Chore no-PII** + doc.
8. **Playwright smoke**.
9. **ADR-014/015 + conventions + e2e.md + Sprint11_Como_Verlo**.
10. **Verificación final**: `npm run lint`, `npm run typecheck`, `npm run test:run`/coverage, `npm run build`.

## 11. DoD v3 — cómo lo dejaremos

| Criterio | Estado al cierre |
|---|---|
| DoD v2 (lint, unit+integration, cobertura ≥60%, /health, secrets, tsc, build) | Cumplido |
| E2E del flujo crítico de tienda | Smoke local con Playwright (no gate CI, por decisión de alcance) |
| No-PII en logs (tienda y factura) | Cumplido (chore + doc) |
| Descuento atómico sin sobreventa | Cumplido + evidencia de concurrencia |
| ADR-014 + ADR-015 | Cumplido |
| OWASP / Lighthouse / RC | Programados S12 / S13 / S14 |
