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
