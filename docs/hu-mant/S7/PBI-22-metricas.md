# PBI-22 · Panel de Métricas `/admin/metricas`

**Sprint 7 · 5 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como administrador, necesito un panel `/admin/metricas` con los KPIs operativos del mantenimiento (totales, por estado, tiempo promedio de resolución), para entender el volumen y la eficiencia del módulo de un vistazo.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Vista `/admin/metricas` con 4 tarjetas KPI | ✅ | Total acumulado, Pendientes, En proceso, Resueltas hoy |
| Auto-refresh cada 60 s (pausa en background) | ✅ | `useMetricasMantenimiento` + `visibilitychange` |
| AVG, mediana y P95 de tiempos de resolución | ✅ | `src/lib/metricas.ts` — funciones puras |
| Casos de borde: vacío, n=1, P95 sin datos | ✅ | Muestra "Sin datos suficientes" |
| Solo accesible para rol `admin` | ✅ | `ProtectedRoute` + RPC verifica JWT |
| Tests unitarios (4 casos de borde) | ✅ | **29 tests pasando** |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260526183900_sprint7_metricas_mantenimiento.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260526183900_sprint7_metricas_mantenimiento.sql) | RPC `get_metricas_mantenimiento()` con SECURITY DEFINER |
| [`src/lib/metricas.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metricas.ts) | Fórmulas puras: `calcularAvg`, `calcularMediana`, `calcularP95`, `formatearHoras` |
| [`src/hooks/useMetricasMantenimiento.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useMetricasMantenimiento.ts) | Hook con auto-refresh + pausa background |
| [`src/pages/admin/Metricas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/admin/Metricas.tsx) | Página completa con 4 KPI cards + tarjeta de tiempos |
| [`src/test/admin/metricas.test.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/test/admin/metricas.test.ts) | 29 tests unitarios (4 casos de borde + formateo) |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/App.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/App.tsx) | Lazy import + `<Route path="/admin/metricas">` con `ProtectedRoute` |
| [`src/components/admin/AdminShell.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/admin/AdminShell.tsx) | Nuevo ítem "Métricas" en el array `NAV` del sidebar |
| [`vite.config.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/vite.config.ts) | Threshold de cobertura ≥ 80% para `src/lib/metricas.ts` |

---

## Explicación técnica detallada

### 1. RPC PostgreSQL con SECURITY DEFINER

**Archivo:** `supabase/migrations/20260526183900_sprint7_metricas_mantenimiento.sql`

**Qué es:** Una función almacenada en PostgreSQL que se ejecuta del lado del servidor de Supabase y devuelve un `jsonb` con todos los KPIs en una sola llamada de red.

**Cómo se usa:** El cliente llama `supabase.rpc('get_metricas_mantenimiento')` y recibe directamente el objeto de métricas. No hay múltiples `SELECT` desde el cliente.

**Por qué SECURITY DEFINER:**  
Supabase usa Row Level Security (RLS) para proteger las tablas. Sin embargo, un admin necesita acceder a datos de todos los usuarios (conteos globales), algo que las RLS restrictivas de las tablas normales impiden. Con `SECURITY DEFINER`, la función corre con los permisos del *owner* (postgres), que sí puede leer todo. El guard de rol se hace manualmente dentro de la función leyendo el JWT del usuario autenticado:

```sql
SELECT (auth.jwt() -> 'app_metadata' ->> 'rol') INTO v_rol;
IF v_rol IS DISTINCT FROM 'admin' THEN
  RAISE EXCEPTION '...' USING ERRCODE = '42501';
END IF;
```

**Por qué `REVOKE ALL … FROM PUBLIC` + `GRANT … TO authenticated`:**  
La combinación garantiza que solo usuarios autenticados pueden invocar la función, y que el JWT de ese usuario siempre estará disponible para la verificación de rol dentro del body. Un anónimo nunca llega al chequeo de rol porque Supabase rechaza la llamada antes.

