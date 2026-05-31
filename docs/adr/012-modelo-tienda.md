# ADR-012 — Modelo de datos de la Tienda interna

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 10 |
| Fecha | Sprint 10, Semana 12 |
| Decisores | Scrum Team Zity |

## Contexto

Sprint 10 abre el dominio de **Tienda interna** del producto. En esta primera iteración (v1) solo se entrega el **catálogo**: el admin da de alta/baja productos (con foto, stock y precio) desde `/admin/tienda` y el residente navega el catálogo en `/residente/tienda`. El **carrito**, el **descuento atómico de stock** y la **integración con la factura mensual** son del Sprint 11 (Tienda v2).

Restricciones que debíamos resolver al modelar:

1. **No romper el historial futuro de pedidos (S11)** — un producto descontinuado no puede desaparecer de los pedidos que lo referencian.
2. **Decimales sin redondeos** — el precio es dinero; aplica la convención `numeric(10,2)` (ver [`conventions.md §1`](../conventions.md)).
3. **RLS por rol** — residente y técnico ven el catálogo activo; el admin gestiona todo; los pedidos son privados del residente dueño.
4. **Foto del producto** — reusar el patrón de Storage probado en el S3 (`solicitudes-fotos`, [ADR-005](005-storage.md)) sin reinventar validación ni firma de URLs.
5. **Evitar una migración doble** — `pedidos`/`pedido_items` se proyectaban para el S11, pero modelarlas ahora (solo BD + RLS) evita una migración estructural posterior.

## Opciones evaluadas

### Baja de producto

| Opción | Pros | Contras |
|---|---|---|
| **A · Baja lógica `activo=false`** (seleccionada) | El producto desaparece del catálogo del residente pero sigue disponible para el historial de pedidos del S11. Reversible (reactivar). Sin riesgo de integridad. | Una columna extra y un filtro `activo=true` en cada lectura del catálogo. |
| B · `DELETE` físico | Cero filas muertas. | Rompe la FK `pedido_items → productos` del S11 (R2). Pierde productos de temporada que el admin quiere recuperar. |

### FK `pedido_items → productos`

| Opción | Pros | Contras |
|---|---|---|
| **A · `ON DELETE RESTRICT`** (seleccionada) | La BD impide borrar un producto referenciado por un pedido. Defiende R2 incluso si alguien intenta un DELETE manual. | Hay que dar de baja lógicamente, no borrar (coherente con la decisión anterior). |
| B · `ON DELETE CASCADE` | Limpieza automática. | Borraría líneas de pedidos históricos — inaceptable para el dashboard ejecutivo del S14. |
| C · `ON DELETE SET NULL` | Conserva el pedido. | Pierde qué producto se pidió; `precio_unitario` quedaría huérfano. |

### Categoría del producto

| Opción | Pros | Contras |
|---|---|---|
| **A · enum Postgres `producto_categoria`** (seleccionada) | Validación en BD + exhaustive check en TypeScript (igual que `factura_tipo`). 4 categorías fijas del dominio. | Añadir una categoría requiere `ALTER TYPE ... ADD VALUE`. |
| B · `text` libre | Flexible. | Sin garantía de consistencia; filtros por categoría se ensucian con typos. |

## Decisión

### Tablas (migración `20260530150000_sprint10_tienda.sql`)

```sql
CREATE TYPE public.producto_categoria AS ENUM ('bebidas','comestibles','limpieza','otros');
CREATE TYPE public.pedido_estado      AS ENUM ('borrador','confirmado','facturado');

CREATE TABLE public.productos (
  id          uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text                       NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion text,
  categoria   public.producto_categoria  NOT NULL DEFAULT 'otros',
  precio      numeric(10,2)              NOT NULL CHECK (precio >= 0),
  stock       integer                    NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo      boolean                    NOT NULL DEFAULT true,
  imagen_url  text,                                  -- path en bucket productos-fotos
  created_at  timestamptz                NOT NULL DEFAULT now(),
  updated_at  timestamptz                NOT NULL DEFAULT now()
);

CREATE TABLE public.pedidos (              -- modelada para el S11, sin UI en v1
  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid                  NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado       public.pedido_estado  NOT NULL DEFAULT 'borrador',
  total        numeric(10,2)         NOT NULL DEFAULT 0 CHECK (total >= 0),
  periodo      text                  CHECK (periodo IS NULL OR periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at   timestamptz           NOT NULL DEFAULT now(),
  updated_at   timestamptz           NOT NULL DEFAULT now()
);

CREATE TABLE public.pedido_items (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid           NOT NULL REFERENCES public.pedidos(id)   ON DELETE CASCADE,
  producto_id     uuid           NOT NULL REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad        integer        NOT NULL CHECK (cantidad >= 1),
  precio_unitario numeric(10,2)  NOT NULL CHECK (precio_unitario >= 0)    -- snapshot al pedir
);
```

