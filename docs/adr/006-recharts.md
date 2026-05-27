# ADR-006 — Librería de gráficas: Recharts vs SVG nativo

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 7 |
| Fecha | Sprint 7, Semana 9 |
| Decisores | Scrum Team Zity |

## Contexto

El Sprint 7 entrega el panel `/admin/metricas` con KPIs operativos del módulo de mantenimiento (PBI-22) y tres gráficas visuales (HU-KPI-01):

- **Barras horizontales** por tipo de solicitud (mantenimiento, reparación, queja, sugerencia, otro).
- **Líneas** con tendencia mensual del tiempo de resolución (promedio + mediana, últimos 6 meses).
- **Top 5 categorías** con barras de proporción.

Necesitamos elegir cómo dibujar estas gráficas. Las restricciones del proyecto son:

- Bundle inicial bajo control — el `/admin` ya carga AdminShell, ProtectedRoute y dependencias de Supabase Realtime; no podemos inflarlo con una librería pesada solo por las gráficas.
- Estilo consistente con la paleta Zity (azul Oxford `primary` + warm gold `accent`).
- Responsive (móvil apila + scroll horizontal en la de líneas).
- Tooltips al hover con valores formateados (horas, conteos).
- DoD v2 — coverage ≥ 60% en módulos core; la lógica de KPIs vive en `src/lib/metricas.ts` (puro, testeable sin gráficas).
- Capacidad semanal del Sprint: 15 h. La feature de gráficas tiene 3 h asignadas.

## Opciones evaluadas

| Opción | Pros | Contras |
|---|---|---|
| **A · Recharts** (seleccionada) | API declarativa basada en componentes React (composición natural). Soporta `BarChart`/`LineChart` out-of-the-box con `Tooltip`, `Legend`, `ResponsiveContainer`. Tipos TypeScript completos. Permite paleta Zity vía `fill`/`stroke` literales en `<Cell>` y `<Line>`. Tree-shakable, compatible con `React.lazy`. | Tamaño no trivial (~370 KB min, ~110 KB gzip). Para Sprint 7 se mitiga con lazy load anidado — solo se descarga al abrir `/admin/metricas`. |
| B · SVG nativo escrito a mano | Cero dependencias añadidas. Control total del markup. | Tiempo de implementación 3-4× mayor para 3 gráficas. Hay que reimplementar tooltips, ejes, leyendas, `ResponsiveContainer` (ResizeObserver), interpolación de líneas, marcas de los ticks. Riesgo R6 (bugs en formato de ejes/tooltips). |
| C · Chart.js (vía react-chartjs-2) | Adopción amplia, animaciones por defecto. | API imperativa (canvas, no SVG → menos accesible/no copiable). Tamaño similar a Recharts. Personalización de tooltip requiere wrapper React adicional. |
| D · Apache ECharts | Muy potente, soporta zoom/pan, casos avanzados. | Bundle ~1 MB minified. Sobrepasa cualquier presupuesto razonable del free tier de Vercel. Overkill para 3 gráficas básicas. |
| E · Visx (Airbnb) | Componentes "low-level" basados en d3, render SVG. | Requiere reimplementar conceptos básicos (ejes, leyendas) componiendo primitivas. Más cerca de "construir tu propia librería" que de usar una. |

## Decisión

Usar **Recharts** y mitigar el tamaño con **lazy load anidado**.

### Configuración técnica

**1. Lazy load doble — Recharts solo se descarga al abrir `/admin/metricas`:**

```typescript
// src/pages/admin/Metricas.tsx
const GraficaTipoBarra = lazy(() =>
  import('../../components/admin/GraficasMetricas')
  .then(m => ({ default: m.GraficaTipoBarra }))
)
```

`GraficasMetricas.tsx` importa Recharts (`import { BarChart, ... } from 'recharts'`). Como ese módulo es lazy desde `Metricas.tsx` (que a su vez es lazy desde `App.tsx`), Vite emite Recharts en un chunk separado que **solo se descarga la primera vez que el admin navega a `/admin/metricas`**. Visitas posteriores lo sirve desde el caché del navegador.

