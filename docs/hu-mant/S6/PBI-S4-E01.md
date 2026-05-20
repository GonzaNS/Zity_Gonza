# PBI-S4-E01: Notificar al admin cuando residente rechaza

## Historia de Usuario
**Como** administrador,
**Quiero** recibir una notificación en el sistema cuando un residente rechaza la solución de un técnico,
**Para** poder hacer seguimiento o mediar si la solicitud se escala luego de repetidos intentos.

## Criterios de Aceptación
1. El enum de base de datos (`TipoNotificacion` en TS) soporta el nuevo literal `alerta_rechazo`.
2. Al momento de que un residente rechace la solución (estado pasa de `resuelta` a `en_progreso`), se envían notificaciones a todos los perfiles de administradores con cuenta activa.
3. El mensaje de notificación debe incluir el número de intento actual.
4. Si la solicitud entra en estado de escalada (porque superó el máximo de intentos), la notificación debe indicar claramente que la solicitud fue escalada y requiere atención.

## Decisiones Técnicas y Contexto
- **Backend vs Frontend**: Aunque la forma más robusta sería un Trigger en PostgreSQL, debido a los requerimientos de Sprint y restricciones de no tocar DDL, la inserción masiva a la tabla de `notificaciones` se realiza de forma manual en el cliente (frontend) dentro de `rechazarSolicitud`.

## Archivos Modificados
- `src/types/database.ts`: Inclusión de `'alerta_rechazo'` al union type `TipoNotificacion`.
- `src/hooks/useConfirmarSolicitud.ts`: En `rechazarSolicitud`, se añadió una consulta a los administradores activos (`rol = 'admin'` y `estado_cuenta = 'activo'`) y un `insert` masivo en `notificaciones`.

## Notas de Implementación (Mitigantes)
- **Bloqueos (Non-blocking)**: El proceso de notificar se maneja con `.catch(() => {})` para que, si falla (por ej. RLS o latencia), no rompa el flujo principal de rechazo del usuario.
- **Escalabilidad**: Traer los admins activos es rápido porque la cantidad de admins por condominio suele ser de 1 a 5 personas, no afectando el performance del cliente.
