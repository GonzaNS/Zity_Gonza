# HU-HOME-04 · Tarjeta 'Pedidos del mes'

**Sprint 13 · 2 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero ver el resumen de mis pedidos del mes, para saber cuánto llevo gastado en la tienda.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Muestra unidades pedidas en el mes actual | ✅ | Suma de todas las cantidades de ítems comprados en pedidos activos (no borrador) del mes. |
| Muestra monto acumulado del mes | ✅ | Sumatoria de los totales cobrados en los pedidos en curso y cerrados del período mensual actual. |
| Enlace al historial de pedidos | ✅ | El enlace en cabecera y footer redirige a `/residente/tienda/historial`. |
| Datos provienen de `vw_home_pedidos` | ✅ | Los datos son provistos de forma optimizada por el hook `useHomePedidos`. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260616120300_sprint13_vw_home_pedidos.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616120300_sprint13_vw_home_pedidos.sql) | DDL de la vista `vw_home_pedidos` que calcula dinámicamente los KPIs agregados del mes actual de forma eficiente. |
| [`src/hooks/useHomePedidos.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useHomePedidos.ts) | Hook para consultar la vista, mapear KPIs y tipar los resultados. |
| [`src/components/residente/CardHomePedidos.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/residente/CardHomePedidos.tsx) | Componente UI de la tarjeta de pedidos con la cabecera del mes, lista de últimas compras y botón para entrar a la tienda. |

---

## Explicación técnica detallada

### 1. Filtrado Temporal y Sumatoria de Ítems en PostgreSQL

**Archivo:** `supabase/migrations/20260616120300_sprint13_vw_home_pedidos.sql`

La vista utiliza un CTE (`WITH`) para determinar el período del mes en curso bajo la zona horaria de Lima (ej. `'2026-06'`). Posteriormente filtra y une los pedidos no-borrador (`estado != 'borrador'`) del residente que cumplan con dicho período.

Para evitar un JOIN pesado en base de datos que multiplique las filas, el número de unidades en cada pedido se obtiene mediante una subconsulta escalar optimizada que cuenta las unidades de `pedido_items` para ese pedido:

```sql
(
  SELECT COALESCE(SUM(pi.cantidad), 0)
  FROM public.pedido_items pi
  WHERE pi.pedido_id = p.id
) AS unidades_pedido
```

Y finalmente se obtienen los consolidados agregados usando Window Functions (`OVER ()`):

```sql
SELECT
  id,
  estado,
  total::numeric                   AS total,
  periodo,
  factura_id,
  created_at,
  unidades_pedido,

  -- KPIs agregados de ventana
  COUNT(*)             OVER ()     AS pedidos_mes,
  SUM(unidades_pedido) OVER ()     AS unidades_mes,
  SUM(total)           OVER ()     AS total_mes
FROM pedidos_mes
ORDER BY created_at DESC
LIMIT 3;
```

---

## Cambios requeridos en Supabase ⚠️

### Paso 1 — Ejecutar la migración

Aplica el DDL de la vista en la consola de Supabase:
```
supabase/migrations/20260616120300_sprint13_vw_home_pedidos.sql
```

Establece permisos mínimos:
```sql
GRANT SELECT ON public.vw_home_pedidos TO authenticated;
REVOKE ALL  ON public.vw_home_pedidos FROM anon, public;
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Residente sin compras en el mes actual | La vista no devuelve filas. El hook mapea a `RESUMEN_VACIO` (monto y unidades en 0). La tarjeta muestra "Sin pedidos este mes" junto con un botón invitándolo a visitar la tienda. |
| Pedidos en estado borrador | Excluidos explícitamente en el filtrado (`WHERE estado != 'borrador'`) puesto que no representan compras formalizadas. |
| Múltiples pedidos en el mes | La lista secundaria de la tarjeta se limita a los 3 más recientes (`LIMIT 3`), pero la cabecera (KPIs de ventana) acumula la suma de todos los pedidos del mes sin importar el límite visual. |
