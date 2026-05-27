# ADR-007 — Modelo de datos de Facturas

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 8 |
| Fecha | Sprint 8, Semana 10 |
| Decisores | Scrum Team Zity |

## Contexto

Sprint 8 abre el dominio de **Facturación** del producto. El admin debe poder emitir facturas mensuales por tipo (luz, agua, pensión, multas) — manualmente o en lote para todos los residentes activos. El residente debe verlas en su panel con desglose por tipo y estado. El Sprint 9 (Facturación v2) extenderá con marcar pagada + recordatorios + PDF, y el Sprint 11 (Tienda) integrará pedidos a la factura mensual del residente.

Restricciones que debíamos resolver al modelar:

1. **Decimales sin redondeos sutiles** — JS no maneja `0.1 + 0.2 = 0.3` correctamente. Los montos no pueden ser `number` en BD.
2. **Idempotencia del lote** — emitir el lote dos veces en el mismo mes no debe duplicar facturas.
3. **RLS granular** — residente solo ve las suyas, admin ve todas, técnico no ve ninguna.
4. **Notificación Realtime** — al emitir, el residente recibe notificación en su campana del Sprint 6 sin cambios de infraestructura.
5. **Número legible** — F-2026-05-001 (no UUIDs) para que el residente pueda referenciar la factura.

## Opciones evaluadas

### Tipos de columnas

| Opción | Pros | Contras |
|---|---|---|
| **A · enums Postgres + `numeric(10,2)`** (seleccionada) | Validación en BD (no se acepta tipo inválido aunque el cliente lo intente). Sin redondeos. `numeric` permite hasta 99 999 999.99. Enum exhaustive check con TypeScript. | Migrar enums requiere `DROP TYPE + CREATE TYPE` con cuidado. `numeric` es lento en cálculos masivos (no aplica aquí: el cálculo se hace en sumas pequeñas). |
| B · `text` + check regex + `double precision` | Más flexible para futuros tipos. | El JS `Number` para montos = riesgo de redondeo. Pierde el exhaustive check del enum. |
| C · Tabla `factura_tipos` con FK | Configurable en runtime. | Overkill — los tipos son 4 fijos del dominio del condominio, no van a cambiar. |

### Prevención de duplicación

| Opción | Pros | Contras |
|---|---|---|
| **A · `UNIQUE(residente_id, tipo, periodo)`** (seleccionada) | Garantía en BD — un INSERT duplicado falla con `23505`. La RPC de lote envuelta en transacción se revierte completa. | Mensaje genérico de error — el frontend debe traducirlo a "Ya emitiste este lote para mayo 2026". |
| B · check en aplicación | Más control del mensaje. | Race condition: dos admins emitiendo a la vez en distintos browsers pueden duplicar. |

### Numeración legible

| Opción | Pros | Contras |
|---|---|---|
| **A · Tabla `facturas_secuencia` + trigger BEFORE INSERT** (seleccionada) | Por período. Atómica via `ON CONFLICT DO UPDATE ... RETURNING`. Formato F-YYYY-MM-NNN. | Una pequeña tabla de contadores. Acceso requiere LOCK puntual (despreciable). |
| B · `nextval()` de sequence Postgres | Más simple. | Postgres `SEQUENCE` no acepta parámetros dinámicos por período — necesitaríamos una secuencia por mes (insostenible). |
| C · `COUNT(*) + 1` por período | Cero infraestructura. | Race condition en concurrent INSERTs. |

## Decisión

### Tabla `facturas` (migración `20260527012000_sprint8_facturas.sql`)

```sql
CREATE TYPE public.factura_tipo   AS ENUM ('luz','agua','pension','multa');
CREATE TYPE public.factura_estado AS ENUM ('pendiente','pagada','vencida');

CREATE TABLE public.facturas (
  id            uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id  uuid                    NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo          public.factura_tipo     NOT NULL,
  monto         numeric(10,2)           NOT NULL CHECK (monto >= 0),
  periodo       text                    NOT NULL CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fecha_emision date                    NOT NULL DEFAULT CURRENT_DATE,
  vencimiento   date                    NOT NULL,
  estado        public.factura_estado   NOT NULL DEFAULT 'pendiente',
  descripcion   text,
  numero        text,                                    -- F-YYYY-MM-NNN
  created_at    timestamptz             NOT NULL DEFAULT now(),
  updated_at    timestamptz             NOT NULL DEFAULT now(),
  CONSTRAINT facturas_residente_tipo_periodo_key
    UNIQUE (residente_id, tipo, periodo),
  CONSTRAINT facturas_vencimiento_check
    CHECK (vencimiento >= fecha_emision)
);
```

### Índices

| Índice | Soporta |
|---|---|
| `facturas_residente_vencimiento_idx (residente_id, vencimiento)` | filtro principal del residente: "mis facturas ordenadas por vencimiento" |
| `facturas_estado_idx (estado)` | filtros del admin por estado |
| `facturas_numero_idx (numero) WHERE numero IS NOT NULL` | búsqueda por número legible |

### RLS — políticas con `public.get_user_rol()`