> **`residente_id` referencia `public.usuarios(id)`**, no una tabla `profiles`. El artefacto del Sprint usa "profiles" de forma genérica; en Zity la tabla de perfiles es `usuarios` (igual que `facturas`).

### Índices

| Índice | Soporta |
|---|---|
| `productos_categoria_activo_idx (categoria, activo)` | filtro principal del catálogo: categoría sobre productos activos (HU-TIENDA-06) |
| `pedidos_residente_idx (residente_id)` | RLS + historial de pedidos del residente (S11) |
| `pedido_items_pedido_idx (pedido_id)` / `pedido_items_producto_idx (producto_id)` | FKs indexadas (evita `unindexed_foreign_keys`) |

### RLS — políticas con `(select public.get_user_rol())`

| Tabla | Política | Quién | Condición |
|---|---|---|---|
| `productos` | `productos_select` | autenticado | `activo = true OR get_user_rol() = 'admin'` (residente y técnico ven el catálogo activo; admin ve todo) |
| `productos` | `productos_admin_insert` / `productos_admin_update` | admin | `get_user_rol() = 'admin'` — sin DELETE (baja lógica) |
| `pedidos` | `pedidos_select` / `pedidos_update` | residente / admin | `residente_id = auth.uid() OR admin` |
| `pedidos` | `pedidos_residente_insert` | residente / admin | residente crea los suyos; admin todos |
| `pedido_items` | `pedido_items_select/insert/update` | residente / admin | derivado del `pedido` padre vía `EXISTS` |
| _(técnico)_ | — | técnico | sin política en `pedidos`/`pedido_items` → RLS deniega |

> Todas las llamadas a `auth.uid()` y `get_user_rol()` van envueltas en `(select …)` para el initPlan de Postgres ([`docs/db/rls.md §5`](../db/rls.md)). Verificado: el advisor `auth_rls_initplan` **no** reporta las tablas de la Tienda.

### Storage — bucket `productos-fotos`

- Bucket **privado**, `file_size_limit = 2 MB` (2 097 152 bytes), `allowed_mime_types = {image/jpeg, image/png}`.
- Políticas: `productos_fotos_admin_insert/update/delete` (solo admin escribe) + `productos_fotos_select_authenticated` (lectura para cualquier autenticado; control efectivo vía URLs firmadas, igual que `solicitudes-fotos`).
- Nomenclatura del path: `{producto_id}/{timestamp}_{nombre_seguro}`. `productos.imagen_url` guarda el **path**, no la URL pública; se firma al mostrar.

## Consecuencias

### Positivas

- **La baja lógica + `ON DELETE RESTRICT` blindan el historial del S11** — un producto descontinuado nunca rompe un pedido.
- **`numeric(10,2)`** mantiene la convención de dinero del proyecto; el front solo formatea con `Intl.NumberFormat('es-PE', PEN)`.
- **Enums + TypeScript** dan exhaustive checks en `switch (producto.categoria)`.
- **Reuso del patrón de Storage del S3** — misma validación, mismas URLs firmadas; solo cambia el `bucket_id` y el límite a 2 MB.
- **`pedidos`/`pedido_items` ya modeladas** — el S11 añade UI y lógica de carrito sin migración estructural.

### Negativas

- **Filas inactivas se acumulan** — el catálogo del residente filtra `activo=true`; a gran escala convendría archivar, pero el volumen del condominio es bajo.
- **`stock` lo edita solo el admin en v1** — el descuento atómico al comprar es del S11; en v1 el catálogo lee stock en vivo sin caché agresiva (R5).
- **Añadir una categoría futura** requiere `ALTER TYPE ... ADD VALUE` (no reversible en una transacción).

## Política para sprints futuros

- **Sprint 11 (Tienda v2, DoD v3):** carrito del residente + `confirmar_pedido` con descuento atómico de stock (`UPDATE ... SET stock = stock - cantidad WHERE stock >= cantidad`) + el pedido se suma como línea a la factura mensual (posible nuevo `factura_tipo='tienda'`, ver [ADR-007](007-modelo-facturas.md) §Política) + vista admin de pedidos.
- **Sprint 14 (Dashboard ejecutivo):** agrega ingresos de la tienda por período para los KPIs del dueño.

## Variables de entorno

No introduce variables nuevas. El bucket `productos-fotos` se gestiona con la misma `SUPABASE_SERVICE_ROLE_KEY` y el cliente JS autenticado existentes.

## Evidencia

- **Migración SQL:** `supabase/migrations/20260530150000_sprint10_tienda.sql`, aplicada a `zity-br`.
- **RLS:** 9 políticas en `public` + 4 en `storage.objects`, verificadas vía tests de integración (Sprint 10 · `src/test/admin/rls-tienda.test.ts`) con los 3 roles.
- **Advisors:** sin lints nuevos de seguridad ni de `auth_rls_initplan` sobre las tablas de la Tienda.