**2. Paleta Zity literal (no `var(--color-primary-600)`):**

Recharts renderiza en SVG y los valores de color se pasan como atributos SVG (`fill`, `stroke`). SVG no resuelve CSS custom properties en atributos de presentación. Se usaron los valores hex literales extraídos de `index.css`:

```typescript
const ZITY = {
  primary:   '#1b3a4b',   // primary-600 (azul Oxford)
  accent:    '#d4a043',   // accent-500 (warm gold)
  // ...
}
```

**3. Top 5 categorías sin Recharts:**

Para un ranking visual de 5 ítems con porcentajes, una barra de `<div>` con `width: ${porcentaje}%` es más ligera, más accesible y más fácil de estilizar que añadir otro `BarChart`. Esta gráfica vive en el mismo archivo (`GraficasMetricas.tsx`) pero no incrementa el costo del chunk de Recharts.

## Consecuencias

### Positivas

- **Velocidad de implementación:** las 3 gráficas se completaron en ~3 h reales (estimación cumplida) gracias a la API declarativa.
- **Bundle inicial intacto:** medido en DevTools post-Sprint, el chunk inicial de `/admin` no creció — el chunk de Recharts es un async chunk separado.
- **Composición natural con React:** `<BarChart><Bar dataKey="total" /></BarChart>` se lee como JSX cualquiera; legible para futuros mantenedores.
- **Reutilizable:** el ADR habilita Recharts para los siguientes sprints (Sprint 14 Dashboard Ejecutivo del Dueño del edificio) sin re-evaluar.

### Negativas

- **Bundle de Recharts (~110 KB gzip):** se descarga al primer acceso a `/admin/metricas`. Mitigado con lazy load. El admin lo "paga" 1 vez por sesión de navegador limpia.
- **Customización limitada en ejes/labels avanzados:** si en sprints futuros se requieren gráficas no triviales (ej. heatmaps, sankey), habría que revaluar (probablemente con Visx o D3 directo).
- **Recharts no soporta animaciones de tooltip avanzadas** out-of-the-box; las animaciones que tenemos son las CSS de la paleta Zity (`animate-fade-in`).

## Verificación

- **Tamaño del chunk:** validado en DevTools Network al cargar `/admin/metricas` por primera vez (chunk separado `Metricas-<hash>.js` que no aparece al cargar `/admin`).
- **Performance:** queries del panel pasaron de ~600 ms a ~20 ms gracias a la vista materializada `vw_metricas_solicitudes` (refactor del Sprint 7).
- **Visual:** 3 gráficas operativas con la paleta Zity, tooltips funcionando, responsive en móvil. Demo de Sprint 7 Review.

## Política para sprints futuros

- Las gráficas adicionales en Sprint 14 (Dashboard Ejecutivo) **deben** reusar Recharts y permanecer dentro del mismo módulo lazy.
- Cualquier gráfica de admin que requiera una librería adicional debe registrarse como una **nueva ADR** justificándolo.
- Si Recharts evoluciona a v4+ con breaking changes, evaluar el costo de migración vs. el de mantener la versión actual.

## Evidencia

- **Migración SQL:** `supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql` (RPC `get_graficas_mantenimiento`).
- **Componentes:** [`src/components/admin/GraficasMetricas.tsx`](../../src/components/admin/GraficasMetricas.tsx) — 3 componentes (`GraficaTipoBarra`, `GraficaTendencia`, `GraficaTopCategorias`).
- **Lazy load:** [`src/pages/admin/Metricas.tsx`](../../src/pages/admin/Metricas.tsx) líneas 26-28.
- **Demo de Sprint 7 Review:** Carlos Fuentes (admin) abre el panel con 102 solicitudes; las 3 gráficas con la paleta Zity quedaron validadas por los stakeholders.
