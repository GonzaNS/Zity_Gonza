# HU-HOME-02 · Tarjeta 'Solicitudes activas'

**Sprint 13 · 2 h · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero ver mis solicitudes activas con su estado, para saber de un vistazo en qué va cada una.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Muestra solicitudes activas del residente y su badge de estado | ✅ | Muestra hasta 5 solicitudes del residente en estados no finalizados (excluye 'cerrada'). |
| Incluye últimos 3 cambios de estado (o de la más reciente) | ✅ | Renderiza una mini línea de tiempo por solicitud usando el JSONB embebido devuelto por la vista Postgres. |
| Clic enlaza al detalle correspondiente | ✅ | Al hacer clic en una solicitud se navega a `/residente/solicitudes?solicitud_id=<id>`, abriendo el drawer de detalle. |
| Datos provienen de `vw_home_solicitudes` | ✅ | Consumidos vía hook `useHomeSolicitudes` conectado a la vista Supabase. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260616120100_sprint13_vw_home_solicitudes.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616120100_sprint13_vw_home_solicitudes.sql) | DDL de la vista `vw_home_solicitudes` con timeline JSONB agregado en la base de datos. |
| [`src/hooks/useHomeSolicitudes.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useHomeSolicitudes.ts) | Hook de React que expone los datos de la vista y formatea el timeline. |
| [`src/components/residente/CardHomeSolicitudes.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/residente/CardHomeSolicitudes.tsx) | Componente UI de la tarjeta de solicitudes con renderizado de mini timeline e indicadores de prioridad. |

---

## Explicación técnica detallada

### 1. Timeline Embebido en SQL sin N+1 Queries

**Archivo:** `supabase/migrations/20260616120100_sprint13_vw_home_solicitudes.sql`

Uno de los mayores desafíos al implementar líneas de tiempo en listas es el problema de consultas N+1 (donde por cada solicitud se dispara una consulta para obtener su historial). Para resolver esto, la vista Postgres embebe los últimos 3 cambios de estado en un único campo JSONB llamado `ultimos_estados`.

Utilizamos una subconsulta correlacionada con `jsonb_agg` y un límite interno de 3 sobre la tabla `historial_estados`.

```sql
CREATE OR REPLACE VIEW public.vw_home_solicitudes
WITH (security_invoker = true)
AS
SELECT
  s.id,
  s.codigo,
  s.tipo,
  s.categoria,
  s.descripcion,
  s.estado,
  s.prioridad,
  s.imagen_url,
  s.created_at,
  s.updated_at,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'estado_nuevo',      he.estado_nuevo,
          'estado_anterior',   he.estado_anterior,
          'created_at',        he.created_at,
          'nota',              he.nota
        )
        ORDER BY he.created_at DESC
      )
      FROM (
        SELECT estado_nuevo, estado_anterior, created_at, nota
        FROM public.historial_estados
        WHERE solicitud_id = s.id
        ORDER BY created_at DESC
        LIMIT 3
      ) he
    ),
    '[]'::jsonb
  ) AS ultimos_estados
FROM public.solicitudes s
WHERE s.estado IN ('pendiente', 'asignada', 'en_progreso', 'resuelta')
ORDER BY s.updated_at DESC
LIMIT 5;
```

### 2. Componente de UI y Mini Línea de Tiempo

**Archivo:** `src/components/residente/CardHomeSolicitudes.tsx`

La interfaz mapea los últimos estados en un timeline vertical compacto usando Tailwind CSS:
- Un borde izquierdo en gris cálido (`border-l border-warm-200`) actúa como línea guía.
- Por cada cambio de estado, se dibuja un círculo de color semántico relativo al estado destino (ej. azul para `asignada`, verde para `resuelta`).
- El texto del cambio y el tiempo relativo transcurrido (`tiempoTranscurrido(created_at)`) se muestran a la derecha.

---

## Cambios requeridos en Supabase ⚠️

### Paso 1 — Ejecutar la migración

Ejecuta el archivo de migración en la base de datos de Supabase:
```
supabase/migrations/20260616120100_sprint13_vw_home_solicitudes.sql
```

Esto crea la vista `vw_home_solicitudes` y otorga permisos de lectura (`SELECT`) a los usuarios autenticados:
```sql
GRANT SELECT ON public.vw_home_solicitudes TO authenticated;
REVOKE ALL  ON public.vw_home_solicitudes FROM anon, public;
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Solicitud sin transiciones previas | `COALESCE` en SQL asegura que `ultimos_estados` devuelva `[]` en lugar de `NULL`. El componente en React oculta la línea de tiempo de forma segura. |
| Nota de cambio de estado muy larga | Se aplica la clase `truncate` de CSS para evitar desbordar el timeline del dashboard. |
| Múltiples solicitudes con actualizaciones recientes | La vista limita el feed a un máximo de 5 filas (`LIMIT 5`) ordenadas por fecha de actualización (`updated_at DESC`). |
