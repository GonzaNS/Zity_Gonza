# HU-EJEC-01 · Rol 'observador' + ruta `/admin/ejecutivo`

| Campo        | Valor |
|---|---|
| Sprint       | 14 |
| Estimación   | 2 h |
| Prioridad    | P1 |
| Migración    | `20260616120500_sprint14_rol_observador.sql` |

---

## Descripción

Como dueña del edificio, quiero un acceso de solo lectura a un panel ejecutivo, para ver el estado del edificio sin poder modificar nada operativo.

---

## Cambios implementados

### 1. Migración SQL 015 — `supabase/migrations/20260616120500_sprint14_rol_observador.sql`

- **Extiende el enum `rol_usuario`** con `ADD VALUE IF NOT EXISTS 'observador'`.  
  > ⚠️ `ADD VALUE` es DDL no transaccional en PostgreSQL. Supabase lo ejecuta como sentencia independiente al aplicar la migración — no envolver en un bloque `BEGIN/COMMIT` explícito.

- **Políticas RLS de solo lectura** para el rol `observador`:
  - `solicitudes`: `SELECT` global (ve todas, necesario para KPIs).
  - `historial_estados`: `SELECT` (para tiempos de resolución).
  - `facturas`: `SELECT` global.
  - `pedidos`: `SELECT` global.
  - **No** se crean políticas `INSERT / UPDATE / DELETE`. La RLS bloquea todo lo no permitido por defecto.

- **Función helper `puede_ver_metricas()`**:
  ```sql
  CREATE OR REPLACE FUNCTION public.puede_ver_metricas()
  RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER AS $$
    SELECT public.get_user_rol() IN ('admin', 'observador');
  $$;
  ```
  Permite que las RPCs de métricas verifiquen acceso sin comparar cadenas hardcodeadas.

- **Acceso a vistas del home**: `GRANT SELECT` sobre las vistas del Sprint 13 para `authenticated`.

- **`metodos_pago` sigue inaccesible** para el observador (no necesita datos financieros de residentes).

---

### 2. Tipos TypeScript — `src/types/database.ts`

```diff
-export type Rol = 'residente' | 'admin' | 'tecnico'
+export type Rol = 'residente' | 'admin' | 'tecnico' | 'observador'
```

Al ser un `Record<Rol, ...>` de tipo exhaustivo en TypeScript, esto genera errores de compilación en todos los archivos que usan esos mapas. Se actualizaron:

| Archivo | Cambio |
|---|---|
| `src/pages/Perfil.tsx` | `ROL_LABEL` y `ROL_BADGE_CLS` añaden `observador` |
| `src/components/shared/CampanaNotificaciones.tsx` | `RUTA_SOLICITUDES` → `observador: '/admin/ejecutivo'` |
| `src/components/shared/HistorialEstados.tsx` | `rolLabel` interno en `etiquetaAutor` añade `observador` |
| `src/components/admin/ModalInvitacion.tsx` | El tipo del form se estrecha a `'residente' \| 'tecnico' \| 'admin'` (el observador no se invita, se crea directamente en Supabase) |

---

### 3. Routing — `src/lib/routing.ts`

```ts
export const ROLE_ROUTES: Record<Rol, string> = {
  admin:      '/admin',
  residente:  '/residente',
  tecnico:    '/tecnico',
  observador: '/admin/ejecutivo',   // Sprint 14 · HU-EJEC-01
}
```

Cuando un observador inicia sesión, `RootRedirect` lo lleva automáticamente a `/admin/ejecutivo`.

---

### 4. Shell del observador — `src/components/observador/ObservadorShell.tsx`

Layout liviano diseñado para usuarios de solo lectura:
- Header fijo con logo Zity + badge **"Solo lectura"** (amber).
- **Banner informativo amber** bajo el header: _"Acceso de solo lectura. Este panel es informativo. No puedes modificar datos operativos del edificio."_
- Avatar + nombre del observador + botón "Salir".
- **"Ir al panel completo →"** visible solo si `profile.rol === 'admin'` (para cuando un admin navega a `/admin/ejecutivo`).
- Sin barra lateral de navegación operativa.

