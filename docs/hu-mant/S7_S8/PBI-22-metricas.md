# PBI-22 · Panel de Métricas `/admin/metricas`

**Sprint 7 · 5 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como administrador, necesito un panel `/admin/metricas` con los KPIs operativos del mantenimiento (totales, por estado, por tipo, tiempo promedio de resolución), para entender el volumen y la eficiencia del módulo de un vistazo.

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
