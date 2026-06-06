# Convenciones del proyecto Zity

> Fuente de verdad de las decisiones recurrentes del equipo (creado en el Retro S8,
> alimentado en cada Retrospective y revisado en el Refinement). Cuando una decisión
> se re-discute en más de un Sprint, se eleva aquí a estándar.

## 1. Dinero: `numeric(10,2)` y suma en servidor

- Todos los montos se almacenan como `numeric(10,2)` en Postgres (nunca `float`).
- **La aritmética de montos se hace 100% en el servidor** (RPCs / SQL), nunca en JS.
  El front solo formatea para mostrar. Ejemplo: `totales_facturacion(periodo)` suma
  por estado en SQL y devuelve los totales ya calculados.
- Motivo: evita errores de redondeo de punto flotante y mantiene una sola fuente de
  verdad para los importes.

## 2. Zona horaria: `America/Lima` en jobs de fecha

- **Todo cálculo de fecha de un job/cron corre en `America/Lima` (UTC-5), no en UTC.**
  Patrón: `(now() AT TIME ZONE 'America/Lima')::date`.
- Aplica a: marcado de facturas `vencida` (`vencimiento < hoy_lima`), recordatorios
  (`vencimiento = hoy_lima + 3`) y al default de `fecha_pago`.
- Motivo (Retro S9): calcular en UTC adelantaba/atrasaba el vencimiento un día para
  los residentes en Lima. pg_cron corre en UTC, así que el job se programa a las
  `11:00 UTC` = `06:00 America/Lima`.
- En el cliente, las fechas `date` (`YYYY-MM-DD`) se comparan como string o se
  renderizan con `T12:00:00` para evitar el desfase UTC (`estaVencida`, `fechaHoyISO`).

## 3. Naming de RPCs

- Verbo en infinitivo + entidad: `emitir_facturas_lote`, `registrar_pago_factura`,
  `totales_facturacion`, `marcar_facturas_vencidas_y_recordatorios`.
- Parámetros con prefijo `p_` (`p_factura_id`, `p_periodo`).
- Las RPCs que mutan o leen datos sensibles son `SECURITY DEFINER` con
  `SET search_path` y verifican el rol con `public.get_user_rol()` al inicio.

## 4. Notificaciones: generación por trigger, best-effort

- Las notificaciones se insertan desde triggers `SECURITY DEFINER` (no desde el
  cliente), para poder escribir filas de otros usuarios sin debilitar la RLS.
- Todo trigger de notificación envuelve su cuerpo en `EXCEPTION WHEN others` para que
  un fallo de notificación **nunca** revierta la operación de negocio.
- El email (Resend, vía Edge Function) es **fire-and-forget**: si falla, la
  notificación in-app (Realtime) sigue siendo la fuente de verdad. Ver ADR-009/010.

## 5. Idempotencia en transiciones críticas

- Las operaciones que pueden dispararse dos veces (doble click, reintento del cron)
  son idempotentes en el servidor:
  - `registrar_pago_factura`: si la factura ya está `pagada`, no reescribe `fecha_pago`
    y devuelve un aviso (R3).
  - El job diario usa la columna `recordatorio_enviado` para no repetir recordatorios
    si el cron corre dos veces (R1).

## 6. Auditoría

- Toda escritura de auditoría desde el front pasa por `logAuditAction` (`src/lib/audit.ts`).
- Las acciones generadas por RPC/trigger se registran en `audit_log` desde SQL y se
  declaran en la tabla catálogo `audit_acciones` (FK). Ej: `registrar_pago_factura`.

## 7. PDF: `pdf-lib`, no `reportlab`

- Los PDF (comprobantes) se generan en el cliente con **`pdf-lib`** (JS), no con
  `reportlab` (Python). El stack de runtime es JS/Deno; `reportlab` no es viable.
  Corrige la proyección original del roadmap. Ver ADR-011.

## 8. Seguridad de funciones y tablas

- Las funciones de trigger hacen `REVOKE ALL ... FROM anon, authenticated, public`
  (solo las invoca el trigger, que corre como owner).
- Las tablas auxiliares no expuestas a la API (ej: `facturas_secuencia`) tienen RLS
  habilitada sin políticas (las toca solo un trigger `SECURITY DEFINER`).
- `/health` no expone detalles de error ni secretos (solo `ok`/`error` por dependencia).

## 9. Constantes de UI (Retro S10 · Acción 2)

Umbrales y constantes de presentación centralizados para no re-discutirlos en cada
Refinement. La fuente de verdad en código es `src/lib/tienda.ts` (Tienda) y los
módulos `lib/*` de cada dominio; los componentes importan de ahí, sin números mágicos.

