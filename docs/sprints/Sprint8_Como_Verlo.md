# Cómo ver lo implementado del Sprint 8

Guía sencilla — en palabras simples — para que puedas ver con tus propios ojos cada feature del Sprint 8 ("Facturación v1"). Pensada para alguien que llega nuevo al repo o quiere validar la entrega sin leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido de 5 pasos**](#el-recorrido-de-5-pasos).

---

## ¿Qué te entregó el Sprint 8?

El Sprint 8 abre el módulo de **Facturación** del producto. Antes de este sprint el admin solo gestionaba mantenimiento. Ahora puede:

- **Emitir facturas mensuales** por tipo (luz, agua, pensión, multas) desde `/admin/facturacion`.
- **Emitir a todos los residentes activos a la vez** ("Emisión por lote") con un solo click.
- Si intenta emitir el lote dos veces el mismo mes, el sistema lo **rechaza con error claro** ("Ya existe una factura de tipo agua para 2026-05…") — no duplica.

Por su parte, el **residente** ahora ve:

- En `/residente/facturas` una **tarjeta por cada factura** con tipo, monto, vencimiento y badge de estado (Pendiente ámbar, Pagada verde, Vencida roja).
- En la cabecera: "Tienes $XXX por pagar este mes" (suma automática de pendientes).
- **Filtros** por estado (Todas / Pendientes / Pagadas / Vencidas).
- **Notificación en tiempo real** en la campana cuando el admin emite una factura a su nombre — click en la notificación lo lleva al detalle.

Internamente:

- Tabla `facturas` con `numeric(10,2)` para evitar redondeos.
- `UNIQUE(residente_id, tipo, periodo)` impide duplicar facturas.
- Número legible `F-YYYY-MM-NNN` generado automáticamente.
- **RLS estricta**: residente solo ve las suyas, admin todas, técnico nada.
- **Edge Function** `notificar-factura-nueva` para enviar email (dry-run sin `RESEND_API_KEY`).

---

## Antes de empezar

```bash
npm install              # si nunca lo corriste
npm run seed:clean       # poblar BD con usuarios + facturas demo
npm run dev              # arranca app en http://localhost:5173
```

El seed crea **15 facturas demo**: 3 residentes × (3 facturas del mes pasado pagadas + 2 facturas del mes actual pendientes).

> [!IMPORTANT]
> Las migraciones SQL del Sprint 8 deben estar aplicadas en Supabase. Si llegas al repo desde cero, sigue [`docs/ops/deploy-modulo-facturacion.md`](../ops/deploy-modulo-facturacion.md).

---

## El recorrido de 5 pasos

### 1. Login como admin y mira el dashboard

1. `http://localhost:5173/login`
2. **Admin:** `carlos@zity-demo.com` / `Admin1234!`
3. Una vez en `/admin`, en el sidebar verás un nuevo ítem: **"Facturación"**.

### 2. Emite una factura individual

1. Click **"Facturación"** en el sidebar → `/admin/facturacion`.
2. Modo **"Emisión individual"** (seleccionado por defecto).
3. Llena:
   - **Residente:** `Vega, Laura` (depto 4B)
   - **Tipo:** Electricidad
   - **Monto:** 120.00
   - **Período:** mes próximo (ej. `2026-06`)
   - **Vencimiento:** se autocompleta al último día del mes (ej. `2026-06-30`)
4. Click **"Emitir factura"**.
5. ✅ Toast verde: *"Factura emitida correctamente por $120.00."*

### 3. Comprueba la notificación en tiempo real (con dos navegadores)

Para apreciar el **Realtime** de verdad, abre dos pestañas/ventanas:

1. Ventana A: ya está como Carlos en `/admin/facturacion`.
2. Ventana B (incógnito o navegador alterno): login como `laura@zity-demo.com` / `Residente1!` → llega a `/residente`.

Ahora desde la ventana A emite **otra factura** (cambia el periodo a `2026-07` para que no choque con la anterior).

- En la **ventana B (Laura)**: la **campana del header** muestra un badge rojo `+1` casi al instante.
- Click en la campana → ves "Nueva factura: Electricidad — $120, vence 30/07".
- Click en la notificación → te lleva directo a `/residente/facturas?id=<uuid>` con el detalle abierto.

### 4. Ver las facturas como residente

1. En la ventana B (Laura) navega a `/residente/facturas` (link "Mis facturas" del header o desde el dashboard).
2. Cabecera: **"Tienes $XXX por pagar este mes (Mayo 2026)"** — suma de las pendientes del mes actual.
3. Tarjetas: una por factura, con icono según tipo (rayo para Electricidad, gota para Agua, casa para Pensión, alerta para Multa).
4. Badges:
   - Pagada → verde
   - Pendiente → ámbar
   - Vencida → rojo
5. Click en una tarjeta → **Detalle** con número legible `F-2026-05-NNN`, fecha emisión, vencimiento, descripción si hay.

**Pruebas para validar:**

- **Filtros:** clica los pills "Pendientes" → solo quedan las pendientes. "Pagadas" → solo las pagadas.
- **Scroll infinito:** si emites 26+ facturas, al hacer scroll cargan las siguientes (de 25 en 25). El seed crea 5 por residente — no llegarás a la siguiente página sin emitir más.
- **Mobile (DevTools):** las tarjetas se apilan verticalmente en pantalla pequeña.

### 5. Probar el lote y el constraint UNIQUE

Vuelve a Carlos en `/admin/facturacion`:

1. Cambia a **"Emisión por lote"** (tab del switcher arriba).
2. Llena: Tipo **Agua**, Monto **40**, Período **`2099-12`** (un periodo que no exista aún), Vencimiento **`2099-12-31`**.
3. Click **"Emitir a todos (3)"** → modal de confirmación → "Sí, emitir 3 facturas".
4. ✅ Toast: *"Se emitieron 3 facturas correctamente."*

Ahora **vuelve a hacer click** en "Emitir a todos" con los mismos valores:

1. ❌ Toast rojo: *"Ya existe una factura de tipo 'agua' para el período '2099-12' en uno o más residentes. Ninguna factura fue emitida."*
2. La transacción se revirtió completa — ninguna factura quedó a medias. Esto es el `UNIQUE(residente_id, tipo, periodo)` actuando.

---

## ¿Dónde está cada archivo importante?

Si quieres bucear el código:

| Lo que buscas | Dónde está |
|---|---|
| Vista `/admin/facturacion` | `src/pages/admin/Facturacion.tsx` |
| Vista `/residente/facturas` | `src/pages/residente/Facturas.tsx` |
| Hook con scroll infinito + total pendiente | `src/hooks/useFacturasResidente.ts` |
| Tipos, labels, formato, estaVencida | `src/lib/facturas.ts` |
| Migración tabla + RLS + trigger | `supabase/migrations/20260527012000_sprint8_facturas.sql` |
| RPC `emitir_facturas_lote` | `supabase/migrations/20260527013000_sprint8_facturas_lote.sql` |
| Numeración F-YYYY-MM-NNN | `supabase/migrations/20260527014000_sprint8_facturas_numero.sql` |
| Trigger con metadata + email fire-and-forget | `supabase/migrations/20260527015000_sprint8_notif_factura_realtime.sql` |
| Edge Function email | `supabase/functions/notificar-factura-nueva/index.ts` |
| E2E del flujo completo | `e2e/tests/facturacion.spec.ts` |
| Tests RLS facturas (mocked) | `src/test/admin/rls-facturas.test.ts` |
| Tests helpers puros | `src/test/admin/facturas-helpers.test.ts` |
| ADR-007 modelo de facturas | `docs/adr/007-modelo-facturas.md` |
| Doc deploy del módulo | `docs/ops/deploy-modulo-facturacion.md` |
| Seed con facturas demo | `scripts/seed.js` (función `seedFacturas`) |

---

## Chequeo rápido (checklist)

Cuando termines el recorrido, deberías poder marcar:

- [ ] Login como Carlos accede a `/admin/facturacion`.
- [ ] Login como Laura accede a `/residente/facturas`.
- [ ] Login como técnico (Mario) **no** ve nada de facturas en su panel.
- [ ] Emitir factura individual funciona y muestra toast de éxito.
- [ ] La factura aparece en `/residente/facturas` del residente correcto.
- [ ] La campana del residente recibe la notificación factura_nueva.
- [ ] Click en la notificación abre el detalle de la factura.
- [ ] Emisión por lote crea N facturas (donde N = residentes activos).
- [ ] Re-emitir lote idéntico falla con mensaje en español.
- [ ] Filtro por estado en `/residente/facturas` funciona.
- [ ] El número de factura sigue formato `F-YYYY-MM-NNN`.
- [ ] El total acumulado en la cabecera es la suma de las pendientes del mes.

---

## Si algo no funciona

| Síntoma | Causa probable | Solución |
|---|---|---|
| "Acceso denegado" al abrir `/admin/facturacion` | RLS rechaza al admin | Las migraciones del Sprint 8 deben tener `get_user_rol()` (no `app_metadata`). Verifica que aplicaste la última versión. |
| Carlos emite pero Laura no ve nada | RLS del residente rechaza | Verifica que la policy `facturas_residente_select` use `get_user_rol() = 'residente'`. |
| La campana no se actualiza en tiempo real | Realtime de Supabase desconectado | Recarga la página; el `NotificacionesContext` re-suscribe al canal al montar. |
| "Ya existe una factura..." cuando emites por primera vez | Constraint UNIQUE pegando | Cambia el periodo (cada combo tipo+periodo+residente solo permite 1 factura). |
| No llega el email | `RESEND_API_KEY` no está configurado en Edge Function secrets | Es esperado; el modo dry-run loguea en consola. Si quieres email real, configura el secret en Supabase. |
| Error "extension pg_net does not exist" en logs del trigger | pg_net no activado | Es opcional. Sin pg_net, la notificación in-app sigue funcionando. Activa pg_net en Database → Extensions si quieres el email fire-and-forget. |

---

## ✅ Lista de pasos manuales para cerrar el Sprint 8 al 100%

### 🔴 Obligatorios (ya hechos por MCP en este chat)
- [x] Aplicar las 4 migraciones SQL del Sprint 8 en Supabase
- [x] Deploy de la Edge Function `notificar-factura-nueva`

### 🟡 Recomendados (tú debes hacer)
1. **Correr el seed con facturas demo:**
   ```bash
   npm run seed:clean
   ```
   Crea 15 facturas para los 3 residentes (mes pasado pagadas + mes actual pendientes).

2. **(Opcional) Activar `pg_net` para email fire-and-forget:**
   - Supabase Dashboard → Database → Extensions → `pg_net` → Enable
   - Configurar los settings de Postgres (ver `docs/ops/deploy-modulo-facturacion.md`)

3. **(Opcional) Configurar `RESEND_API_KEY` en secrets de la Edge Function:**
   - Supabase Dashboard → Edge Functions → notificar-factura-nueva → Manage Secrets
   - Sin esto, los emails se loguean en dry-run pero el flujo igual completa

### 🔵 Opcionales — CI/E2E
4. **GitHub Secrets** para `.github/workflows/e2e.yml`: agrega `E2E_ADMIN_EMAIL` y `E2E_ADMIN_PASSWORD` (defaults `carlos@zity-demo.com` / `Admin1234!`).

### ⚠️ Sprint 9 viene con (preview del PDF):
- HU-FACT-04: admin marca factura como pagada + notif Realtime
- HU-FACT-08: recordatorios automáticos 3 días antes del vencimiento
- HU-FACT-06: cron diario marca facturas vencidas
- PBI-S8-E01: PDF de comprobante por factura pagada
- PBI-S8-E02: tarjeta con totales del periodo en `/admin/facturacion`
- Chore: endpoint `/health` (cierra DoD v2)

---

## Para la Sprint Review / demo (~60 segundos)

> "Abro dos navegadores en pantalla compartida. En el izquierdo, Carlos como admin entra a `/admin/facturacion` y emite una factura de Electricidad por $120 a Laura. En el derecho, Laura ve la campana sumar +1 al instante; click en la notificación → la lleva al detalle. Vuelve a `/residente/facturas`: las 5 tarjetas del seed más la recién emitida, con la cabecera 'Tienes $230 por pagar este mes'. Vuelvo al admin y emito por lote tipo Agua a todos — modal de confirmación '3 residentes', confirma, toast '3 facturas emitidas'. Intento el mismo lote de nuevo y el sistema lo rechaza con mensaje claro porque el UNIQUE protege. Para cerrar, abro el trace del E2E `e2e/tests/facturacion.spec.ts` en CI, en verde."

Sprint 8 cerrado al 100%. ¡Listo!
