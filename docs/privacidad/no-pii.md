# No-PII en logs — Tienda y Facturación (DoD v3)

> Chore técnico del **Sprint 11**. Primer criterio nuevo de **DoD v3**: los logs de
> los módulos de tienda y factura deben registrar **solo identificadores** (`pedido_id`,
> `residente_id`, `factura_id`), **nunca** datos personales (nombres ni correos).

## ¿Por qué?

Los logs (consola de Edge Functions, `RAISE` de Postgres, `audit_log`) se conservan y
pueden exportarse o indexarse. Si incluyen nombre o correo del residente, filtran PII
aunque la fila original esté protegida por RLS. La regla: **el log identifica con un ID;
quien tenga permiso resuelve el ID contra la tabla (protegida por RLS) si lo necesita.**

## Qué es PII y qué no

| Dato | ¿PII? | En logs |
|---|---|---|
| `usuarios.email` | Sí | ❌ Nunca |
| `usuarios.nombre` / `apellido` | Sí | ❌ Nunca |
| `residente_id` / `usuario_id` (uuid) | No | ✅ Permitido |
| `pedido_id` / `factura_id` / `producto_id` (uuid) | No | ✅ Permitido |
| `tipo`, `monto`, `periodo`, `total`, `estado` | No | ✅ Permitido |

> El **contenido del correo** que se envía al residente sí incluye su nombre (es para él),
> pero ese texto **no se registra en logs**: solo se pasa al proveedor (Resend) para el envío.

## Auditoría realizada (Sprint 11)

### Edge Functions de factura — se encontró y corrigió PII
`supabase/functions/notificar-factura-nueva/index.ts` y
`supabase/functions/recordatorios-facturas/index.ts` registraban el **correo** del
residente en tres puntos (dry-run, `console.error` de Resend y log de éxito):

```diff
- console.log(`To: ${residente.email}`)
+ console.log(`Residente: ${residente_id}`)

- console.error(`... Resend error para ${residente.email}: ${errorText}`)
+ console.error(`... Resend error (residente ${residente_id}, factura ${factura_id}): ${errorText}`)

- console.log(`... Email enviado a ${residente.email} (id: ${resData.id})`)
+ console.log(`... Email enviado (residente ${residente_id}, factura ${factura_id}, id: ...)`)
```
El `email` se sigue usando para **enviar** el correo (necesario), pero ya no se **registra**.

### RPCs y triggers de tienda/factura — ya cumplen
- `confirmar_pedido`, `actualizar_item_carrito`, `facturar_pedidos_periodo`: el `audit_log`
  solo guarda `usuario_id`, `entidad_id` (pedido/factura) y `detalles` con IDs/importes
  (`total`, `periodo`, contadores). Los `RAISE` usan `SQLERRM` (mensaje técnico, sin PII).
- `after_factura_inserted` / `after_factura_paid`: el `net.http_post` envía `residente_id`
  (no el correo); el `RAISE WARNING` usa `SQLERRM`.
- `log_producto_cambio`: registra `usuario_id`, `entidad_id` y precios/stock; sin PII.

### Front-end
El front no emite logs de servidor; no se introdujeron `console.*` con nombre/correo en
los módulos de tienda (`lib/carrito.ts`, `lib/pedidos.ts`, contextos y componentes).

## Checklist de revisión en PR

- [ ] Ningún `console.log`/`console.error` de una Edge Function imprime `email`, `nombre` o `apellido`.
- [ ] Ningún `RAISE`/`audit_log` de una RPC o trigger de tienda/factura incluye nombre o correo.
- [ ] Los identificadores usados en logs son uuids (`*_id`), no datos personales.
- [ ] El contenido personalizado (correo al residente) no se vuelca a logs.

## Referencias
- DoD v3 — criterio de no-PII en logs (artefactos del Sprint 11).
- ADR-009 / ADR-010 — notificaciones y emails best-effort.
- `docs/privacidad.md` — política general de datos del proyecto (datos ficticios, sin PII real).
