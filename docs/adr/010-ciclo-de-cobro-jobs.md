# ADR-010 · Ciclo de cobro: marcar pagada + job diario de vencidas y recordatorios

- **Estado:** Aceptada
- **Fecha:** 2026-05-29 (Sprint 9)
- **Contexto:** HU-FACT-04, HU-FACT-06, HU-FACT-08

> **Nota de numeración:** el artefacto académico del Sprint 9 proyectó este ADR como
> "ADR-009", pero ese número ya estaba tomado por *Notificaciones Realtime* (Sprint 6).
> Se documenta aquí como **ADR-010** para no colisionar; el contenido es el previsto.

## Contexto

El Sprint 9 cierra el ciclo de cobro de Facturación: el admin marca una factura como
pagada (con notificación al residente), y un proceso automático marca las vencidas y
recuerda los vencimientos próximos. Hay que decidir (1) dónde vive la transición a
`pagada`, (2) cómo se ejecuta el proceso diario y (3) en qué zona horaria se calculan
las fechas.

## Decisión 1 — La transición a `pagada` es una RPC idempotente, no un UPDATE desde el cliente

`registrar_pago_factura(p_factura_id, p_metodo, p_fecha)` (`SECURITY DEFINER`) centraliza
toda la transición:

- Verifica rol admin (`get_user_rol`), valida el método, **bloquea la fila** (`FOR UPDATE`).
- Si la factura ya está `pagada`, **no reescribe** `fecha_pago` y devuelve un aviso
  (idempotencia, R3: doble click / dos admins).
- Hace el `UPDATE` y registra en `audit_log` en la misma transacción.

- **Por qué no un UPDATE desde el navegador**: dos clientes podrían pisarse y dejar
  `fecha_pago` inconsistente; además la auditoría quedaría fuera de la transacción.
  La RPC garantiza atomicidad e idempotencia en el servidor. Consistente con
  `emitir_facturas_lote` (S8).

## Decisión 2 — La notificación de pago la emite el trigger `after_factura_paid`

Un trigger `AFTER UPDATE` (cuando `estado` pasa a `pagada`) inserta la notificación
`factura_pagada` (Realtime S6) con `metadata.factura_id` para el deep link. Best-effort
(`EXCEPTION WHEN others`): un fallo de notificación nunca revierte el pago.

## Decisión 3 — Un único job diario (pg_cron) con dos pasadas

`marcar_facturas_vencidas_y_recordatorios()` corre vía `cron.schedule` a las
**11:00 UTC = 06:00 America/Lima**:

1. **Vencidas**: `UPDATE ... estado='vencida' WHERE estado='pendiente' AND vencimiento < hoy`.
2. **Recordatorios**: por cada pendiente con `vencimiento = hoy + 3` y
   `recordatorio_enviado = false`, inserta notificación `factura_por_vencer`, marca
   `recordatorio_enviado = true` y dispara el email (Edge Function `recordatorios-facturas`).

- **Por qué un solo job con dos pasadas**: comparten la lógica de fechas y mantienen el
  cron simple (Retro S9). Devuelve `{vencidas, recordatorios, fecha}` para observabilidad.
- **Idempotencia (R1)**: `recordatorio_enviado` evita duplicar recordatorios si el cron
  corre dos veces. Verificado con seed de fechas (segunda corrida → 0/0).

## Decisión 4 — Las fechas del job se calculan en `America/Lima`

`(now() AT TIME ZONE 'America/Lima')::date`, no UTC. Calcular en UTC adelantaba/atrasaba
el vencimiento un día para Lima (UTC-5). Regla elevada a estándar en `docs/conventions.md`.

## Decisión 5 — El email es fire-and-forget (in-app es la fuente de verdad)

El email (Resend, vía `net.http_post`/pg_net) no bloquea ni revierte; si falla, la
notificación in-app + Realtime se entregan igual.

- **Estado de la configuración**: `pg_net` quedó habilitada en la migración 010. El
  `net.http_post` del cron necesita las settings de BD `app.supabase_url` y
  `app.service_role_key` (o Supabase Vault). En este entorno esas settings requieren
  privilegios de superusuario que el acceso de migración no tiene; se configuran desde
  el dashboard de Supabase. **El recordatorio in-app no depende de esto.**

## Consecuencias

- ✅ Transición de pago atómica, idempotente y auditada en el servidor.
- ✅ Vencidas y recordatorios automáticos sin intervención manual; idempotentes.
- ✅ Fechas correctas para el residente (zona Lima).
- ⚠️ El email del recordatorio depende de configurar las settings `app.*` con
  privilegios de superusuario; mientras tanto degrada a in-app (best-effort).
- ⚠️ La lógica de fechas/destinatarios vive en SQL; cambiarla requiere una migración.
