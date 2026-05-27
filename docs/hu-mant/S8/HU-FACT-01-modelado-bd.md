# HU-FACT-01 · Modelado BD de Facturas

**Sprint 8 · Tabla `facturas` + RLS + UNIQUE + Trigger de notificación**

---

## Descripción

Como sistema, quiero una tabla `facturas` con tipo, monto, periodo, fechas, estado y RLS por rol, para soportar la emisión, consulta y futuras integraciones (Tienda S11, Dashboard ejecutivo S14).

---

## Arquitectura: Qué, Cómo y Por Qué

### Enums nativos de PostgreSQL

En lugar de columnas `text` con `CHECK (tipo IN (...))`, usamos **tipos enum de PostgreSQL** (`CREATE TYPE factura_tipo` y `CREATE TYPE factura_estado`).

**Por qué:** Los enums en PG son ciudadanos de primera clase: se validan en BD antes de que el dato llegue a la aplicación, aparecen correctamente tipados en el cliente de Supabase y permiten exhaustive type-checking en TypeScript. Son más seguros que un `CHECK` simple porque el nombre del tipo queda documentado en el schema.

### UNIQUE(residente_id, tipo, periodo)

**Por qué:** Impide emitir dos facturas del mismo concepto en el mismo mes (ej: dos recibos de luz para el Depto 3 en Mayo 2026). La validación en BD es más robusta que cualquier check en el frontend porque es atómica: si dos requests llegan simultáneamente, solo uno puede insertar.

### Constraint de formato en `periodo`

```sql
CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$')
```

Garantiza que `periodo` sea siempre un `'YYYY-MM'` válido (ej: `'2026-05'`). Rechaza valores inválidos como `'2026-13'`, `'26-5'` o strings libres.

### RLS por rol — sin política = acceso denegado

| Rol | SELECT | INSERT | UPDATE | DELETE |
|-----|--------|--------|--------|--------|
| `residente` | ✅ solo las suyas (`residente_id = auth.uid()`) | ❌ | ❌ | ❌ |
| `admin` | ✅ todas | ✅ | ✅ | ❌ |
| `tecnico` | ❌ (sin política → denegado por RLS) | ❌ | ❌ | ❌ |

**Por qué no hay DELETE para admin:** Las facturas son registros contables. La práctica estándar es marcarlas como vencidas o anuladas, no eliminarlas, para mantener trazabilidad financiera. El DELETE se omite intencionalmente y se implementaría con una columna `anulada` en futuros sprints si se requiere.

### Trigger `after_factura_inserted` con SECURITY DEFINER

El trigger reutiliza exactamente el mismo patrón que `after_solicitud_estado_changed` del Sprint 6:

1. **SECURITY DEFINER:** corre con los permisos del owner (`postgres`), permitiendo insertar notificaciones para otros usuarios sin violar RLS.
2. **`REVOKE ALL ... FROM anon, authenticated, public`:** la función no es invocable como RPC, solo el trigger la ejecuta.
3. **`EXCEPTION WHEN others THEN RAISE WARNING`:** best-effort — un fallo en la notificación nunca revierte el INSERT de la factura (idempotencia).

```sql
INSERT INTO public.notificaciones
  (usuario_id, solicitud_id, tipo, titulo, mensaje, leida)
VALUES
  (NEW.residente_id, NULL, 'factura_nueva', v_titulo, v_mensaje, false);
```

`solicitud_id = NULL` porque una factura no es una solicitud de mantenimiento. La columna lo permite según su DDL original.

---

## Cambios Requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar la migración SQL en Supabase SQL Editor:
> ```
> supabase/migrations/20260527012000_sprint8_facturas.sql
> ```
> Esta migración es **idempotente** (usa `IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`), por lo que es segura de re-ejecutar.

---

## Archivos Creados

#### [NEW] `supabase/migrations/20260527012000_sprint8_facturas.sql`
Migración con 6 partes:
- **A** — Enums `factura_tipo` y `factura_estado`
- **B** — Tabla `facturas` con todos los constraints
- **C** — Índices + trigger `updated_at`
- **D** — Políticas RLS por rol
- **E** — Amplía CHECK de `notificaciones.tipo` para incluir `'factura_nueva'`
- **F** — Trigger `after_factura_inserted` con notificación Realtime

#### [NEW] `src/lib/facturas.ts`
Tipos TypeScript derivados del DDL:
- `Factura`, `FacturaInsert`, `FacturaTipo`, `FacturaEstado`
- Labels legibles: `LABEL_FACTURA_TIPO`, `LABEL_FACTURA_ESTADO`
- Estilos para badges: `BADGE_FACTURA_ESTADO`
- Utilidades: `formatearMonto()`, `formatearPeriodo()`, `estaVencida()`

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Tabla `facturas` con todos los campos requeridos | ✅ | id, residente_id, tipo (enum), monto, periodo, fechas, estado (enum), descripcion, timestamps |
| UNIQUE(residente_id, tipo, periodo) | ✅ | Constraint nombrado `facturas_residente_tipo_periodo_key` |
| Índices por (residente_id, vencimiento) y (estado) | ✅ | `facturas_residente_vencimiento_idx` + `facturas_estado_idx` |
| RLS por rol: residente SELECT propio; admin full; técnico sin acceso | ✅ | 3 políticas RLS + sin política para técnico |
| Trigger `after_factura_inserted` → notificación `factura_nueva` | ✅ | Reutiliza Realtime S6, SECURITY DEFINER, best-effort |
| Tests de integración | ⚠️ | Las políticas RLS son testeable manualmente en Supabase SQL Editor con `SET LOCAL role ...` — los tests de integración automáticos (con Vitest + supabase-js-mock) se planifican para HU-FACT-02 cuando exista la UI |

---

## Integración con Sprints Futuros

```
Sprint 8  · HU-FACT-02 — Vista /residente/facturas (lista + filtros)
Sprint 8  · HU-FACT-03 — Vista /admin/facturas (emisión + gestión)
Sprint 11 · Tienda      — Lectura de facturas estado='pendiente' para cobro en línea
Sprint 14 · Dashboard   — Agregados de monto por tipo/período para KPIs ejecutivos
```