| Constante | Valor | Dónde (código) | Motivo |
|---|---|---|---|
| Stock bajo → badge "Pocas unidades" | `stock ≤ 5` | `STOCK_BAJO_UMBRAL` | Debate del S10 (≤ 5 vs ≤ 3); se fijó **≤ 5**. |
| Stock agotado → badge "Agotado" | `stock = 0` | `estadoStock` | La tarjeta se atenúa; la validación de compra es del S11. |
| Debounce de búsqueda del catálogo | `300 ms` | `BUSQUEDA_DEBOUNCE_MS` | Evita una consulta por cada tecla (HU-TIENDA-06). |
| Peso máx. de foto de producto | `2 MB` | `PRODUCTO_IMAGEN_MAX_BYTES` | Más estricto que solicitudes (5 MB) por el volumen del catálogo. |
| Paginación del catálogo (lazy) | `24` | `CATALOGO_PAGE_SIZE` | Grilla del residente, carga de 24 en 24. |
| Tipos de imagen permitidos | `JPEG`, `PNG` | `*_IMAGEN_MIME_PERMITIDOS` | Consistente entre solicitudes y productos. |

## 10. Ciclos de vida de estado (Retro S11 · Acción 3)

Las máquinas de estado del dominio se documentan aquí para alinear UI y backend (qué
transiciones existen y quién las dispara). El enum vive en BD; el front solo refleja.

| Entidad | Estados | Transiciones | Quién / cómo |
|---|---|---|---|
| **Pedido** (`pedido_estado`) | `borrador` → `confirmado` → `facturado` | borrador→confirmado: `confirmar_pedido` (descuento atómico de stock). confirmado→facturado: `facturar_pedidos_periodo` (cierre de mes). | Residente confirma; cron/admin factura. No hay vuelta atrás (cancelar pedido confirmado es PBI-S11-E02, futuro). |
| **Factura** (`factura_estado`) | `pendiente` → `pagada` · `pendiente` → `vencida` | pendiente→pagada: `registrar_pago_factura` (admin) o `pagar_factura_residente`. pendiente→vencida: job diario si `vencimiento < hoy_lima`. | Idempotente en ambas (no reescribe si ya está en el estado destino). |
| **Anuncio** (`archivado` + `vigente_hasta`) | `vigente` → `vencido` (al pasar `vigente_hasta`) · `vigente` → `archivado` (baja lógica) | vigente→vencido: automático por fecha (`vigente_hasta < hoy_lima`), el feed lo oculta. vigente→archivado: el admin archiva (`archivarAnuncio`), reversible (restaurar). | El residente solo ve los vigentes (RLS); nunca DELETE. Ver [ADR-016](adr/016-modelo-tablon-anuncios.md). |

- **Una sola fuente de la transición:** cada cambio de estado pasa por su RPC/job
  `SECURITY DEFINER`; la UI nunca hace `UPDATE estado` directo.
- El `borrador` del pedido es el carrito: uno activo por residente, se borra al vaciarse.
  Ver [ADR-014](adr/014-carrito-descuento-atomico.md) y [ADR-015](adr/015-integracion-pedido-factura.md).

## 11. Tests de concurrencia para RPC de stock o saldo (Retro S11 · Acción 1)

- **Toda RPC que descuente stock o modifique un saldo lleva un test de concurrencia explícito**
  (dos operaciones simultáneas sobre el mismo recurso; solo una debe ganar). Es parte del
  checklist de revisión de la RPC.
- El patrón de implementación es `SELECT … FOR UPDATE` (bloqueo de fila, en **orden estable** de
  clave para evitar deadlocks) + un `UPDATE … WHERE saldo/stock >= monto` condicional: si
  `NOT FOUND`, `RAISE` revierte toda la operación. Nunca se permite que el recurso quede negativo.
- Ejemplo aplicado: `confirmar_pedido` (S11) — dos confirmaciones por la última unidad; el lock
  serializa y el `UPDATE` condicional garantiza que nadie sobrevenda (evidencia en [ADR-014](adr/014-carrito-descuento-atomico.md)).

## 12. Política de notificaciones (Retro S12 · Acción 1)

Antes de implementar un evento que notifique, se define aquí **qué eventos notifican, a quién y
con qué prioridad**, para no generar spam ni avisos de más. La notificación in-app (tabla
`notificaciones` + Realtime del S6) es la fuente de verdad; el email (Resend) es best-effort (§4).

| Evento | Notifica a | Cuándo | Tipo |
|---|---|---|---|
| Cambio de estado / asignación de solicitud | Residente dueño (y técnico/admin según el caso) | Siempre | `estado_cambio`, `asignacion`, … |
| Factura nueva / pagada | Residente dueño | Siempre | `factura_nueva`, `factura_pagada` |
| Factura por vencer | Residente dueño | 3 días antes **y** el día del vencimiento (S12 · PBI-S9-E02) | `factura_por_vencer` |
| **Anuncio publicado** | Todos los residentes activos | **Solo** si la prioridad es `importante`/`urgente` — los `normal` no notifican (R5) | `anuncio_nuevo` |

Reglas:

- Un evento "de fondo" (un anuncio `normal`, un dato que solo aparece en una lista) **no**
  interrumpe: se refleja en el feed o badge correspondiente sin forzar notificación.
- El contador de no leídos se **recalcula desde BD**, no se acumula en memoria (R3 del S12).
- La decisión de notificar vive en el trigger (`SECURITY DEFINER`, best-effort), nunca en el cliente.
