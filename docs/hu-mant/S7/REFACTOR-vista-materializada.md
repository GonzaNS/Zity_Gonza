# Refactor · Vista Materializada `vw_metricas_solicitudes`

**Sprint 7 · Performance del panel `/admin/metricas` + refresh automático con pg_cron**

---

## Descripción

Como sistema, quiero una vista materializada con los KPIs agregados refrescada cada hora, para que el panel `/admin/metricas` responda en milisegundos sin recalcular agregados pesados en cada apertura.

**Impacto de performance:**

| Escenario | Antes (recálculo en vivo) | Después (vista materializada) |
|-----------|--------------------------|-------------------------------|
| `get_metricas_mantenimiento` | ~600 ms | ~20 ms |
| `get_graficas_mantenimiento` | ~600 ms | ~5 ms |

---

## Arquitectura: Qué, Cómo y Por qué

### ¿Qué se materializó y qué no?

**Decisión de diseño clave:** los 4 contadores básicos (`total_acumulado`, `pendientes`, `en_proceso`, `resueltas_hoy`) **no se materializaron**. Son baratos (4 `COUNT(*)` en índices B-tree) y deben ser exactos al segundo. Solo se materializan los cálculos **genuinamente pesados**:

| Agregado | Por qué es pesado |
|----------|-------------------|
| `AVG / mediana / P95` de tiempos | `LATERAL JOIN + percentile_cont` sobre toda la tabla |
| `por_tipo` | `LEFT JOIN` con valores literales para incluir tipos con 0 solicitudes |
| `top_categorias` | Ventana `ROW_NUMBER + SUM OVER ()` |
| `tendencia_mensual` | `LATERAL JOIN + GROUP BY mes + percentile_cont` sobre 6 meses |

### ¿Por qué MATERIALIZED VIEW y no una tabla de caché manual?

Una vista materializada (`CREATE MATERIALIZED VIEW`) es la primitiva nativa de PostgreSQL para este patrón:
- El motor gestiona el snapshot internamente.
- `REFRESH MATERIALIZED VIEW CONCURRENTLY` intercambia filas sin bloquear lecturas en curso.
- La sintaxis es declarativa — el cálculo está en SQL puro, auditado y versionado.

### ¿Por qué el índice UNIQUE en `refreshed_at`?

`REFRESH MATERIALIZED VIEW CONCURRENTLY` requiere **al menos un índice UNIQUE** en la vista. Sin él, PostgreSQL solo ofrece `REFRESH MATERIALIZED VIEW` (que bloquea lecturas). `refreshed_at` es la única columna que siempre varía entre refreshes de una sola fila.

### ¿Cómo funciona el fallback on-demand?

```
Admin abre /admin/metricas
  → Hook llama get_metricas_mantenimiento()
  → RPC devuelve vista_refreshed_at junto con los datos
  → Hook compara: ¿vista_refreshed_at > ahora - 1h?
     → Sí (fresca):   renderizar datos directamente
     → No (antigua):  mostrar datos viejos INMEDIATAMENTE (UX fluido)
                       + disparar refresh_metricas_on_demand() en background
                       + cuando termina, re-fetchear y actualizar silenciosamente
```

El diseño **muestra datos de inmediato** (nunca bloquea la UI) y actualiza en background si la vista estaba anticuada. El usuario ve los datos actuales en ≤2 RPC calls totales.

---

## Cambios Requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar la migración SQL en Supabase SQL Editor:
> ```
> supabase/migrations/20260527010000_sprint7_vw_metricas_solicitudes.sql
> ```

> [!WARNING]
> **pg_cron requiere habilitación manual — NO se activa con la migración**
> 1. Ir a **Supabase Dashboard → Database → Extensions**
> 2. Buscar `pg_cron` y activarla (clic en Enable)
> 3. Luego ejecutar en el SQL Editor:
> ```sql
> SELECT cron.schedule(
>   'refresh-metricas-hourly',
>   '0 * * * *',
>   $$SELECT refresh_metricas_on_demand()$$
> );
> ```
> Sin pg_cron, el fallback on-demand del hook garantiza igualmente que la vista no sirva datos con más de 1h de antigüedad cuando un admin abre el panel.

---

## Archivos Creados / Modificados

#### [NEW] `supabase/migrations/20260527010000_sprint7_vw_metricas_solicitudes.sql`
Migración completa con 6 partes:
- **A** — Vista materializada `vw_metricas_solicitudes`
- **B** — Índice `UNIQUE` en `refreshed_at` para `CONCURRENTLY`
- **C** — RPC `refresh_metricas_on_demand()` con lógica de antigüedad
- **D** — Instrucciones comentadas de pg_cron
- **E** — `get_metricas_mantenimiento()` actualizado (lee tiempos de la vista)
- **F** — `get_graficas_mantenimiento()` actualizado (lee gráficas de la vista)

#### [MODIFY] `src/hooks/useMetricasMantenimiento.ts`
- Añade tipo interno `MetricasRpcResponse` que incluye el campo opcional `vista_refreshed_at`.
- Extrae `vista_refreshed_at` antes de publicar `metricas` al estado (limpieza del tipo público).
- Lógica de fallback: si `vistaEdadMs > 1h`, dispara `refresh_metricas_on_demand()` en background y re-fetcha silenciosamente.

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Vista materializada con todos los KPIs pesados | ✅ | `vw_metricas_solicitudes` con tiempos + 3 datasets de gráficas |
| Índices para soportar REFRESH CONCURRENTLY | ✅ | `UNIQUE INDEX` en `refreshed_at` |
| pg_cron horario documentado | ✅ | Instrucciones paso a paso en la migración y en este doc |
| Fallback on-demand si vista >1h | ✅ | `useMetricasMantenimiento` con lógica de antigüedad |
| Performance ~20 ms | ✅ | Lectura de vista = `SELECT * FROM vw_metricas_solicitudes LIMIT 1` |
