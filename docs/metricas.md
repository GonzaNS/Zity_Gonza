# Métricas y Dashboard del Admin — Sprint 7

Documento "vivo" de referencia para el panel `/admin/metricas`. Resume las fórmulas, la arquitectura de performance y el formato de exportación CSV.

| Sección | Para qué |
|---|---|
| [Fórmulas de KPIs](#fórmulas-de-kpis) | Qué se calcula y por qué |
| [Vista materializada + refresh](#vista-materializada-y-refresh-horario) | Cómo el panel responde en ~20 ms |
| [Formato del CSV](#formato-del-csv) | Por qué Excel/Sheets/LibreOffice reconocen acentos |
| [RPCs del Sprint 7](#rpcs-y-permisos) | Qué endpoints existen y qué rol puede llamarlos |
| [Casos de borde](#casos-de-borde-de-las-fórmulas) | Qué pasa con 0, 1, 2 solicitudes y outliers |

---

## Fórmulas de KPIs

Todas las fórmulas viven en [`src/lib/metricas.ts`](../src/lib/metricas.ts) como funciones puras (sin Supabase, sin React) — testeables sin mocks en [`src/test/admin/metricas.test.ts`](../src/test/admin/metricas.test.ts) (29 tests, 4 casos de borde requeridos por el PBI).

### Tiempo de resolución

> **Tiempo de resolución de una solicitud** = `(timestamp de cambio a 'resuelta' o 'cerrada') − (timestamp de creación)`.
>
> Se mide en horas y solo cuenta la **primera** transición a 'resuelta'/'cerrada' (si la solicitud se reabre y se vuelve a resolver, no se duplica).

Se reportan **tres estadísticos** sobre el conjunto de tiempos de todas las solicitudes resueltas en la BD:

| Estadístico | Fórmula | Cuándo es útil |
|---|---|---|
| **AVG** (promedio) | `sum(horas) / n` | Lectura rápida del "tiempo típico", pero sensible a outliers. |
| **Mediana** (P50) | `percentile_cont(0.5)` | Protege contra solicitudes muy viejas o atascadas que disparan el AVG. Es el caso típico real. |
| **P95** | `percentile_cont(0.95)` con interpolación lineal | Si tienes 100 solicitudes, P95 ≈ el tiempo del peor 5%. Útil para SLAs. |

**Decisión de diseño:** reportamos los tres en la UI, con un tooltip que explica cuál mirar. Si se reporta solo AVG, una sola solicitud atascada 200 h hace ver que "tardan 20 h en promedio" cuando 9 de 10 tardaron 1 h. La mediana protege contra esa distorsión.

### Conteos por estado

Las 4 tarjetas KPI del panel:

| Tarjeta | Query |
|---|---|
| Total acumulado | `COUNT(*) FROM solicitudes` |
| Pendientes | `COUNT(*) FROM solicitudes WHERE estado = 'pendiente'` |
| En proceso | `COUNT(*) FROM solicitudes WHERE estado IN ('asignada','en_progreso')` |
| Resueltas hoy | `COUNT(*) FROM solicitudes WHERE estado IN ('resuelta','cerrada') AND updated_at::date = CURRENT_DATE` |

Estos contadores **no están materializados** — son 4 `COUNT(*)` en índices B-tree (~1 ms total). Se calculan en vivo para garantizar exactitud al segundo cuando el admin abre el panel.

### Datos de las gráficas

| Gráfica | Dato | Cálculo |
|---|---|---|
| Barras horizontales por tipo | conteo de solicitudes por `tipo` | `LEFT JOIN` con un VALUES literal de los 5 tipos (para que tipos con 0 solicitudes aparezcan con barra vacía). |
| Tendencia mensual | `avg_horas` + `mediana_horas` por mes (últimos 6) | `DATE_TRUNC('month', created_at)` + `LATERAL JOIN` a `historial_estados` para encontrar primera resolución. |
| Top 5 categorías | categoría, total, porcentaje sobre el grand_total | `ROW_NUMBER() OVER (ORDER BY total DESC)` + `SUM(total) OVER ()` window function. |

---

## Vista materializada y refresh horario

### Por qué materializar

Las queries de AVG/mediana/P95 sobre todas las solicitudes + `LATERAL JOIN` a `historial_estados` corren en ~600 ms para un dataset de 60 filas (medido en staging). Para 1000+ solicitudes pueden pasar de 1 s — el admin verá el panel "colgado" al abrirlo.

La vista materializada `vw_metricas_solicitudes` precalcula esos agregados pesados y los almacena como una sola fila JSONB. Lectura del panel: **~20 ms**.

### Estructura

Definida en [`supabase/migrations/20260527010000_sprint7_vw_metricas_solicitudes.sql`](../supabase/migrations/20260527010000_sprint7_vw_metricas_solicitudes.sql):

| Columna | Tipo | Contenido |
|---|---|---|
| `tiempos_resolucion` | `jsonb` | `{ avg_horas, mediana_horas, p95_horas }` |
| `por_tipo` | `jsonb` | `[ { tipo, total }, ... ]` |
| `top_categorias` | `jsonb` | `[ { categoria, total, porcentaje }, ... ]` |
| `tendencia_mensual` | `jsonb` | `[ { mes, avg_horas, mediana_horas }, ... ]` (últimos 6 meses) |
| `refreshed_at` | `timestamptz` | Marca del último `REFRESH` |

Hay un **`UNIQUE INDEX` en `refreshed_at`** (requerido para `REFRESH MATERIALIZED VIEW CONCURRENTLY` — sin él el refresh bloquea lecturas).

### Estrategia de refresh

**Refresh horario con `pg_cron`** (requiere activación manual; ver [docs/setup-supabase.md](setup-supabase.md)):

```sql
SELECT cron.schedule(
  'refresh-metricas-hourly',
  '0 * * * *',                       -- cada hora en punto
  $$SELECT refresh_metricas_on_demand()$$
);
```

**Fallback on-demand** en el cliente — si `pg_cron` no está activado o falla, [`useMetricasMantenimiento`](../src/hooks/useMetricasMantenimiento.ts) detecta que `vista_refreshed_at` tiene más de 1 hora y dispara `refresh_metricas_on_demand()` automáticamente al abrir el panel:

```typescript
// src/hooks/useMetricasMantenimiento.ts (extracto)
if (vistaEsAntigua) {
  void supabase.rpc('refresh_metricas_on_demand').then(async () => {
    // re-fetch silencioso con datos frescos
  })
}
```

El usuario nunca espera al refresh — ve los datos viejos inmediatamente y los nuevos llegan en background.

---

## Formato del CSV

Exportación implementada en [`src/components/admin/PopoverExportarCSV.tsx`](../src/components/admin/PopoverExportarCSV.tsx) + RPC `export_solicitudes_csv(f_inicio, f_fin)`.

### Decisiones de formato

| Decisión | Por qué |
|---|---|
| **UTF-8 con BOM** (`﻿` al inicio) | Excel en Windows en español no reconoce automáticamente UTF-8 puro. Sin BOM, "Categoría" sale como "CategorÃ­a". Con BOM, Excel detecta el encoding correctamente. |
| **Separador coma** (`,`) | Estándar CSV; Google Sheets y LibreOffice lo reconocen sin configuración. Excel en localización es-ES puede preferir `;` pero el BOM + UTF-8 generalmente fuerza la detección correcta. |
| **Fechas ISO-8601** (`YYYY-MM-DD HH:MM`) | Formato ordenable, sin ambigüedad entre `DD/MM` (LATAM) y `MM/DD` (US). Excel lo reconoce como fecha al abrir. |
| **Cabeceras en español** | El consumidor es el admin del edificio — no debería ver "created_at" sino "Fecha Creación". |
| **Generación server-side con PostgREST `.csv()`** | El cliente JS llama `supabase.rpc(...).csv()` que envía `Accept: text/csv`. PostgREST serializa a CSV en el motor antes de enviar por la red — más rápido que descargar JSON y convertir en cliente. |

### Columnas del CSV

| Cabecera | Origen |
|---|---|
| `ID Solicitud` | `solicitudes.id` (uuid) |
| `Estado` | `solicitudes.estado` |
| `Tipo` | `solicitudes.tipo` |
| `Categoría` | `solicitudes.categoria` |
| `Fecha Creación` | `to_char(solicitudes.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')` |
| `Fecha Actualización` | `to_char(solicitudes.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')` |
| `Nombre Residente` | `usuarios.nombre \|\| ' ' \|\| usuarios.apellido` (vía `LEFT JOIN`) |

### Nombre del archivo

`solicitudes_<fecha_desde>_<fecha_hasta>.csv` — ej: `solicitudes_2026-04-26_2026-05-26.csv`.

---

## RPCs y permisos

Todos los RPCs del Sprint 7 usan **`SECURITY DEFINER` + verificación manual del rol en JWT**. Esto es el patrón de Zity para operaciones que requieren acceso global (admin) pero no pueden pasar por las RLS restrictivas de las tablas normales.

| RPC | Quién puede llamarlo | Qué hace |
|---|---|---|
| `get_metricas_mantenimiento()` | rol `admin` (verificado vía `auth.jwt() -> 'app_metadata' ->> 'rol'`) | Devuelve los 4 contadores + tiempos de resolución + `vista_refreshed_at`. |
| `get_graficas_mantenimiento()` | rol `admin` | Devuelve los 3 datasets de gráficas leyendo `vw_metricas_solicitudes`. |
| `refresh_metricas_on_demand()` | cualquier autenticado, pero solo refresca si la vista tiene >1h | Llamado por `pg_cron` y como fallback desde el frontend. |
| `export_solicitudes_csv(f_inicio, f_fin)` | rol `admin` | Devuelve filas formateadas para `.csv()` con cabeceras en español. |

Todos hacen `REVOKE ALL ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` y rechazan con `RAISE EXCEPTION ... USING ERRCODE = '42501'` si el JWT no contiene rol admin.

---

## Casos de borde de las fórmulas

Verificados con tests unitarios en [`src/test/admin/metricas.test.ts`](../src/test/admin/metricas.test.ts).

| n (solicitudes resueltas) | AVG | Mediana | P95 | UI |
|---:|---|---|---|---|
| 0 | `null` | `null` | `null` | "Sin datos suficientes" |
| 1 | valor | valor | `null` | P95 → "Sin datos suficientes" |
| 2 | valor | valor | valor (interpolado) | Los tres calculados |
| 10+ con 1 outlier muy alto | distorsionado (>10 h) | estable (≈2 h) | elevado | El usuario ve la diferencia AVG vs Mediana y entiende que hay un outlier |

**Constante:** `P95_MIN_MUESTRAS = 2` en [`src/lib/metricas.ts`](../src/lib/metricas.ts). Si n < 2 → P95 = `null` → UI muestra "Sin datos suficientes".

**Bug histórico documentado:** PostgreSQL `percentile_cont` retornaba `NULL` con n=1 (descubierto en Day 2 del Sprint 7). Corregido con `COALESCE` en el SQL + casos de borde explícitos en los tests JS.

---

## Referencias

- PDF Sprint 7: `docs/sprints/Zity_Sprint7_Artefactos.pdf`
- Documentación de HUs específicas:
  - [PBI-22 (Panel de métricas)](hu-mant/S7/PBI-22-metricas.md)
  - [HU-KPI-01 (Gráficas Recharts)](hu-mant/S7/HU-KPI-01-graficas-recharts.md)
  - [PBI-17 (Exportar CSV)](hu-mant/S7/PBI-17-exportar-csv.md)
  - [Refactor vista materializada](hu-mant/S7/REFACTOR-vista-materializada.md)
- ADR-006: [Recharts vs SVG nativo](adr/006-recharts.md)
- Setup de extensiones Postgres: [docs/setup-supabase.md](setup-supabase.md)
