# HU-EJEC-04 · Sección 'Tienda' del dashboard

**Sprint 14 · 2 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como dueña del edificio, quiero ver los ingresos y los productos más vendidos de la tienda, para conocer el aporte de la tienda interna.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Ingresos de la tienda del mes | ✅ | Se visualiza en una tarjeta KPI el monto total facturado y confirmado en Soles (PEN) para el periodo seleccionado. |
| Top 5 productos más vendidos | ✅ | Ránking visual en barra horizontal (`GraficaTopProductos`) ordenado por volumen de unidades vendidas y detallando el ingreso generado por cada uno. |
| Tendencia de ventas | ✅ | Gráfico de área (`GraficaTendenciaTienda`) con degradado estético que muestra las ventas acumuladas (ingresos) y total de pedidos del último semestre. |
| Reusa los datos de pedidos del S10/S11 | ✅ | Utiliza la estructura real de `pedidos` y `pedido_items` modelada y poblada en los Sprints 10 y 11. |

---

## Archivos creados / modificados

### Creados

| Archivo | Cambio |
|---|---|
| [`supabase/migrations/20260616150000_sprint14_metricas_tienda.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616150000_sprint14_metricas_tienda.sql) | Define la RPC `get_metricas_tienda(p_periodo text)` para agregar los ingresos, calcular el top 5 de productos más vendidos y generar la serie de tendencia del último semestre en un solo viaje de red. |
| [`src/components/admin/GraficasTienda.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/admin/GraficasTienda.tsx) | Contiene la visualización de Tendencia de Ventas (gráfico de área) y el Ránking Top 5 de productos más vendidos (CSS progress bars). |
| [`src/hooks/useMetricasTienda.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useMetricasTienda.ts) | Hook React para encapsular la llamada a la RPC de la tienda en Supabase y gestionar la carga (`loading`) y errores (`error`). |
| [`src/lib/metricasTienda.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metricasTienda.ts) | Definición de tipos TypeScript para la estructura de datos que viaja de la base de datos a los componentes. |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/pages/admin/Ejecutivo.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/admin/Ejecutivo.tsx) | Se incorporó la sección "Tienda" al final de la página, integrando la tarjeta de ingresos mensuales, la tendencia de ventas y el listado de productos más vendidos mediante importación dinámica (`React.lazy`). |
| [`src/test/admin/observador.test.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/test/admin/observador.test.ts) | Se añadió el bloque `T12` para validar que el rol observador pueda invocar la RPC `get_metricas_tienda` y que devuelva la estructura de datos mockeada esperada. |

---

## Explicación técnica detallada

### 1. Consolidación de ingresos y ventas en Supabase (RPC)

Para optimizar las consultas y evitar enviar todas las líneas de pedidos al cliente, se encapsuló la lógica de agregación en la base de datos mediante la función `public.get_metricas_tienda(p_periodo text)`. Esta realiza:
- La suma total del campo `total` en `pedidos` cuyo estado es `'confirmado'` o `'facturado'` para el mes en curso.
- La agrupación por producto sumando la columna `cantidad` y su ingreso total (`cantidad * precio_unitario`), filtrando de la misma manera por estado y ordenándolos de manera descendente.
- La generación dinámica de un listado de los últimos 6 meses a partir del periodo consultado mediante `generate_series` en PostgreSQL, para que la gráfica de tendencia no tenga huecos vacíos.

### 2. Seguridad en RLS y SECURITY DEFINER

La función corre en modo `SECURITY DEFINER` para poder consultar las tablas operativas de pedidos de forma global. Sin embargo, su seguridad se protege estrictamente con el helper `public.puede_ver_metricas()`, el cual restringe la ejecución únicamente a usuarios autenticados que posean los roles `admin` u `observador`.

### 3. Visualización con Gráficos de Área y Progress Bars

- **Área Recharts**: El componente `GraficaTendenciaTienda` usa un `<AreaChart>` de Recharts con una paleta Zity y un degradado opaco en el área rellena, ofreciendo una visualización moderna de la tendencia del semestre.
- **Ránking en CSS**: Para los productos más vendidos se reusó el diseño visual del ránking de categorías (`GraficaTopCategorias`), calculando en tiempo real las proporciones CSS en base al producto líder para escalar visualmente las barras de progreso sin sobrecargar con librerías adicionales.

---

## Cambios requeridos en Supabase ⚠️

> [!NOTE]
> Se requiere aplicar la migración SQL número 018 en Supabase para crear la RPC de la tienda.
> **Comando:** `npx supabase migration up`
> Una vez aplicada, la dueña del edificio (rol observador) y el administrador podrán ver y consumir los KPIs.

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Periodo sin pedidos | La tarjeta de ingresos del mes mostrará `S/ 0.00`, el ránking mostrará _"Sin ventas registradas en este periodo"_ y la tendencia mensual mostrará las barras o puntos en `0` para el mes actual, sin romper la interfaz. |
| Eliminación lógica de productos | La base de datos realiza baja lógica (`activo=false`), por lo que la relación con `pedido_items` (`ON DELETE RESTRICT`) está a salvo. Si un producto inactivo tiene pedidos registrados históricamente, seguirá sumando a las métricas del periodo que corresponda. |
| Fallo en la llamada a base de datos | Cada componente cuenta con un wrapper de `ErrorBoundary` independiente, aislando cualquier error específico en la tienda del resto del dashboard de mantenimiento y finanzas. |