| Política | Quién | Condición |
|---|---|---|
| `facturas_residente_select` | residente | `residente_id = auth.uid() AND get_user_rol() = 'residente'` |
| `facturas_admin_select` | admin | `get_user_rol() = 'admin'` |
| `facturas_admin_insert` | admin | `get_user_rol() = 'admin'` |
| `facturas_admin_update` | admin | `get_user_rol() = 'admin'` |
| _(técnico)_ | técnico | sin política → RLS deniega automáticamente |

> ⚠️ **Nota histórica:** la versión inicial de las migraciones leía el rol de `auth.jwt() -> 'app_metadata' ->> 'rol'`, que retorna `NULL` en Zity. Corregido al patrón estándar `public.get_user_rol()` que lee de `public.usuarios.rol`. Mismo bug que en Sprint 7 (corrección documentada también en [ADR-006](006-recharts.md)).

### Triggers

| Trigger | Cuándo | Qué hace |
|---|---|---|
| `before_factura_numero` | BEFORE INSERT | Asigna `numero` = `F-YYYY-MM-NNN` usando `facturas_secuencia` |
| `facturas_set_updated_at` | BEFORE UPDATE | Actualiza `updated_at = now()` |
| `after_factura_inserted` | AFTER INSERT | Inserta `notificacion` tipo `factura_nueva` con `metadata.factura_id` + `pg_net.http_post` a Edge Function `notificar-factura-nueva` (fire-and-forget) |

### RPC `emitir_facturas_lote(p_tipo, p_monto, p_periodo, p_vencimiento, p_descripcion)`

- `SECURITY DEFINER` + valida `public.get_user_rol() = 'admin'`
- Itera `usuarios WHERE rol='residente' AND estado_cuenta='activo'`
- INSERT en una sola transacción PL/pgSQL: si **una** falla por `unique_violation`, toda se revierte
- Devuelve `jsonb { emitidas: int, error: null }`

## Consecuencias

### Positivas

- **`numeric(10,2)` elimina la clase de bugs por redondeo.** El frontend muestra montos pasados a `Intl.NumberFormat` y NUNCA hace aritmética de montos en JS.
- **`UNIQUE(residente_id, tipo, periodo)` defiende del bug de "emitir lote dos veces"** — el segundo `emitir_facturas_lote` falla con error claro y no deja el lote a medias.
- **Enums + TypeScript** dan exhaustive checks en `switch (factura.tipo)` y `switch (factura.estado)`, atrapando casos olvidados en `tsc --noEmit`.
- **Patrón del Sprint 6 reusado** — el trigger `after_factura_inserted` inserta en `notificaciones` y el `NotificacionesContext` lee Realtime sin cambios.
- **F-YYYY-MM-NNN** es referenciable por el residente ("revisa F-2026-05-003") y se ordena lexicográficamente.

### Negativas

- **Migrar enums es delicado** — si en el futuro el dominio agrega `gas` o `internet`, hay que añadir el valor al `TYPE` (no se puede `DROP TYPE` con FK).
- **`numeric` no se puede sumar en JS sin pasar por servidor** — `Number(monto)` puede perder precisión en montos grandes. El total acumulado del residente se calcula en SQL (sum directamente en la query del hook).
- **El UNIQUE constraint impide casos de uso legítimos como reemisión de factura con error** — no se puede "corregir" una factura, hay que crear una nueva con período distinto o agregar una "nota de crédito" como tipo nuevo (decisión pospuesta para Sprint 9).

## Política para sprints futuros

- **Sprint 9 (Facturación v2)** añadirá: columna `pagada_en timestamptz`, nueva RPC `marcar_factura_pagada(id)`, cron diario que marca `vencida` las que pasan `vencimiento`. NO cambia el modelo base.
- **Sprint 11 (Tienda v2)** insertará facturas tipo `'tienda'` automáticamente desde el carrito al finalizar el mes — esto requerirá agregar `'tienda'` al enum `factura_tipo` y revisar UNIQUE para permitir múltiples facturas tipo `tienda` en el mismo periodo (probable: cambiar UNIQUE a `(residente_id, tipo, periodo, descripcion)` o agregar `subtipo`).
- **Sprint 14 (Dashboard ejecutivo)** consultará `facturas` agrupado por `periodo` y `tipo` para los KPIs del dueño. No cambia el modelo.

## Variables de entorno

No introduce variables nuevas. La Edge Function `notificar-factura-nueva` reusa `RESEND_API_KEY` y `RESEND_FROM_ADDRESS` configurados en Sprint 2/6. Si están ausentes, opera en dry-run (loguea en consola).

## Evidencia

- **Migraciones SQL:** `supabase/migrations/sprint8_*` (4 archivos).
- **RPC:** `emitir_facturas_lote(text, numeric, text, date, text)`.
- **RLS:** 4 políticas verificadas vía tests de integración (Sprint 8 · `src/test/admin/rls-facturas.test.ts`).
- **Edge Function:** `supabase/functions/notificar-factura-nueva/index.ts`, deployada como v1 en el proyecto Supabase.
- **Demo Sprint Review:** Carlos emite factura individual a Laura → notificación en campana en ~1.2 s → Laura ve la factura en `/residente/facturas`.
