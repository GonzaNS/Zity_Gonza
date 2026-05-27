# HU-FACT-02 · Admin emite facturas (individual + lote)

**Sprint 8 · Vista `/admin/facturacion` · Formulario + transacción Postgres**

---

## Descripción

Como administrador, quiero emitir facturas mensuales por residente — una a una o en lote para todos los residentes activos, para gestionar los cobros del edificio sin tareas manuales repetidas.

---

## Arquitectura: Qué, Cómo y Por qué

### Doble modo en la misma página

La página `/admin/facturacion` tiene un selector de modo (pill toggle) que comparte el mismo formulario para ambas acciones. Esto evita duplicar código y mantiene una UX coherente: los campos son idénticos, solo cambia el sujeto (un residente vs. todos).

### Autocompletado de vencimiento

```typescript
function ultimoDiaDelMes(periodo: string): string {
  const [year, month] = periodo.split('-').map(Number)
  const ultimo = new Date(year, month, 0)  // día 0 del mes siguiente = último día del mes
  return ultimo.toISOString().split('T')[0]
}
```

`new Date(year, month, 0)` es el truco idiomático de JS para calcular el último día del mes. Funciona correctamente para febrero (incluyendo años bisiestos), diciembre, etc. Sin ninguna librería de fechas.

### RPC transaccional `emitir_facturas_lote`

**Por qué un RPC y no múltiples INSERTs desde el cliente:**
- Un error de red entre el INSERT #3 y el #4 dejaría a algunos residentes con factura y otros sin ella — un estado inconsistente imposible de detectar.
- Con un RPC PL/pgSQL, toda la operación vive en una única transacción PostgreSQL. Si cualquier INSERT falla (incluso por la constraint `UNIQUE`), PostgreSQL hace `ROLLBACK` automáticamente y *ninguna* factura se crea.
- El manejo del error `unique_violation` captura el caso específico de "ya existe esa factura" y devuelve un mensaje legible en lugar del críptico error PostgreSQL.

### Validación en dos capas

| Capa | Qué valida |
|------|-----------|
| **Cliente** (`validar()`) | Campos vacíos, formato YYYY-MM, monto ≥ 0, vencimiento ≥ inicio del período |
| **Servidor** (RPC + constraints BD) | Mismo + UNIQUE(residente_id, tipo, periodo), CHECK(monto ≥ 0), CHECK regex periodo, FK residente activo |

La validación cliente es UX — respuesta inmediata sin round-trip. La validación servidor es la real — no se puede omitir.

### Modal de confirmación para lote

El modal muestra exactamente cuántos residentes serán afectados **antes** de ejecutar. Esto es crítico porque la operación no se puede deshacer individualmente (se requeriría un UPDATE de estado).

---

## Corrección FK incluida

> [!IMPORTANT]
> La migración HU-FACT-01 tenía un error: referenciaba `public.perfiles` en lugar de `public.usuarios` (tabla real del proyecto). La migración `20260527013000_sprint8_facturas_lote.sql` incluye la corrección de FK además del RPC de lote.

---

## Cambios Requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar **en orden** en el SQL Editor de Supabase:
> ```
> 1. supabase/migrations/20260527012000_sprint8_facturas.sql        (HU-FACT-01)
> 2. supabase/migrations/20260527013000_sprint8_facturas_lote.sql   (HU-FACT-02: corrección FK + RPC lote)
> ```

---

## Archivos Creados / Modificados

#### [NEW] `supabase/migrations/20260527013000_sprint8_facturas_lote.sql`
- Corrección de FK (`perfiles` → `usuarios`)
- RPC `emitir_facturas_lote` transaccional

#### [NEW] `src/hooks/useResidentesActivos.ts`
Hook ligero que carga solo `(id, nombre, apellido, departamento, piso)` de residentes activos, minimizando el payload del dropdown.

#### [NEW] `src/pages/admin/Facturacion.tsx`
Página completa con:
- Toggle individual / lote
- Formulario unificado con validación progresiva (campo a campo)
- Autocompletado de vencimiento al último día del mes
- Modal de confirmación para lote con conteo de afectados
- Toast de éxito/error siguiendo el patrón de `Notificaciones.tsx`

#### [MODIFY] `src/App.tsx`
- Lazy import de `AdminFacturacion`
- Ruta `/admin/facturacion` protegida para rol `admin`

#### [MODIFY] `src/components/admin/AdminShell.tsx`
- Enlace "Facturación" en la navegación lateral

#### [MODIFY] `src/types/database.ts`
- `TipoNotificacion` actualizado con `'factura_nueva'`

#### [MODIFY] `src/lib/facturas.ts`
- FK corregida en la migración referenciada

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Vista `/admin/facturacion` con doble modo | ✅ | Toggle individual / lote en pill selector |
| Individual con dropdown filtrado por `estado_cuenta='activo'` | ✅ | `useResidentesActivos` filtra por rol + estado |
| Autocompletado de vencimiento al día 30 (ajuste de febrero) | ✅ | `ultimoDiaDelMes` usa `new Date(year, month, 0)` — correcto para bisiestos |
| Modal de confirmación en lote con conteo de afectados | ✅ | Muestra `residentes.length` antes de ejecutar |
| Transacción atómica con rollback en UNIQUE violation | ✅ | RPC `emitir_facturas_lote` con manejo de `unique_violation` |
| Validaciones cliente y servidor | ✅ | Doble capa, mensaje específico por error |
| Toast de éxito con conteo o error con detalle | ✅ | Patrón del proyecto: `fixed bottom-6 rounded-full` |