**Cómo calcula la mediana y P95 en SQL:**  
Se usa `percentile_cont()`, la función de agregado de PostgreSQL para percentiles continuos (interpolación lineal). Para no hacer dos pasadas sobre los datos, primero se acumulan los tiempos en un `ARRAY_AGG` ordenado y luego se aplican los percentiles sobre `UNNEST(array)`:

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY t)
INTO v_mediana FROM UNNEST(v_tiempos) AS t;
```

---

### 2. Funciones puras en `src/lib/metricas.ts`

**Qué son:** Funciones matemáticas sin efectos secundarios ni dependencias de red.

**Cómo se usan:** Son importadas por `Metricas.tsx` para formatear los valores numéricos que devuelve el RPC (en horas) a strings legibles ("2.5 h", "3 d", "Sin datos suficientes"). También son las que testea directamente `metricas.test.ts`.

**Por qué separar las fórmulas del hook:**  
El patrón de "fórmulas puras en lib + efectos en hook" es clave para la testabilidad. Si las fórmulas vivieran dentro del hook o del componente, habría que mockear Supabase, React y el DOM solo para verificar que `calcularP95([1, 100])` devuelve `95.05`. Al separarlas, los 29 tests corren en < 10 ms sin ningún mock.

**Decisiones de diseño importantes:**
- **`calcularMediana`** usa `[...valores].sort(...)` (copia del array) para no mutar el input original. Ordenar en JS es `O(n log n)`, aceptable para los volúmenes esperados.
- **`calcularP95`** implementa la interpolación lineal estándar (mismo método que Excel/numpy/R): `idx = p × (n−1)`. Con n=1 devuelve `null` (criterio del PBI: "sin datos suficientes"), con n=2 ya es calculable.
- **`formatearHoras`** escala automáticamente: minutos → horas → días, para que la UI sea legible independientemente de si el edificio resuelve en 30 min o en 5 días.

---

### 3. Hook `useMetricasMantenimiento`

**Archivo:** `src/hooks/useMetricasMantenimiento.ts`

**Qué hace:** Gestiona el ciclo de vida completo del fetch de métricas: primera carga, auto-refresh y cancelación al desmontar.

**Cómo funciona el auto-refresh con pausa:**  
```typescript
// Al cambiar visibilidad del tab:
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchMetricas()      // refresco inmediato al volver
    iniciarIntervalo()   // retomar timer de 60 s
  } else {
    detenerIntervalo()   // pausar — no gastar quota de Supabase
  }
})
```
Esto implementa el criterio de "pausa en background" del PBI. Sin esto, el hook haría una llamada al RPC cada 60 s aunque el usuario tenga la pestaña escondida, desperdiciando ancho de banda y quota de la base de datos.

**Por qué `AbortController`:**  
Si el componente se desmonta mientras hay un fetch en vuelo (navegación rápida entre páginas), sin cancelación el callback de `setMetricas` intentaría actualizar el estado de un componente que ya no existe. El `AbortController` permite ignorar la respuesta si el componente ya se limpió:
```typescript
abortRef.current?.abort()        // cancelar fetch anterior
if (abortRef.current.signal.aborted) return  // ignorar si fue abortado
```

**Por qué no `setLoading(true)` en cada refresh automático:**  
En el primer render sí se muestra el skeleton de carga. En los refrescos posteriores (cada 60 s), hacer `setLoading(true)` causaría un "flash" donde las tarjetas desaparecen y vuelven a aparecer cada minuto. Se mantiene el dato anterior visible mientras llega el nuevo.

---

### 4. Página `Metricas.tsx`

**Qué es:** El componente de vista de la ruta `/admin/metricas`.

**Skeleton loading:** Mientras `loading && !metricas` (solo en la primera carga), se muestran rectángulos animados (`animate-pulse`) del mismo tamaño que los KPIs reales. Esto evita el CLS (Cumulative Layout Shift) y da feedback inmediato al usuario.

**Variantes de color (`VARIANT_STYLES`):** Cada KPI tiene un color semántico:
- Azul (`blue`) → total histórico (neutro informativo)
- Ámbar (`amber`) → pendientes (requieren atención, alerta suave)
- Teal (`teal`) → en proceso (activo, trabajo en curso)
- Verde (`green`) → resueltas hoy (éxito, positivo)

Los colores provienen de los tokens de diseño de Zity definidos en `index.css` (`primary`, `accent`, `success`), no de valores hardcodeados.

**Lazy load de la página completa:** En `App.tsx` se usa `React.lazy(() => import('./pages/admin/Metricas'))`. Esto divide el bundle: Recharts (que se agregará en HU-KPI-01) y los componentes de gráficas no se descargan hasta que el usuario navega a `/admin/metricas`.

---

### 5. Tests unitarios (`metricas.test.ts`)

**Framework:** Vitest (ya configurado en el proyecto desde Sprint 4).

**Los 4 casos de borde requeridos por el PBI:**

| Caso | Qué verifica |
|---|---|
| `n=0` (vacío) | Ninguna fórmula rompe con array vacío; todas devuelven `null` |
| `n=1` | AVG y mediana devuelven el único valor; P95 devuelve `null` |
| `n=2` | P95 ya es calculable (mínimo establecido por el criterio) |
| Outliers | Mediana estable ≈ 2 h cuando 9 solicitudes = 2 h + 1 outlier = 500 h; AVG distorsionado > 40 h |

**Por qué testear `formatearHoras` también:**  
Es lógica de UI con reglas de negocio (< 1 min, minutos, horas, días). Un error aquí (ej: mostrar "NaN h") llegaría al usuario final. Los tests de `formatearHoras` son baratos y evitan regresiones cuando se modifica el umbral de escala.

---

## Cambios requeridos en Supabase ⚠️

> [!IMPORTANT]
> Debes ejecutar la migración SQL en el dashboard de Supabase antes de que el panel funcione en producción.

### Paso 1 — Ejecutar la migración

Ve a **Supabase → SQL Editor** y ejecuta el contenido de:

```
supabase/migrations/20260526183900_sprint7_metricas_mantenimiento.sql
```

La migración crea la función `get_metricas_mantenimiento()` con:
- **`SECURITY DEFINER`** — corre con permisos del owner (postgres), no del usuario llamante.
- **Verificación de rol** — lee el claim `app_metadata.rol` del JWT; rechaza con `42501` (insufficient_privilege) si no es `admin`.
- **`REVOKE ALL … FROM PUBLIC`** — ningún rol anónimo puede ejecutarla.
- **`GRANT EXECUTE … TO authenticated`** — el guard del JWT se aplica dentro de la función.

### Paso 2 — Verificar prerequisitos

La función usa estas tablas/columnas (ya existentes desde sprints anteriores):

| Tabla | Columnas usadas |
|---|---|
| `solicitudes` | `estado`, `updated_at`, `created_at` |
| `historial_estados` | `solicitud_id`, `estado_nuevo`, `created_at` |

> [!NOTE]
> No se requieren columnas nuevas. Las tablas ya existen desde el Sprint 4.

### Paso 3 — Verificar en SQL Editor

```sql
-- Como admin autenticado:
SELECT get_metricas_mantenimiento();
-- Debe devolver un JSON con total_acumulado, pendientes, en_proceso,
-- resueltas_hoy y tiempos_resolucion.

