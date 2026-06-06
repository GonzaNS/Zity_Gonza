# ADR-015 — Integración pedido → factura mensual (tipo `tienda`)

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 11 |
| Fecha | Sprint 11, Semana 13 |
| Decisores | Scrum Team Zity |

> Nota de numeración: el artefacto del Sprint 11 llama "ADR-014" a esta decisión; el número
> real es **ADR-015** (ver la nota en [ADR-014](014-carrito-descuento-atomico.md)).

## Contexto

La HU-TIENDA-04 cierra el ciclo de la tienda: al **cierre de mes**, los pedidos `confirmado`
del periodo se consolidan como una **factura** que el residente paga junto con luz, agua y
pensión. Debíamos resolver:

1. **Reusar la infraestructura de facturas del S8/S9** (emisión, numeración `F-YYYY-MM-NNN`,
   notificación Realtime + email, totales del periodo) sin duplicarla.
2. **Idempotencia** — re-ejecutar el cierre no debe duplicar facturas ni re-facturar pedidos.
3. **Trazabilidad** — desde la factura se debe poder llegar a los pedidos que la originaron.
4. **Coincidencia de periodo** — el periodo del pedido y el de la factura deben usar la misma
   zona horaria (`America/Lima`), como el resto del ciclo de cobro del S9 (R4 del Sprint).

## Opciones evaluadas

### Cómo representar la compra en la facturación

| Opción | Pros | Contras |
|---|---|---|
| **A · Nuevo valor `tienda` en el enum `factura_tipo`** (seleccionada) | Reusa **toda** la infra de facturas (tabla, RLS, numeración, notificación, totales, vista del residente y del admin). El residente ve la compra junto a sus demás cargos. | `ALTER TYPE … ADD VALUE` no es reversible en una transacción; hay que aislarlo en su propia migración. |
| B · Tabla `cargos_tienda` aparte | Aísla el dominio. | Duplica numeración, notificación, totales y la vista del residente; el residente vería dos "bandejas" de cobro. |

### Granularidad de la factura

| Opción | Pros | Contras |
|---|---|---|
| **A · Una factura `tienda` por residente y periodo** (seleccionada) | Reusa el `UNIQUE(residente_id, tipo, periodo)` como candado de idempotencia; el residente recibe un solo cargo de tienda al mes. | Si llegan pedidos nuevos tras el primer cierre, hay que acumular al monto pendiente. |
| B · Una factura por pedido | Trazabilidad 1:1. | Rompe el `UNIQUE`; satura la bandeja del residente con muchas facturas pequeñas. |

### Quién dispara el cierre

| Opción | Pros | Contras |
|---|---|---|
| **A · `pg_cron` mensual + botón del admin** (seleccionada) | Automático el día 1 (06:00 Lima) y, además, el admin puede cerrar bajo demanda (demo / `seed:tiempo`). | Dos puntos de entrada a la misma función (resuelto: valida `admin` o sesión nula del cron). |
| B · Solo cron | Cero UI. | No hay forma de cerrar en una demo sin esperar al día 1. |
| C · Solo admin manual | Control total. | Se olvida; el PDF pide "al cierre de mes". |

## Decisión

- **`ALTER TYPE public.factura_tipo ADD VALUE IF NOT EXISTS 'tienda'`** en una migración
  **aislada** (en PostgreSQL un valor de enum recién creado no puede usarse en la misma
  transacción que lo crea).
- **`facturar_pedidos_periodo(p_periodo)`** (`SECURITY DEFINER`): por cada residente con pedidos
  `confirmado` del periodo, inserta **una** factura `tipo='tienda'` con `monto = Σ(pedidos.total)`,
  `vencimiento = hoy + 15 días`, descripción `"Compras en la tienda — N pedido(s)"`; marca esos
  pedidos `facturado` y setea `pedidos.factura_id`. **Idempotente**: solo toma `confirmado`; si la
  factura del periodo ya existe y sigue `pendiente`, acumula los nuevos; reusa el `UNIQUE`.
  Ejecutable por `admin` (UI) o `pg_cron` (sesión nula).
- **`pedidos.factura_id`** (`uuid REFERENCES facturas(id) ON DELETE SET NULL`) — enlace
  factura ↔ pedidos para el desglose desde el historial.
- **`pg_cron`** mensual `'0 11 1 * *'` (06:00 America/Lima del día 1) que factura el mes anterior.
- Los triggers `after_factura_inserted` / `after_factura_paid` extienden su `CASE` con
  `WHEN 'tienda' THEN 'Tienda'` → el `INSERT` de la factura dispara la **notificación Realtime**
  del S8 sin cambios. La **emisión manual** del admin **excluye** `tienda` (esas facturas solo
  nacen del cierre de pedidos, no se emiten a mano).

## Consecuencias

### Positivas

- **Cero duplicación** — la factura de tienda hereda numeración, notificación, totales del
  periodo y la vista del residente/admin de [ADR-007](007-modelo-facturas.md) / [ADR-010](010-ciclo-de-cobro-jobs.md).
- **Idempotente** — el `UNIQUE(residente_id, tipo, periodo)` + filtrar solo `confirmado` hacen
  que re-ejecutar el cierre sea seguro.
- **Trazable** — `pedidos.factura_id` lleva del pedido (historial) a su factura.
- **Periodo coherente** — todo en `America/Lima`, como el ciclo de cobro del S9.

### Negativas

- **`ADD VALUE` no reversible en transacción** — por eso vive en su propia migración.
- **Pedidos confirmados tras un cierre ya pagado** (caso borde improbable): se enlazan y marcan
  `facturado` pero no alteran una factura ya pagada; quedarían fuera del monto. Aceptable para el
  volumen del condominio; documentado en la función.

## Variables de entorno

No introduce variables nuevas. La notificación por email reusa la Edge Function
`notificar-factura-nueva` y sus secretos existentes (Resend).

## Evidencia

- **Migraciones:** `…_120000_sprint11_factura_tipo_tienda.sql` (enum),
  `…_120100_sprint11_carrito_esquema.sql` (`pedidos.factura_id` + triggers con `'tienda'`),
  `…_120300_sprint11_facturar_pedidos.sql` (función + cron), aplicadas a `zity-br`.
- **Idempotencia + notificación:** prueba en `zity-br` — un pedido confirmado de S/ 3.00 se
  facturó como `F-2026-06-002` (tipo `tienda`, monto 3.00, "Compras en la tienda — 1 pedido(s)"),
  el pedido pasó a `facturado` con `factura_id`, se creó **1 notificación** `factura_nueva`, y
  re-ejecutar el cierre devolvió `facturas_creadas: 0`.
- **Flujo completo (E2E manual):** residente confirma → admin cierra el periodo en `/admin/pedidos`
  → el pedido aparece `facturado` y los totales pasan de "Confirmado" a "Facturado".
- **no-PII:** los logs de la integración registran solo IDs (ver [`docs/privacidad/no-pii.md`](../privacidad/no-pii.md)).
