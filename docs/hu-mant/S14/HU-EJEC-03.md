# HU-EJEC-03 · Sección 'Finanzas' del dashboard

**Sprint 14 · 3 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como dueña del edificio, quiero ver los ingresos por facturación y el ratio de cobranza, para entender la salud financiera del edificio.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Gráfica circular de ingresos por tipo | ✅ | Se implementó el componente `GraficaIngresosTipo` que utiliza Recharts para visualizar los ingresos segmentados (luz, agua, pensión). |
| Ratio cobrado / pendiente del periodo | ✅ | Se implementó `TarjetaRatioCobranza` mostrando porcentajes visuales y montos absolutos agrupados por facturas pagadas vs pendientes del periodo. |
| Reusa las facturas del S8/S9 | ✅ | Los datos provienen estrictamente de la tabla `facturas` existente y reflejan directamente los pagos hechos con las tarjetas guardadas del S13. |
| No inventa datos (consolidación real) | ✅ | Se creó la RPC `get_metricas_finanzas` en Supabase para agregar la data real de las transacciones sin recurrir a mocks estáticos. |

---

## Archivos creados / modificados

### Creados

| Archivo | Cambio |
|---|---|
| [`supabase/migrations/20260616140000_sprint14_metricas_finanzas.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616140000_sprint14_metricas_finanzas.sql) | Define la RPC que consolida de forma segura el ratio de cobrado vs pendiente y agrupa los ingresos según el tipo de servicio. |
| [`src/components/admin/GraficasFinanzas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/admin/GraficasFinanzas.tsx) | Contiene la barra horizontal de Ratio de Cobranza y el PieChart de Ingresos por tipo. Utiliza `Recharts`. |
| [`src/hooks/useMetricasFinanzas.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useMetricasFinanzas.ts) | Hook para orquestar la llamada a la base de datos y proveer estados de `loading`, `error` y `refrescar`. |
| [`src/lib/metricasFinanzas.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metricasFinanzas.ts) | Interfaces estáticas para los tipos de retorno del JSON y utilidades para formato monetario local (`Intl.NumberFormat`). |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/pages/admin/Ejecutivo.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/admin/Ejecutivo.tsx) | Se añadió la sección de "Salud Financiera", integrando de forma asíncrona (`React.lazy`) los nuevos componentes visuales de finanzas. |
| [`src/test/admin/observador.test.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/test/admin/observador.test.ts) | Se incluyó el bloque `T11` para validar que el rol observador pueda invocar exitosamente la nueva RPC `get_metricas_finanzas`. |

---

## Explicación técnica detallada

### 1. Extracción de Métricas Financieras (RPC)

Para no cargar el cliente procesando el universo entero de facturas, se optó por realizar la consolidación directamente en Postgres mediante la RPC `get_metricas_finanzas(p_periodo text)`.
Esta aproximación garantiza dos cosas:
- **Performance**: Se envían escasos kilobytes al cliente en vez de un array masivo de facturas.
- **Dato Unificado**: Se asegura que tanto el gráfico de torta como la barra de ratio compartan el mismo conjunto exacto de datos filtrados por el `p_periodo`.

### 2. Formato Moneda Dinámico

Se configuró el uso del objeto nativo `Intl.NumberFormat` con localización `es-PE` y `PEN` (Soles) dentro de `metricasFinanzas.ts` en vez de concatenar símbolos manuales de "S/". Esto permite que ante futuros cambios de internacionalización (I18n), las conversiones y agrupaciones de miles apliquen al momento.

### 3. Código Dividido (Code Splitting)

La biblioteca `recharts` es pesada para el bundle de JavaScript. Dado que el panel de finanzas solo lo verá el administrador/observador, los componentes como `GraficaIngresosTipo` se importan dinámicamente con `lazy`. De esta forma la experiencia general del Residente o Técnico nunca se verá perjudicada por bytes no requeridos en su rol.

---

## Cambios requeridos en Supabase ⚠️

> [!NOTE]
> Se requiere aplicar la migración SQL número 017 al contenedor local para habilitar el uso del Dashboard Financiero.
> **Comando:** `npx supabase migration up`
> Una vez corrido, el administrador y observador podrán consultar los montos directamente.

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Mes actual sin facturas | La barra del ratio mostrará 0% en ambos lados y el gráfico de torta emitirá el mensaje _"No hay datos de ingresos pagados en este periodo"_. No habrán fallos o renderizado de `NaN`. |
| Facturas anuladas (futuro) | La RPC toma en cuenta estrictamente los estados explícitos de pago. Facturas con estados que no sean `'pagada'`, `'pendiente'` o `'vencida'` quedarían exentas del agrupador. |
| Problemas de red o Supabase caído | El `ErrorBoundary` atrapará el fallo de fetch específico de esta sección mostrando un `alert` amigable con un botón local de "Reintentar", dejando intacta e interactiva la sección superior de "Mantenimiento". |
