# PBI-S6-E03 · Sesiones activas · Cerrar todas las demás

**Sprint 13 · 2 h · P2**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero ver mis sesiones activas y poder cerrar todas las demás, para proteger mi cuenta si entré desde un dispositivo que ya no uso.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Pestaña 'Sesiones' en `/perfil` | ✅ | Panel interactivo agregado con el listado detallado de la sesión en curso. |
| Detalle de dispositivo y fecha de inicio | ✅ | Parseo del User Agent en cliente para identificar sistema operativo y navegador, junto con la fecha de login inicial. |
| Acción 'Cerrar todas las demás' | ✅ | Botón que preserva la sesión activa actual y destruye todas las demás sesiones en otros dispositivos. |
| Cambio de contraseña invalida sesiones ajenas | ✅ | Al cambiar de contraseña de forma exitosa se cierra de manera forzada el acceso en los demás dispositivos. |

---

## Archivos creados / modificados

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/pages/Perfil.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/Perfil.tsx) | Añadido el estado de sesiones, la pestaña "Sesiones" con el componente interactivo `SesionePanel`, el parser del User Agent y la integración con la API de Auth. |
| [`src/lib/audit.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/audit.ts) | Agregada la acción `'cerrar_sesiones'` al catálogo de auditoría del frontend. |

---

## Explicación técnica detallada

### 1. Manejo de Ámbitos de Cierre de Sesión (SignOut Scope) en Supabase

Supabase Auth (basado en GoTrue) soporta la invalidación selectiva de tokens de acceso mediante el parámetro `scope`. Para cerrar las sesiones en otros dispositivos preservando la actual, se invoca:

```typescript
const { error } = await supabase.auth.signOut({ scope: 'others' })
```

Esta instrucción le indica a GoTrue que invalide todos los refresh tokens asociados al ID del usuario en la base de datos de Auth, con excepción del token de sesión que envió la solicitud actual.

### 2. Detección de Dispositivo basada en User-Agent

**Archivo:** `src/pages/Perfil.tsx`

Dado que el SDK de cliente de Supabase no expone un endpoint público directo para listar las sesiones de otros dispositivos (por motivos de seguridad en clientes web), se lista la sesión actual enriquecida con información de telemetría local.

El User Agent del navegador se parsea localmente en la función `parseDispositivo()` para extraer nombres amigables del sistema operativo y el navegador, brindando una experiencia Premium:

```typescript
function parseDispositivo(ua: string): { dispositivo: string; navegador: string } {
  const ua_lower = ua.toLowerCase()
  let dispositivo = 'Escritorio'
  if (/iphone/.test(ua_lower))         dispositivo = 'iPhone'
  else if (/android/.test(ua_lower))   dispositivo = ua_lower.includes('mobile') ? 'Android (Móvil)' : 'Android (Tablet)'
  else if (/windows/.test(ua_lower))   dispositivo = 'Windows'
  
  let navegador = 'Navegador desconocido'
  if (/edg\//.test(ua_lower))          navegador = 'Edge'
  else if (/chrome\//.test(ua_lower))  navegador = 'Chrome'
  else if (/firefox\//.test(ua_lower)) navegador = 'Firefox'
  else if (/safari\//.test(ua_lower))  navegador = 'Safari'

  return { dispositivo, navegador }
}
```

### 3. OWASP Session Management en Cambio de Contraseña

Cumpliendo con las recomendaciones internacionales de seguridad (OWASP A02: Cryptographic Failures / Session Management), cuando un usuario realiza el flujo de cambio de contraseña en la pestaña de Seguridad, se ejecutan las siguientes acciones concurrentes tras el cambio exitoso:
1. Se registra la acción `cambio_contrasena` en la tabla `audit_log`.
2. Se ejecuta `supabase.auth.signOut({ scope: 'others' })` inmediatamente para expulsar a cualquier intruso o sesión antigua que tuviera la contraseña vieja.

---

## Cambios requeridos en Supabase ⚠️

> [!NOTE]
> No se requieren migraciones DDL ni RLS a nivel de base de datos de Supabase, ya que se apoya en los endpoints nativos del esquema `auth` de Supabase.

### Auditoría
La acción `'cerrar_sesiones'` se registra en el log de auditoría. Si en tu ambiente local el trigger de auditoría valida de forma estricta los valores de la columna `accion`, asegúrate de que el catálogo de acciones acepte esta nueva clave. El archivo `src/lib/audit.ts` ya contiene la actualización del catálogo del lado de la aplicación:

```typescript
export type AccionAudit =
  ...
  | 'cerrar_sesiones'
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Falla de red al cerrar otras sesiones | El loader animado se apaga y se presenta el mensaje de error de red en el panel, manteniendo la sesión actual intacta. |
| Sesión expira durante la visualización | Si el token expira, `getSession()` devuelve nulo y la interfaz redirige de manera segura al login sin reventar la app. |
| Cambio de contraseña exitoso | El usuario permanece logueado en la pestaña actual (su refresh token actual sigue vigente), pero cualquier otra ventana en otro navegador o móvil será deslogueada en su próxima petición. |
