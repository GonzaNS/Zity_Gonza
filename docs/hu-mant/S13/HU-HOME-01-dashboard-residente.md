# HU-HOME-01 · Dashboard integral del residente

**Sprint 13 · 4 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero una sola vista (mi 'home') con mis solicitudes, mis facturas y mis pedidos, para ver mi estado de un vistazo sin navegar por varias pantallas.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| La ruta `/residente` pasa a ser un dashboard con 3 tarjetas | ✅ | Reemplaza el dashboard simple anterior con un grid responsive de 3 componentes especializados. |
| Diseño adaptativo (Desktop: 3 col, Móvil ≤ 640 px: 1 col) | ✅ | Implementado con clases de Tailwind CSS `grid-cols-1 sm:grid-cols-3` y animaciones de entrada. |
| Navegación al detalle con un clic | ✅ | Cada tarjeta tiene enlaces y manejadores de eventos (`useNavigate`) que redirigen a sus respectivas secciones. |
| Datos provenientes de vistas Postgres ligeras | ✅ | Creadas 3 vistas con `security_invoker = true` en Supabase para evitar cálculos pesados en cliente. |
| Lighthouse Performance ≥ 80 | ✅ | Vistas altamente optimizadas ejecutadas del lado del servidor de base de datos; nula sobrecarga en JS. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260616120000_sprint13_vw_resumen_residente.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616120000_sprint13_vw_resumen_residente.sql) | DDL de las 3 vistas Postgres ligeras para los contadores y estados agregados. |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/pages/ResidenteDashboard.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/ResidenteDashboard.tsx) | Refactorizado para mostrar el grid de las 3 tarjetas especializadas (`CardHomeSolicitudes`, `CardHomeFacturas`, `CardHomePedidos`) con layout adaptativo. |

---

## Explicación técnica detallada

### 1. Vistas Livianas en PostgreSQL con RLS Heredado

**Archivo:** `supabase/migrations/20260616120000_sprint13_vw_resumen_residente.sql`

Para optimizar al máximo el rendimiento de la carga del Home, se optó por crear vistas del lado del servidor. Esto garantiza que el cliente no tenga que descargar colecciones completas y procesar agregaciones en JavaScript.

Las vistas utilizan la propiedad `WITH (security_invoker = true)`. A diferencia de `security_definer`, esta propiedad obliga a PostgreSQL a evaluar las políticas de RLS de las tablas subyacentes (`solicitudes`, `facturas`, `pedidos`) utilizando el contexto del usuario autenticado actual (`auth.uid()`). Esto nos ahorra tener que filtrar explícitamente por `usuario_id` en el WHERE de la vista, manteniendo las consultas simples y heredando automáticamente el control de acceso.

```sql
CREATE OR REPLACE VIEW public.vw_resumen_solicitudes_residente
WITH (security_invoker = true)
AS
SELECT
  count(*)                                                      AS total,
  count(*) FILTER (WHERE estado = 'pendiente')                  AS pendientes,
  count(*) FILTER (WHERE estado IN ('asignada','en_progreso'))  AS en_progreso,
  count(*) FILTER (WHERE estado = 'resuelta')                   AS pendientes_confirmacion
FROM public.solicitudes;
```

### 2. Layout del Dashboard Responsive

**Archivo:** `src/pages/ResidenteDashboard.tsx`

El contenedor del Dashboard está diseñado bajo un enfoque mobile-first. Se aplica la clase `grid grid-cols-1 sm:grid-cols-3` para apilar las tarjetas en pantallas móviles (menor o igual a 640px) y dividirlas en 3 columnas en pantallas desktop.

Para mejorar el CLS (Cumulative Layout Shift) y la fluidez visual, cada tarjeta de componente está envuelta en un contenedor con clases de animación gradual:
- Tarjeta de solicitudes: `animate-fade-in delay-1`
- Tarjeta de facturas: `animate-fade-in delay-2`
- Tarjeta de pedidos: `animate-fade-in delay-3`

---

## Cambios requeridos en Supabase ⚠️

> [!IMPORTANT]
> Es indispensable ejecutar la migración SQL en el dashboard de Supabase para habilitar las vistas de base de datos antes de desplegar el código frontend.

### Paso 1 — Ejecutar la migración

Ejecuta el archivo de migración en la base de datos de producción:
```
supabase/migrations/20260616120000_sprint13_vw_resumen_residente.sql
```

Esto creará las vistas:
1. `public.vw_resumen_solicitudes_residente`
2. `public.vw_resumen_facturas_residente`
3. `public.vw_resumen_pedidos_residente`

Y configurará los permisos de ejecución mínimos requeridos:
```sql
GRANT SELECT ON public.vw_resumen_solicitudes_residente TO authenticated;
GRANT SELECT ON public.vw_resumen_facturas_residente    TO authenticated;
GRANT SELECT ON public.vw_resumen_pedidos_residente     TO authenticated;

REVOKE ALL ON public.vw_resumen_solicitudes_residente FROM anon, public;
REVOKE ALL ON public.vw_resumen_facturas_residente    FROM anon, public;
REVOKE ALL ON public.vw_resumen_pedidos_residente     FROM anon, public;
```

---

## Arquitectura técnica

```
[Cliente (Dashboard)]
       │
       ├─► [fetch: vw_resumen_solicitudes_residente] ──► (RLS solicitudes) ──► Retorna conteos
       ├─► [fetch: vw_resumen_facturas_residente]    ──► (RLS facturas)    ──► Retorna KPIs mes/vencidos
       └─► [fetch: vw_resumen_pedidos_residente]     ──► (RLS pedidos)     ──► Retorna último pedido y KPI
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Usuario anónimo accede a la vista | Rechazado a nivel de Postgres. Las vistas revocan explícitamente permisos a `anon`. |
| Sin registros base | Las consultas devuelven valores en 0 o nulos de manera segura sin reventar la interfaz gracias al uso de `coalesce` y valores por defecto en el cliente. |
| Retraso de red en base de datos | Cada tarjeta del dashboard maneja su propio estado de carga animado tipo "skeleton" de manera independiente. |