-- Como usuario no-admin debería fallar con:
-- ERROR:  Acceso denegado: se requiere rol admin (SQLSTATE 42501)
```

---

## Arquitectura técnica

### RPC en Supabase (server-side)

```
Cliente → supabase.rpc('get_metricas_mantenimiento')
             └─ BD verifica rol en JWT
             └─ COUNT por estado
             └─ ARRAY_AGG de tiempos (historial_estados JOIN solicitudes)
             └─ percentile_cont(0.5) para mediana
             └─ percentile_cont(0.95) para P95 (si n ≥ 2)
             └─ Devuelve jsonb
```

### Fórmulas de percentiles (client-side, para tests)

Las fórmulas `calcularAvg`, `calcularMediana`, `calcularP95` viven en `src/lib/metricas.ts` como funciones puras (sin dependencias). El RPC ya devuelve los valores calculados; estas funciones sirven para:
1. Tests unitarios sin mocks de red.
2. Futura capacidad de recalcular en cliente si se tuvieran datos crudos.

### Auto-refresh con pausa en background

```typescript
// Patrón implementado en useMetricasMantenimiento.ts
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    fetchMetricas()      // refresco inmediato al volver al tab
    iniciarIntervalo()   // retomar timer
  } else {
    detenerIntervalo()   // pausar cuando va a background
  }
})
```

---

## Casos de borde documentados

| Caso | AVG | Mediana | P95 | UI |
|---|---|---|---|---|
| 0 solicitudes resueltas | `null` | `null` | `null` | "Sin datos suficientes" |
| 1 solicitud resuelta | valor | valor | `null` | P95 → "Sin datos suficientes" |
| 2 solicitudes resueltas | valor | valor | valor | Todos calculados |
| Outlier extremo (ej: 500 h) | distorsionado | estable | elevado | Mediana vs AVG muestran la diferencia |

---

## Tests unitarios

```
✓ calcularAvg > caso borde vacío (n=0) → null
✓ calcularAvg > caso borde n=1 → devuelve el único valor
✓ calcularAvg > caso borde n=2 → promedio exacto
✓ calcularAvg > outliers distorsionan el AVG
✓ calcularAvg > set normal
✓ calcularMediana > caso borde vacío (n=0) → null
✓ calcularMediana > caso borde n=1 → devuelve el único valor
✓ calcularMediana > n=2 → promedio de los dos valores
✓ calcularMediana > n impar → valor central
✓ calcularMediana > n par → promedio de los dos centrales
✓ calcularMediana > caso borde outliers: mediana estable vs avg distorsionado
✓ calcularMediana > ordena correctamente valores no ordenados
✓ calcularP95 > caso borde vacío (n=0) → null
✓ calcularP95 > caso borde n=1 → null (insuficiente para P95)
✓ calcularP95 > caso borde n=2 → P95 calculable
✓ calcularP95 > set grande → P95 mayor que mediana
✓ calcularP95 > todos los valores iguales → P95 = ese valor
✓ calcularP95 > outlier extremo eleva P95
✓ calcularEstadisticosHoras > caso borde vacío → todos null
✓ calcularEstadisticosHoras > caso borde n=1 → avg y mediana tienen valor, p95 null
✓ calcularEstadisticosHoras > caso borde n=2 → los tres estadísticos calculados
✓ calcularEstadisticosHoras > caso borde outliers → mediana ≠ avg, p95 alto
✓ formatearHoras > null → "Sin datos suficientes"
✓ formatearHoras > < 1 h → muestra minutos
✓ formatearHoras > < 24 h → muestra horas con un decimal
✓ formatearHoras > >= 24 h → muestra días con un decimal
✓ formatearHoras > fracción muy pequeña → "< 1 min"
✓ formatearHoras > exactamente 1 h
✓ formatearHoras > exactamente 24 h → "1.0 d"

Test Files  1 passed (1)
      Tests  29 passed (29)
```