---

### 5. Página ejecutiva — `src/pages/admin/Ejecutivo.tsx`

Ruta: `/admin/ejecutivo`  
Acceso: `['admin', 'observador']`

- **Reutiliza completamente** los hooks existentes:
  - `useMetricasMantenimiento` → KPIs de solicitudes.
  - `useGraficasMantenimiento` → gráficas de Recharts.
- **Reutiliza los mismos chunks lazy** de `GraficasMetricas` que ya usa `/admin/metricas`. Si el admin visitó primero esa ruta, las gráficas están en caché.
- Muestra:
  - 4 tarjetas KPI (total, pendientes, en proceso, resueltas hoy).
  - Tabla de tiempos de resolución (AVG / mediana / P95).
  - Gráfica por tipo + Top 5 categorías + Tendencia mensual.
- **Sin botones de acción operativa** (no hay formularios, modales ni destructive actions).
- Monta `ObservadorShell`, no `AdminShell`.

---

### 6. Router — `src/App.tsx`

```tsx
{/* Sprint 14 · HU-EJEC-01 */}
<Route path="/admin/ejecutivo" element={
  <ProtectedRoute allowedRoles={['admin', 'observador']}>
    <Ejecutivo />
  </ProtectedRoute>
} />
```

- `/perfil` y `/notificaciones` amplían `allowedRoles` con `'observador'` para que el observador pueda gestionar su propio perfil y ver sus notificaciones.

---

### 7. Tests — `src/test/admin/observador.test.ts`

17 tests en 5 grupos:

| ID | Descripción | Resultado |
|---|---|---|
| T01 | `ROLE_ROUTES['observador']` → `/admin/ejecutivo` | ✅ |
| T02 | SELECT en solicitudes/historial no retorna error RLS | ✅ |
| T03 | INSERT en solicitudes → error `42501` | ✅ |
| T04 | UPDATE en facturas → error `42501` | ✅ |
| T05 | DELETE en solicitudes/pedidos/usuarios → error `42501` | ✅ |
| T06 | `allowedRoles` con `observador` lo autoriza | ✅ |
| T07 | `allowedRoles=['admin']` lo rechaza → redirección | ✅ |
| T08 | `puede_ver_metricas()` retorna `true` para admin y observador | ✅ |
| T09 | `puede_ver_metricas()` retorna `false` para residente y tecnico | ✅ |

---

## Cómo aplicar en Supabase

1. **Ejecutar la migración** desde el dashboard de Supabase o con la CLI:
   ```bash
   supabase db push
   ```
2. **Crear un usuario observador** directamente en Supabase Studio:
   - Tabla `auth.users`: crear usuario con email/contraseña.
   - Tabla `public.usuarios`: insertar fila con `rol = 'observador'` y `estado_cuenta = 'activo'`.
3. **Verificar acceso**: al iniciar sesión con ese usuario, debe redirigir a `/admin/ejecutivo` y el banner amber debe ser visible.

> ⚠️ El rol `observador` **no puede invitarse** desde el formulario de invitación del admin (`ModalInvitacion`). Debe crearse directamente en Supabase. Esto es intencional: el formulario de invitación reserva roles operacionales (`residente`, `tecnico`, `admin`).

---

## Consideraciones de seguridad

| Aspecto | Implementación |
|---|---|
| **Escritura bloqueada** | RLS no tiene políticas `INSERT/UPDATE/DELETE` para `observador` → denegado por defecto |
| **metodos_pago** | Sin política para `observador` → inaccesible |
| **audit_log** | El observador no tiene acciones de audit porque no realiza acciones escritas |
| **JWT** | El rol se verifica via `public.get_user_rol()`, no JWT raw (consistente con el resto del sistema) |
| **Invitación** | El rol no aparece en el formulario de invitación → solo el admin puede crearlo via Supabase Studio |
