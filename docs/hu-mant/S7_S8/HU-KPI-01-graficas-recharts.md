# HU-KPI-01 · Gráficas Recharts en el dashboard

**Sprint 7 · 3 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como administrador, quiero gráficas visuales de barras y líneas en el dashboard, para identificar tendencias y categorías más frecuentes sin tener que leer tablas.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Gráfica de barras horizontales por tipo (Recharts BarChart) | ✅ | `GraficaTipoBarra` — todos los tipos, ordenados desc |
| Gráfica de líneas con tendencia mensual AVG + mediana (Recharts LineChart) | ✅ | `GraficaTendencia` — últimos 6 meses, tooltips |
| Top 5 categorías con barras de proporción | ✅ | `GraficaTopCategorias` — CSS nativo, ranking numerado |
| Paleta de colores Zity (azul Oxford + warm gold) | ✅ | Literales CSS de los tokens Zity (no var()) |
| Lazy load — Recharts no infla el bundle inicial | ✅ | `React.lazy` + `.then(m => ({ default: m.X }))` |
| Responsiva: móvil apila + scroll horizontal en LineChart | ✅ | Grid 1→5 cols + `overflow-x-auto` |
| Tooltips activos al hover con valores exactos | ✅ | `TooltipBase` personalizado para BarChart y LineChart |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql) | RPC `get_graficas_mantenimiento()` — 3 datasets en 1 llamada |
| [`src/hooks/useGraficasMantenimiento.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useGraficasMantenimiento.ts) | Hook con auto-refresh 60 s + pausa background |
| [`src/components/admin/GraficasMetricas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/admin/GraficasMetricas.tsx) | Tres componentes: `GraficaTipoBarra`, `GraficaTendencia`, `GraficaTopCategorias` |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/lib/metricas.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metricas.ts) | Tipos para gráficas: `DatoPorTipo`, `DatoTendenciaMensual`, `DatoTopCategoria`, `GraficasMantenimiento`, labels, `formatearMes` |
| [`src/pages/admin/Metricas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/admin/Metricas.tsx) | Imports lazy de las 3 gráficas + sección "Gráficas" con Suspense + `useGraficasMantenimiento` |

---

## Explicación técnica detallada

### 1. RPC `get_graficas_mantenimiento()` en PostgreSQL

**Archivo:** `supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql`

**Qué es:** Una función SECURITY DEFINER (mismo patrón que PBI-22) que consolida en una sola llamada de red los tres datasets para las gráficas:

```sql
RETURN jsonb_build_object(
  'por_tipo',          COALESCE(v_por_tipo, '[]'::jsonb),
  'tendencia_mensual', COALESCE(v_tendencia, '[]'::jsonb),
  'top_categorias',    COALESCE(v_top_categorias, '[]'::jsonb)
);
```

**Por qué una sola función para los tres datasets:**  
Cada `supabase.rpc()` implica un viaje de red (latencia + overhead de PostgREST). Consolidar los tres datasets en una función reduce a 1 el número de round-trips al abrir la página, mejorando la percepción de carga.

**Cómo funciona cada dataset:**

**`por_tipo`** — Usa un `VALUES` literal de los 5 tipos como tabla de referencia y hace `LEFT JOIN` con `solicitudes`. Esto garantiza que todos los tipos aparecen en la gráfica incluso si tienen 0 solicitudes (si se usara `GROUP BY` directamente solo aparecerían los que tienen datos):
```sql
FROM (VALUES ('mantenimiento'),('reparacion'),...) AS t(tipo)
LEFT JOIN solicitudes s ON s.tipo = t.tipo
GROUP BY t.tipo
```

**`tendencia_mensual`** — Usa `LATERAL JOIN` para buscar la primera vez que cada solicitud llegó a estado `resuelta` o `cerrada`, luego agrupa por mes con `DATE_TRUNC('month', s.created_at)` y calcula `AVG` y `percentile_cont(0.5)` (mediana). Solo incluye los últimos 6 meses con `NOW() - INTERVAL '6 months'`.

**`top_categorias`** — Usa `ROW_NUMBER() OVER (ORDER BY total DESC)` para rankear las categorías y `SUM(total) OVER ()` (window function) para calcular el porcentaje relativo sobre el total de solicitudes, todo en una sola pasada sobre la tabla:
```sql
porcentaje: ROUND(total::numeric / grand_total * 100, 1)
```

---

### 2. Tipos en `src/lib/metricas.ts`

**Qué se agregó:** Cuatro tipos de datos y dos mapas de labels que documentan la forma exacta de lo que devuelve el RPC.

**Por qué co-ubicar tipos y labels en `metricas.ts`:**  
El hook `useGraficasMantenimiento`, la página `Metricas.tsx` y los componentes `GraficasMetricas.tsx` comparten estos tipos. Mantenerlos en el mismo módulo que las fórmulas crea un único punto de verdad para "qué son los datos de métricas" — si el RPC cambia, solo hay un archivo que actualizar.

**`LABEL_TIPO` y `LABEL_CATEGORIA`** son maps de clave interna → string español:
```typescript
const LABEL_TIPO: Record<string, string> = {
  mantenimiento: 'Mantenimiento',
  reparacion:    'Reparación',
  ...
}
```
Esto evita que las cadenas en español estén hardcodeadas en los componentes visuales, facilitando futura internacionalización.

**`formatearMes('2025-11')`** → `'nov. 25'`:  
Convierte el formato `YYYY-MM` que llega del SQL (portable y ordenable) a una etiqueta legible para el eje X del LineChart. Usa `Date.toLocaleDateString('es', ...)` para que el formato respete el locale del usuario.

---

### 3. Hook `useGraficasMantenimiento`

**Archivo:** `src/hooks/useGraficasMantenimiento.ts`

**Qué hace:** Idéntico en estructura a `useMetricasMantenimiento` del PBI-22. Llama al RPC, gestiona `loading/error`, auto-refresca cada 60 s y pausa con `visibilitychange`.

**Por qué un hook separado (y no fusionarlo con useMetricasMantenimiento):**  
Los dos paneles (KPIs numéricos vs. gráficas) podrían eventualmente tener ciclos de refresh distintos, o las gráficas podrían moverse a otra página. Mantenerlos separados respeta el principio de responsabilidad única. Además, permite que las gráficas empiecen a cargar en paralelo con los KPIs al montar la página.

---

### 4. Componentes Recharts (`GraficasMetricas.tsx`)

**Archivo:** `src/components/admin/GraficasMetricas.tsx`

**Por qué este archivo está en `components/admin/` y no en `pages/admin/`:**  
Es un módulo de presentación puro (no tiene lógica de negocio ni llama a APIs directamente). Al ubicarlo en `components/` podría reutilizarse desde otra página admin sin mover archivos.

#### Gráfica 1: `GraficaTipoBarra` — BarChart horizontal

**Qué usa:** `BarChart` con `layout="vertical"`, `XAxis` numérico y `YAxis` categórico. Esto da una lectura más natural del ranking izquierda→derecha (comparar longitud de barras) que las barras verticales.

**`<Cell>`** — Recharts no soporta directamente un array de colores por barra en `BarChart`. La solución estándar es usar `<Cell>` dentro de `<Bar>` y asignar el color via `fill` a cada celda individualmente, indexando el array `COLORES_TIPO`.

**`ResponsiveContainer width="100%" height={220}`** — `ResponsiveContainer` es el wrapper de Recharts que permite que la gráfica se adapte al ancho del contenedor padre usando `ResizeObserver` internamente. Sin él, Recharts necesita dimensiones fijas en píxeles.

#### Gráfica 2: `GraficaTendencia` — LineChart

**Dos líneas:** La línea del promedio es sólida (`strokeDasharray` ausente) y la de la mediana es punteada (`strokeDasharray="5 3"`). Esta convención visual comunica de inmediato cuál es más "confiable" (mediana punteada ≠ secundaria; es una decisión de diseño para diferenciación visual).

**`connectNulls`** — Cuando un mes no tiene datos (ej: el equipo no resolvió nada en febrero), el valor es `null`. Con `connectNulls={true}` Recharts traza una línea directa saltando el mes vacío en lugar de romper la serie. Esto evita gráficas fragmentadas cuando hay meses con poca actividad.

**Scroll horizontal en móvil:** El `<div className="overflow-x-auto">` envuelve el `ResponsiveContainer`. En pantallas pequeñas la gráfica de líneas puede tener demasiados puntos para caber; el scroll horizontal es más honesto que comprimir los datos.

**Tooltip personalizado `TooltipBase`:**  
Recharts proporciona un tooltip por defecto pero no aplica el diseño Zity. `TooltipBase` es un componente React normal (no Recharts) que se pasa como `content` prop. Recibe `payload` (los datos de las series activas en ese punto) y los renderiza con el sistema de clases Tailwind/Zity. El `formatValor` prop permite que cada gráfica decida cómo formatear sus valores (solicitudes vs. horas).

#### Gráfica 3: `GraficaTopCategorias` — CSS nativo

**No usa Recharts.** Para un ranking de 5 ítems con porcentajes, una barra de `<div>` con `width: ${porcentaje}%` es más ligera, más legible y más fácil de estilizar que añadir otro `BarChart`. La transición CSS `transition-all duration-700` da una animación de entrada suave sin JS adicional.

**Círculo numerado:** Cada categoría tiene un badge circular con su posición (1–5) coloreado con el color correspondiente del array `coloresCat`. Esto refuerza la lectura de ranking sin texto adicional.

---

### 5. Lazy load con `React.lazy` en `Metricas.tsx`

**Cómo funciona:**
```typescript
// En Metricas.tsx (que ya es lazy desde App.tsx)
const GraficaTipoBarra = lazy(() =>
  import('../../components/admin/GraficasMetricas')
  .then(m => ({ default: m.GraficaTipoBarra }))
)
```

**Por qué el `.then(m => ({ default: m.X }))`:**  
`React.lazy` solo acepta módulos con un `export default`. `GraficasMetricas.tsx` exporta tres componentes con nombre (`export function GraficaTipoBarra`). El `.then()` crea un objeto que "finge" ser un módulo con un único `export default`, mapeando la exportación nombrada.

**El efecto en el bundle:**  
`GraficasMetricas.tsx` importa Recharts (`import { BarChart, ... } from 'recharts'`). Si ese import fuera estático (en la parte superior de `Metricas.tsx`), Vite incluiría Recharts (~370 KB min) en el chunk de `Metricas.tsx`, que a su vez ya es lazy. Con el lazy anidado, Recharts queda en su propio chunk separado que solo se descarga cuando el usuario llega a `/admin/metricas`.

**`<Suspense fallback={<SkeletonGraficaFallback />}>`:**  
Mientras el chunk de Recharts se descarga por primera vez, `Suspense` muestra el skeleton. En visitas posteriores el chunk ya está en caché del navegador y el skeleton no llega a verse.

---

### 6. Paleta de colores Zity en Recharts

**Por qué los colores son literales y no `var(--color-primary-600)`:**  
Recharts renderiza en SVG y los valores de color se pasan como atributos SVG (`fill`, `stroke`). SVG en la mayoría de navegadores no resuelve CSS custom properties en atributos de presentación (solo en `style`). Por eso se usaron los valores hex literales extraídos de `index.css`:

```typescript
const ZITY = {
  primary:   '#1b3a4b',   // primary-600
  accent:    '#d4a043',   // accent-500
  success:   '#4a7c59',
  ...
}
```

---

## Cambios requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar la migración SQL en Supabase SQL Editor antes de que las gráficas funcionen en producción.

### Migración a ejecutar

```
supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql
```

Crea `get_graficas_mantenimiento()` con:
- **SECURITY DEFINER** — permisos de postgres para leer todas las solicitudes.
- **Verificación JWT** — mismo mecanismo que `get_metricas_mantenimiento`.
- **REVOKE/GRANT** — solo rol `authenticated` puede invocarla.

### Prerequisitos

No se crean tablas ni columnas nuevas. Las consultas usan:

| Tabla | Columnas |
|---|---|
| `solicitudes` | `tipo`, `categoria`, `created_at` |
| `historial_estados` | `solicitud_id`, `estado_nuevo`, `created_at` |

### Verificación en SQL Editor

```sql
-- Como admin autenticado:
SELECT get_graficas_mantenimiento();
-- Debe devolver un JSON con:
-- { "por_tipo": [...], "tendencia_mensual": [...], "top_categorias": [...] }

-- Como no-admin debe fallar con SQLSTATE 42501
```

---

## Layout responsivo

```
Desktop (lg):
┌─────────────────────────┬─────────────────┐
│  Barras por tipo (3/5)  │  Top 5 cats     │
│  GraficaTipoBarra       │  (2/5)          │
└─────────────────────────┴─────────────────┘
┌────────────────────────────────────────────┐
│  Tendencia mensual — ancho completo        │
│  GraficaTendencia (scroll-x en móvil)      │
└────────────────────────────────────────────┘

Móvil (sm):
┌───────────────────┐
│  Barras por tipo  │
└───────────────────┘
┌───────────────────┐
│  Top 5 cats       │
└───────────────────┘
┌───────────────────┐
│ Tendencia mensual │ ← scroll horizontal si > viewport
└───────────────────┘
```
