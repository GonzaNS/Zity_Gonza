# HU-EJEC-02 · Sección 'Mantenimiento' del dashboard ejecutivo

| Campo        | Valor |
|---|---|
| Sprint       | 14 |
| Estimación   | 3 h |
| Prioridad    | P1 |
| Migración    | `20260616130000_sprint14_volumen_resueltas.sql` |

---

## Descripción

Como dueña del edificio, quiero ver el desempeño de mantenimiento en gráficas, para saber cuánto se resuelve y en qué tiempos.

---

## Criterios de Aceptación Cumplidos

1. **Gráfica de barras del volumen mensual de solicitudes resueltas (último trimestre).**
   - Implementada en `GraficaVolumenResueltas` usando Recharts.
   - Muestra las solicitudes resueltas/cerradas por mes en el último trimestre.
2. **Tendencia de los tiempos promedio de resolución.**
   - Mostrada con `GraficaTendencia`, reflejando la evolución mensual del promedio (AVG) y la mediana (P50) en horas de resolución.
3. **Top categorías de solicitudes.**
   - Mostrada con `GraficaTopCategorias`, enumerando las 5 categorías más solicitadas por volumen y su porcentaje relativo.
4. **Reusa la vista materializada `vw_metricas_solicitudes` del Sprint 7 (sin inventar datos).**
   - Evolucionada mediante migración para incluir la métrica de volumen resuelto por mes dentro de la serie temporal precalculada, sin cálculos redundantes en tiempo de ejecución.

---

## Cambios Implementados

### 1. Migración SQL — `supabase/migrations/20260616130000_sprint14_volumen_resueltas.sql`

- **Recreación de la Vista Materializada `vw_metricas_solicitudes`**:
  Se actualizó el cálculo de la serie `tendencia` para incluir la métrica mensual `resueltas` (`COUNT(s.id)`) de solicitudes en estado `resuelta` o `cerrada`:
  ```sql
  COUNT(s.id) AS resueltas
  ```
  Esto almacena el volumen mensual precalculado de forma segura y concurrente en Postgres, preservando el índice UNIQUE `vw_metricas_solicitudes_refreshed_at_idx` para refrescos concurrentes sin bloqueos de lectura.
- **Acceso a RPCs para el Observador (`public.puede_ver_metricas`)**:
  Se redefinieron las funciones de Supabase `get_metricas_mantenimiento()` y `get_graficas_mantenimiento()`. Reemplazan la condición rígida `public.get_user_rol() IS DISTINCT FROM 'admin'` por la función helper de control de acceso `public.puede_ver_metricas()` introducida en el Sprint 14, permitiendo llamadas del rol `observador` de forma segura.

### 2. Tipos de Datos — `src/lib/metricas.ts`

Se actualizó la definición del tipo `DatoTendenciaMensual` para incorporar el volumen mensual de solicitudes resueltas:
```typescript
export type DatoTendenciaMensual = {
  mes: string
  avg_horas: number | null
  mediana_horas: number | null
  resueltas?: number  // volumen mensual resuelto
}
```

### 3. Componente de Visualización — `src/components/admin/GraficasMetricas.tsx`

Se implementó el componente `GraficaVolumenResueltas` encargado de:
- Recibir `datos: DatoTendenciaMensual[]` y `loading: boolean`.
- Quedarse únicamente con el último trimestre (los últimos 3 meses, usando `datos.slice(-3)`).
- Dibuja un `BarChart` vertical en la paleta de colores de Zity (`ZITY.primary` = `#1b3a4b`) con bordes superiores redondeados.
- Emplear el tooltip de precisión `TooltipBase` adaptado con la etiqueta de texto `"solicitud(es) resuelta(s)"`.

### 4. Layout y Sección Mantenimiento — `src/pages/admin/Ejecutivo.tsx`

- Se agrupó toda la información del panel ejecutivo bajo una sección clara titulada **Desempeño de Mantenimiento** con un icono de tuerca/mecanismo.
- Se configuró la carga diferida (`React.lazy`) de `GraficaVolumenResueltas` en lugar de la gráfica genérica de solicitudes por tipo.
- El panel de control se estructuró de la siguiente forma:
  - Fila 1: Tarjetas KPI (Total, Pendientes, En Proceso, Resueltas hoy).
  - Fila 2: Tarjeta de Tiempos Promedio de Resolución (AVG, Mediana, P95).
  - Fila 3: Grid de 5 columnas con la **Gráfica de volumen mensual de solicitudes resueltas (último trimestre)** a la izquierda (span 3) y la gráfica de **Top 5 categorías** a la derecha (span 2).
  - Fila 4: Gráfica de ancho completo con la **Tendencia de los tiempos promedio de resolución** (AVG/Mediana).

### 5. Pruebas Automatizadas — `src/test/admin/observador.test.ts`

Se añadieron pruebas de integración unitaria (T10) para verificar:
- Que las llamadas a la RPC `get_metricas_mantenimiento` por el rol observador resuelvan con los datos correspondientes.
- Que el dataset de la RPC `get_graficas_mantenimiento` contenga el campo `resueltas` dentro de la serie temporal mensual de la tendencia para su graficado.

---

## Verificación

### Pruebas de no regresión
La suite completa de tests de Vitest pasa limpiamente (excluyendo los fallos externos preexistentes de dependencias no instaladas `pdf-lib` y `react-markdown`):
```bash
npm run test:run
```
El typecheck del compilador de TypeScript no arroja ningún error nuevo derivado de los cambios implementados:
```bash
npm run typecheck
```
