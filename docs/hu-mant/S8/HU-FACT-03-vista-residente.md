# HU-FACT-03 · Residente ve sus facturas con desglose

**Sprint 8 · Vista `/residente/facturas` · Tarjetas + filtro + total acumulado**

---

## Descripción

Como residente activo, quiero ver mis facturas en mi panel con desglose por tipo y estado, para saber exactamente cuánto debo pagar este mes y qué ya está saldado.

---

## Arquitectura: Qué, Cómo y Por qué

### Número legible F-YYYY-MM-NNN con tabla contador

El criterio pide un número de factura como `F-2026-05-001`. PostgreSQL no permite secuencias con parámetros dinámicos (`NEXTVAL` siempre avanza globalmente). La solución es una **tabla `facturas_secuencia` con `ON CONFLICT DO UPDATE SET ultimo = ultimo + 1`**:

```sql
INSERT INTO public.facturas_secuencia (periodo, ultimo)
VALUES (NEW.periodo, 1)
ON CONFLICT (periodo) DO UPDATE
  SET ultimo = public.facturas_secuencia.ultimo + 1
RETURNING ultimo INTO v_siguiente;
```

Esto es **atómico**: si dos facturas del mismo período se insertan concurrentemente, el `FOR UPDATE` implícito del `ON CONFLICT DO UPDATE` serializa las actualizaciones y nunca genera el mismo número dos veces.

### Scroll infinito con IntersectionObserver

En lugar de botones "Cargar más" o paginación numérica, se usa un **centinela invisible** al final de la lista:

```tsx
const observer = new IntersectionObserver(
  entries => { if (entries[0]?.isIntersecting) cargarMas() },
  { rootMargin: '200px' },  // empieza a cargar 200px antes del viewport
)
observer.observe(centinelaRef.current)
```

`rootMargin: '200px'` carga la siguiente página antes de que el usuario llegue al borde — la experiencia se siente fluida e instantánea. El observador se desconecta (`observer.disconnect()`) en el cleanup del `useEffect` para evitar memory leaks.

### Detección visual de vencimiento

```typescript
export function estaVencida(factura): boolean {
  if (factura.estado === 'pagada') return false
  return new Date(factura.vencimiento) < new Date()
}
```

Una factura puede estar en estado `'pendiente'` en la BD pero ya haber pasado su fecha. La función `estaVencida()` detecta esto en el cliente y aplica el estilo rojo/error **inmediatamente**, sin esperar a que un proceso backend actualice el estado. Esto mejora la UX sin requerir un cron job de actualización de estados.

### Corrección de fechas en zona horaria

Las fechas de tipo `date` de PostgreSQL llegan como `'YYYY-MM-DD'` sin zona horaria. Al hacer `new Date('2026-05-31')`, JavaScript las interpreta en UTC, lo que puede mostrar el día anterior en zonas UTC-N. La corrección es añadir `T12:00:00` antes de parsear:

```typescript
new Date(iso + 'T12:00:00').toLocaleDateString('es', ...)
```

Esto ancla la fecha al mediodía local, que nunca cruza el cambio de día por zona horaria.

---

## Cambios Requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar **en orden** en el SQL Editor de Supabase:
> ```
> 1. supabase/migrations/20260527012000_sprint8_facturas.sql         (tabla + RLS)
> 2. supabase/migrations/20260527013000_sprint8_facturas_lote.sql    (corrección FK + RPC lote)
> 3. supabase/migrations/20260527014000_sprint8_facturas_numero.sql  (número legible)
> ```

---

## Archivos Creados / Modificados

#### [NEW] `supabase/migrations/20260527014000_sprint8_facturas_numero.sql`
- Columna `numero text` en `facturas`
- Tabla `facturas_secuencia` como contador atómico por período
- Trigger `before_factura_numero` BEFORE INSERT

#### [NEW] `src/hooks/useFacturasResidente.ts`
- Paginación lazy (25 por página) con `range(desde, hasta)`
- Carga paralela de primera página + total pendiente del mes actual
- `cargarMas()` acumula páginas adicionales sin resetear la lista

#### [NEW] `src/pages/residente/Facturas.tsx`
Página completa con:
- Cabecera total pendiente del período actual (`formatearPeriodo`)
- Filtros como pills (Todas / Pendientes / Pagadas / Vencidas)
- Grid de tarjetas `CardFactura` responsive (1 col móvil, 2 col desktop)
- Centinela `IntersectionObserver` para scroll infinito
- Panel de detalle `DetalleFactura` como vista alternativa (sin navegación a ruta nueva)

#### [MODIFY] `src/App.tsx`
- Lazy import de `ResidenteFacturas`
- Ruta `/residente/facturas` protegida para rol `residente`

#### [MODIFY] `src/pages/ResidenteDashboard.tsx`
- Enlace "Mis facturas" en la cabecera del dashboard

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Tarjetas: icono + tipo + monto + vencimiento + badge estado | ✅ | `CardFactura` con colores por tipo y `BADGE_FACTURA_ESTADO` |
| Cabecera con total acumulado pendiente del período | ✅ | Query paralela al cargar; `totalPendiente` calculado en el cliente |
| Filtro por estado en cabecera | ✅ | Pills `Todas / Pendientes / Pagadas / Vencidas` |
| Ordenadas por vencimiento ascendente | ✅ | `.order('vencimiento', { ascending: true })` |
| Detalle con número legible al hacer click | ✅ | `DetalleFactura` con `F-YYYY-MM-NNN` y desglose completo |
| Responsiva: tarjetas apiladas en móvil | ✅ | `grid-cols-1 sm:grid-cols-2` |
| Scroll infinito (25 en 25) | ✅ | `IntersectionObserver` + `useFacturasResidente.cargarMas()` |
| RLS: solo facturas de `residente_id = auth.uid()` | ✅ | Política `facturas_residente_select` de HU-FACT-01 |
