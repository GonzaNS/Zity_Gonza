# Cómo ver lo implementado del Sprint 10

Guía sencilla — en palabras simples — para ver con tus propios ojos cada feature del
Sprint 10 (**"Tienda interna v1"** + el **addendum del profesor**). Pensada para validar
la entrega sin leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido**](#el-recorrido) y mira los pasos 1–3.

---

## ¿Qué te entregó el Sprint 10?

El Sprint 9 cerró el dominio de **finanzas**. El Sprint 10 abre el **último dominio nuevo
del producto, la Tienda**, y suma tres mejoras pedidas por el profesor:

**Núcleo — Tienda v1:**

- El **admin gestiona el catálogo** desde `/admin/tienda`: da de alta/baja productos con
  **foto, precio y stock**, edita y reactiva. La baja es **lógica** (no se borra nada).
- El **residente navega el catálogo** en `/residente/tienda`: una **grilla de tarjetas**
  con **filtros** (categoría, disponibilidad), **búsqueda** por nombre y **badges** de
  stock ("Pocas unidades", "Agotado").
- **CD a staging**: en cada merge a `main`, GitHub Actions despliega solo a Vercel (con el
  CI como gate) y verifica `/health`. Cierra el último criterio de **DoD v2**.

**Addendum del profesor:**

- **Pago en línea (simulado)**: el residente paga sus facturas desde la app con una
  tarjeta ficticia (HU-FACT-09).
- **Seed histórico**: 3 años de datos de demostración para que el dashboard y las métricas
  se vean realistas.
- **Encuesta de usabilidad (SUS)**: formulario listo para Google Forms.

---

## Antes de empezar

```bash
npm install
npm run seed           # usuarios base + facturas demo (si aún no lo corriste)
npm run seed:poblacion # elenco del edificio: ~16 residentes + 6 técnicos demo
npm run seed:historico # 3 años de facturas y solicitudes, repartidas por antigüedad
npm run dev            # http://localhost:5173
```

Credenciales demo: **Admin** `carlos@zity-demo.com` / `Admin1234!` ·
**Residente** `laura@zity-demo.com` / `Residente1!`. El resto del elenco del
edificio (Rosa, Jorge, Miguel, Lucía…) usa el password común **`Demo1234!`** —
así puedes iniciar sesión como cualquier vecino. Dos vecinos (Carmen, Roberto)
están **bloqueados** porque "se mudaron".

> [!IMPORTANT]
> Las migraciones del Sprint 10 deben estar aplicadas en Supabase (ya lo están en el
> proyecto `zity-br`):
> `20260530150000_sprint10_tienda.sql`, `…_151000_tienda_audit.sql`,
> `…_160000_pago_residente.sql` y `…_170000_historial_nota_inicial.sql`.

---

## El recorrido

### 1. El admin gestiona el catálogo (`/admin/tienda`)

1. Login como **admin** → en el menú lateral, **"Tienda"**.
2. Botón **"Nuevo producto"** → completa nombre, categoría, **precio (S/)**, stock y, si
   quieres, una **foto** (JPEG/PNG, máx. 2 MB; sin foto se muestra un placeholder).
   → **Crear producto**. Aparece al instante en la lista.
3. En cualquier producto: **"Editar"** (cambia precio/stock/foto) o **"Dar de baja"**.
4. Un producto dado de baja queda con badge **"Inactivo"** y atenuado, con opción
   **"Reactivar"** — **no se borra** (así el historial de pedidos del S11 no se rompe).
5. Fíjate en los **badges de stock**: naranja **"Pocas unidades"** (stock ≤ 5) y gris
   **"Agotado"** (stock 0).

> Cada alta/edición/baja queda registrada en **Auditoría** (`/admin/auditoria`): busca las
> acciones *Crear / Editar / Dar de baja producto*.

### 2. El residente navega el catálogo (`/residente/tienda`)

1. En otro navegador, login como **residente** (Laura) → en el header, **"Tienda"**.
2. Verás la **grilla de tarjetas** (1 columna en móvil, hasta 4 en escritorio) con foto,
   categoría, nombre y precio. El producto que el admin acaba de crear **ya aparece**.
3. Prueba los **filtros**: pulsa **"Bebidas"** y escribe **"agua"** en el buscador — la
   grilla se reduce; aparece **"Limpiar"** para restablecerla.
4. Las tarjetas con poco/cero stock muestran su **badge**; las agotadas se atenúan.
5. Click en una tarjeta → **detalle** con foto grande, descripción, precio y stock. El
   botón **"Agregar al carrito"** está **deshabilitado** con el aviso *"Disponible en la
   próxima versión"* (el carrito es el Sprint 11).

### 3. El residente paga una factura en línea (HU-FACT-09)

1. Como **residente**, ve a **"Mis facturas"**.
2. Cada factura **pendiente** o **vencida** muestra un botón **"Pagar"**; las **pagadas**
   muestran *"Descargar comprobante"* (no "Pagar").
3. Click en **"Pagar"** → se abre el **modal de pago simulado**: muestra el monto en S/ y
   un formulario de **tarjeta ficticia** (número / vencimiento / CVV) con un aviso claro de
   que es un **pago de demostración** (no se cobra nada ni se guardan datos de tarjeta).
4. Completa cualquier número ficticio → **"Pagar S/ …"**. La factura pasa a **"Pagada"**,
   llega la **notificación** y aparece *"Descargar comprobante"*.

> **Seguridad:** un residente solo puede pagar **sus propias** facturas (la RPC valida
> `auth.uid() = residente_id`). **Idempotencia:** si la factura ya estaba pagada, no se
> reescribe. El **admin** ve ese pago en sus totales (Cobrado), igual que uno manual.

### 4. El seed histórico llena el dashboard (MP-01)

```bash
npm run seed:historico
```

Genera ~36 meses de **facturas** (luz/agua/pensión, mayoría pagadas) y **solicitudes** de
mantenimiento repartidas entre los vecinos (cada una asignada a un técnico del equipo).
Luego, como **admin**:

- En **"Métricas"** (`/admin/metricas`) verás las gráficas **pobladas con 3 años** de
  historia en lugar de unos pocos registros del mes.
- En **"Mis facturas"** del residente verás un historial largo, con pagos por tarjeta,
  transferencia y efectivo.

> Es **idempotente y determinista**: vuelve a correrlo y no duplica nada (mismo resultado).
> Solo toca usuarios `@zity-demo.com`; nunca corre contra producción.

### 5. El CD a staging (chore técnico)

No se ve en local: vive en **GitHub Actions**. Tras configurar los secrets de Vercel
(`docs/ops/cd-staging.md`):

1. Haz un merge a `main`.
2. En la pestaña **Actions** verás correr **"CI"** (lint + tests) y, al pasar, **"Deploy to
   Staging"** (build → deploy a Vercel → `GET /health`).
3. Verifica el deploy:
   ```bash
   curl -s https://<tu-deploy>/health
   # → {"status":"ok","db":"ok","auth":"ok","storage":"ok","version":"…"}
   ```

### 6. La encuesta de usabilidad (MP-03)

El contenido del formulario tipo **SUS** (10 ítems Likert + 2 preguntas abiertas) está
listo para copiar a Google Forms en
[`docs/sprints/Zity_Encuesta_Usabilidad_GoogleForm.md`](./Zity_Encuesta_Usabilidad_GoogleForm.md).

---

## Lo que pasa por dentro

- **Modelo de la Tienda**: tablas `productos` / `pedidos` / `pedido_items` con **RLS por
  rol** y bucket `productos-fotos` (privado, 2 MB). Baja lógica + FK `ON DELETE RESTRICT`. (ADR-012)
- **Catálogo del admin**: la auditoría la registra el trigger `after_producto_cambio`
  (`SECURITY DEFINER`), no el cliente.
- **Catálogo del residente**: filtros y búsqueda **en servidor** (índice `(categoria, activo)`),
  paginación lazy de 24, búsqueda con **debounce 300 ms** (constantes en `src/lib/tienda.ts`).
- **Pago en línea**: RPC `pagar_factura_residente` (`SECURITY DEFINER`, valida dueño,
  idempotente, método `tarjeta`); reusa el trigger `after_factura_paid` para notificar.
- **CD a staging**: `deploy-staging.yml` con `workflow_run` + `conclusion == success` como
  gate de CI, deploy a Vercel y verificación `/health`. (ADR-013)
- **Tests**: 208 en verde; `src/lib/tienda.ts` con **100 % de cobertura** + 8 tests de
  integración RLS de los 3 roles (gate ≥ 60 %).
