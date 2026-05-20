# PBI-S5-E02: Centro de Notificaciones en Tiempo Real y Rango de Fechas Reusable

## Historia de Usuario
**Como** usuario del condominio (residente, técnico o administrador),
**Quiero** recibir notificaciones en tiempo real sobre los cambios de estado de mis solicitudes y poder ver un historial completo paginado y filtrable,
**Para** mantenerme informado de forma oportuna sin tener que recargar la aplicación constantemente.

## Criterios de Aceptación
1. **Campana de Notificaciones (Navbar)**:
   - Debe mostrarse un badge animado con el contador de notificaciones no leídas.
   - Al darle clic, debe abrir un dropdown con las últimas 10 notificaciones ordenadas por fecha.
   - Debe incluir un botón de "Marcar todas leídas" que haga un *optimistic update* para mejorar la UX.
   - Las notificaciones se suscriben de forma reactiva mediante `Supabase Realtime` (`on('postgres_changes')`).
2. **Página de Historial de Notificaciones (/notificaciones)**:
   - Accesible para todos los roles de usuario.
   - Lista completa filtrable por Estado (Todas, Leídas, No Leídas) y Rango de Fechas.
   - Debe usar el componente reusable `RangoDeFechas`.
3. **Abstracción de RangoDeFechas**:
   - Se debe extraer la lógica de filtros de fecha a un componente reusable `RangoDeFechas.tsx` con validación lógica (el rango "Desde" no puede ser mayor que "Hasta" y no puede superar los 90 días).
   - Refactorizar el panel de Auditoría del Admin (`src/pages/admin/Auditoria.tsx`) para utilizar esta abstracción.
4. **Vínculo Auditoría-Solicitud**:
   - En el drawer de detalle de solicitudes del Administrador, agregar un botón de "Ver auditoría" que redirija a `/admin/auditoria` prefiltrando por la entidad `solicitudes` y su respectivo `solicitudId`.

## Decisiones Técnicas y Contexto
- **Optimistic Updates**: Se implementó una actualización optimista en el hook `useNotificaciones` para el marcado de lectura. Esto previene latencias molestas para el usuario al procesar lotes de notificaciones.
- **Simulación de Triggers**: Debido a la restricción de no modificar el DDL del backend Supabase, se implementó una inserción simulada desde el helper `cambiarEstadoSolicitud` en `src/lib/solicitudes.ts` para disparar automáticamente una notificación tipo `estado_cambio` al residente asociado.
- **TypeScript Strict**: Se corrigió el tipo `Notificacion` en `src/types/database.ts` para reflejar con precisión la presencia de la propiedad `titulo`.

## Archivos Modificados/Creados
- `src/lib/notificaciones.ts`: Hook reactivo `useNotificaciones` con realtime y optimismo.
- `src/components/shared/CampanaNotificaciones.tsx`: Dropdown e íconos dinámicos.
- `src/components/shared/RangoDeFechas.tsx`: Componente de validación de fechas reusable.
- `src/pages/Notificaciones.tsx`: Vista completa y filtros de notificaciones.
- `src/App.tsx`: Definición de ruta `/notificaciones` compartida.
- `src/components/admin/solicitudes/DrawerSolicitud.tsx`: Enlace rápido a auditoría.
- `src/hooks/useAuditLog.ts`: Adaptación del filtro de URL para recibir `entidad_id` y `entidad`.
- `src/pages/admin/Auditoria.tsx`: Refactorizado con `RangoDeFechas`.
- `src/lib/solicitudes.ts`: Inserción de notificación automática al cambiar estado.

## Notas de Implementación (Mitigantes)
- **Desuscripción Limpia**: El canal de *Supabase Realtime* se desuscribe rigurosamente en el *cleanup* del efecto de `useNotificaciones` para prevenir fugas de memoria (*memory leaks*).
- **Validación del Rango**: El componente de fecha bloquea búsquedas erróneas o excesivamente largas (mayores a 90 días) mostrando un mensaje de error inline, evitando sobrecargas de queries en la base de datos.
