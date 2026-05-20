# ADR-009 · Notificaciones Realtime: canal por usuario y generación por trigger

- **Estado:** Aceptada
- **Fecha:** 2026-05-20 (Sprint 6)
- **Contexto:** PBI-12, HU-NOTIF-01/02, PBI-S4-E01

## Contexto

El Sprint 6 introduce notificaciones en tiempo real ante cambios de estado de las
solicitudes, dirigidas a distintos destinatarios (residente, técnico asignado,
administradores). Hay que decidir (1) cómo se suscriben los clientes a Realtime y
(2) quién genera las filas de `notificaciones`.

## Decisión 1 — Un canal por usuario, suscripción centralizada

Cada sesión abre **una sola** suscripción al canal `notificaciones:{auth.uid()}`
con filtro `usuario_id=eq.{uid}`, centralizada en `NotificacionesContext`.

- **Por qué no un canal global**: enviaría a cada cliente eventos que no le
  competen y dependería del filtrado en el cliente. Un canal por usuario + las
  policies RLS de `SELECT` garantizan que cada quien recibe solo lo suyo, con
  menos tráfico.
- **Por qué centralizado**: tener la suscripción en cada componente (campana,
  página) abría conexiones duplicadas y entregaba eventos repetidos. Un único
  contexto mantiene un solo oyente y un estado compartido.
- **Reconexión exponencial** (1→2→4→8→máx 30s) + refetch al reconectar para
  tolerar redes inestables (Riesgo R1).

## Decisión 2 — Generación por trigger `SECURITY DEFINER`, no desde el cliente

Las notificaciones las inserta el trigger `after_solicitud_estado_changed`, no el
frontend.

- **Por qué**: la RLS `notificaciones_insert_own` solo permite crear filas para
  uno mismo (`usuario_id = auth.uid()`). Notificar al técnico o a los admins desde
  el navegador del residente es imposible sin debilitar esa policy. Un trigger
  `SECURITY DEFINER` inserta para cualquier destinatario sin abrir un agujero de
  seguridad.
- **Atomicidad y consistencia**: la notificación se genera en la misma transacción
  del cambio de estado; un único `UPDATE` produce exactamente las filas correctas.
- **Best-effort**: el trigger captura excepciones (`exception when others`) para
  que un fallo de notificación nunca revierta el cambio de estado.

## Decisión 3 — Email simulado invocado desde el cliente (fire-and-forget)

El email (Edge Function `notificar-cambio-estado`) se dispara desde el cliente tras
el cambio de estado, en modo fire-and-forget.

- **Por qué no desde el trigger** (NOTIFY/LISTEN o `pg_net`): añade complejidad e
  infraestructura (extensión HTTP, manejo de colas) desproporcionada para un email
  que en local/CI corre en dry-run. Lo crítico —la notificación in-app + Realtime—
  sí es transaccional vía trigger.
- Si Resend falla, el cambio de estado no se ve afectado (el error queda en logs).

## Consecuencias

- ✅ Seguridad: ningún cliente puede fabricar notificaciones para otros usuarios.
- ✅ Menos tráfico y sin eventos duplicados.
- ✅ El frontend se simplifica (solo consume; no inserta).
- ⚠️ La lógica de destinatarios vive en SQL (el trigger); cambiarla requiere una
  migración. Documentado en `docs/notificaciones.md`.
- ⚠️ El email real nunca se ha probado fuera de dry-run (deuda Sprint 7).
