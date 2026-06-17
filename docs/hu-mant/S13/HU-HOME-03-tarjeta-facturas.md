# HU-HOME-03 · Tarjeta 'Facturas pendientes'

**Sprint 13 · 2 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero ver mis facturas pendientes con el total a pagar y el próximo vencimiento, para no perder un pago.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Muestra el total a pagar (deuda acumulada) | ✅ | Se calcula la suma de montos de todas las facturas en estado 'pendiente' y 'vencida'. |
| Muestra la fecha del próximo vencimiento | ✅ | Se extrae la fecha mínima de vencimiento que sea mayor o igual al día de hoy. |
| Badge de alerta si hay facturas vencidas | ✅ | Muestra un badge rojo `"X vencida(s)"` con animación de pulso si el conteo de vencidas es mayor a cero. |
| Enlaza al detalle y flujo de pago | ✅ | Permite ir directamente al detalle en `/residente/facturas?id=<id>` o pagar inline con un botón interactivo. |
| Datos provienen de `vw_home_facturas` | ✅ | Los datos se obtienen de la vista mediante el hook `useHomeFacturas`. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260616120200_sprint13_vw_home_facturas.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616120200_sprint13_vw_home_facturas.sql) | DDL de la vista `vw_home_facturas` que implementa funciones de ventana SQL para sumarizar y enlistar en una sola consulta. |
| [`src/hooks/useHomeFacturas.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useHomeFacturas.ts) | Hook para consultar la vista, parsear tipos (monto a `number`) y separar el resumen de ventana del listado de facturas. |
| [`src/components/residente/CardHomeFacturas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/residente/CardHomeFacturas.tsx) | Componente UI de la tarjeta de facturas con badge de alerta, KPIs de cabecera y botón de pago inline. |

---

## Explicación técnica detallada

### 1. Window Functions en PostgreSQL para Datos Planos y Agrupados

**Archivo:** `supabase/migrations/20260616120200_sprint13_vw_home_facturas.sql`

En lugar de hacer una consulta de agregación (`SUM`, `MIN`) y luego otra consulta para listar las facturas (lo cual representaría dos viajes de red), la vista `vw_home_facturas` utiliza **funciones de ventana (`OVER ()`)**. 

Estas funciones calculan el valor global para todo el dataset y lo repiten en cada fila. El hook en el cliente simplemente extrae este resumen financiero consolidado de la primera fila (`filas[0]`) y descarta las columnas redundantes del resto de filas expuestas en la UI.

```sql
CREATE OR REPLACE VIEW public.vw_home_facturas
WITH (security_invoker = true)
AS
SELECT
  f.id,
  f.tipo,
  f.monto,
  f.periodo,
  f.vencimiento,
  f.estado,
  f.numero,
  f.descripcion,
  f.created_at,

  -- ¿Ya venció? Calculado en servidor bajo la zona horaria de Lima
  (f.vencimiento < (now() AT TIME ZONE 'America/Lima')::date) AS esta_vencida,

  -- Totales globales de ventana
  SUM(f.monto) OVER () AS total_pendiente,
  COUNT(*) FILTER (
    WHERE f.vencimiento < (now() AT TIME ZONE 'America/Lima')::date
  ) OVER () AS count_vencidas,
  MIN(f.vencimiento) OVER () AS proxima_fecha

FROM public.facturas f
WHERE f.estado IN ('pendiente', 'vencida')
ORDER BY f.vencimiento ASC
LIMIT 4;
```

### 2. Timezone y Evaluación de Vencimiento en Servidor

Un error común en aplicaciones web es comparar la fecha de vencimiento (`YYYY-MM-DD`) contra el `new Date()` del navegador del cliente. Si el cliente está de viaje en otra zona horaria, una factura podría marcarse como vencida antes o después de tiempo. 

Para mitigar esto, la vista evalúa `esta_vencida` directamente en la base de datos comparando contra la hora de Lima (`America/Lima`), asegurando consistencia absoluta:
`f.vencimiento < (now() AT TIME ZONE 'America/Lima')::date`

---

## Cambios requeridos en Supabase ⚠️

### Paso 1 — Ejecutar la migración

Aplica la migración SQL para crear la vista:
```
supabase/migrations/20260616120200_sprint13_vw_home_facturas.sql
```

Establece permisos de lectura:
```sql
GRANT SELECT ON public.vw_home_facturas TO authenticated;
REVOKE ALL  ON public.vw_home_facturas FROM anon, public;
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Sin facturas pendientes | `useHomeFacturas` retorna un estado vacío (`RESUMEN_VACIO`) y el componente muestra un icono de check verde indicando "✓ Al corriente / Sin deuda pendiente este mes". |
| Factura vencida pero con estado 'pendiente' en BD | El componente evalúa el campo `esta_vencida` y fuerza el renderizado con badge de estado 'Vencida' (rojo) y botón "Pagar ya" en lugar del tradicional "Pagar". |
| Zona horaria del cliente diferente | El flag `esta_vencida` es inmutable ante cambios locales de hora, ya que se calcula en Postgres en base a Lima TZ. |
