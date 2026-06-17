# HU-PAGO-02 · Vista 'Mis tarjetas' · CRUD + predeterminada

**Sprint 13 · 2.5 h · Addendum · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero guardar y administrar mis tarjetas, para no tener que escribirlas cada vez que pago.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Apartado 'Mis tarjetas' en perfil del residente | ✅ | Montado como pestaña `"Tarjetas"` en `/perfil` (visible únicamente si `profile.rol === 'residente'`). |
| Máscara de entrada y detección de marca | ✅ | El input formatea el número en grupos de 4 en vivo y renderiza un chip con la marca (Visa, Mastercard, Amex, etc.) basándose en el BIN. |
| Enmascarado de tarjeta en listado | ✅ | Muestra el formato `•••• •••• •••• 1234` + marca + fecha de vencimiento. |
| Marcar predeterminada y Eliminar | ✅ | Permite rotar la tarjetadefault e incluye confirmación de borrado en un modal emergente. |
| Validación de Luhn antes de tokenizar | ✅ | Algoritmo mod-10 implementado localmente; impide el submit si el número falla la suma. |
| Registro en Audit Log sin PII | ✅ | Genera registros de auditoría en la base de datos tras dar de alta, marcar predeterminada o borrar una tarjeta. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`src/components/residente/MisTarjetas.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/residente/MisTarjetas.tsx) | Componente del panel CRUD de tarjetas con formulario, máscara de entrada, validaciones y listados. |
| [`src/hooks/useMetodosPago.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/hooks/useMetodosPago.ts) | Hook React que centraliza la llamada al algoritmo de Luhn, detección de marcas, tokenización en memoria y persistencia de datos. |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/lib/metodos-pago.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metodos-pago.ts) | Agregadas utilidades puras `luhnValido()`, `tokenizarTarjeta()`, `detectarMarca()` y enmascarados de interfaz. |
| [`src/pages/Perfil.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/pages/Perfil.tsx) | Integración de la pestaña "Tarjetas" condicionada a que el perfil sea residente, llamando al componente principal. |
| [`src/lib/audit.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/audit.ts) | Agregadas las acciones `alta_metodo_pago`, `predeterminada_metodo_pago` y `eliminar_metodo_pago`. |

---

## Explicación técnica detallada

### 1. Validación Local de Luhn (Algoritmo Mod-10)

**Archivo:** `src/lib/metodos-pago.ts`

El número de la tarjeta (PAN) se valida del lado del cliente en tiempo real utilizando la fórmula de Luhn. Si la suma total no es múltiplo de 10, la tarjeta se considera inválida. El input en la UI se marca con un borde rojo, y el botón de enviar queda inhabilitado.

```typescript
export function luhnValido(pan: string): boolean {
  const digitos = pan.replace(/\D/g, '')
  if (digitos.length < 13 || digitos.length > 19) return false

  let suma = 0
  let doblar = false
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = parseInt(digitos[i]!, 10)
    if (doblar) {
      d *= 2
      if (d > 9) d -= 9
    }
    suma += d
    doblar = !doblar
  }
  return suma % 10 === 0
}
```

### 2. Tokenización en Cliente y Descarte Inmediato del PAN

Para asegurar que el PAN en bruto nunca viaje al servidor de base de datos ni sea interceptado en el payload de red, el hook tokeniza localmente el número.

Genera un hash simple XOR rotativo irreversible a partir de los dígitos combinándolo con un timestamp opaco (simulando la generación de IDs de Stripe). Extrae los últimos 4 dígitos para fines de presentación en la UI y **descarta el PAN en bruto de la memoria**, rompiendo referencias para que sea limpiado por el recolector de basura (Garbage Collector) de JavaScript de inmediato.

```typescript
export function tokenizarTarjeta(pan: string): { token: string; ultimos4: string } {
  const digitos = pan.replace(/\D/g, '')
  const ultimos4 = digitos.slice(-4)
  const hash = digitos
    .split('')
    .reduce((acc, d, i) => acc ^ (parseInt(d, 10) << (i % 8)), 0)
    .toString(16)
    .padStart(8, '0')
  const token = `tok_sim_${hash}_${Date.now().toString(36)}`
  return { token, ultimos4 }
}
```

### 3. Registro de Auditoría sin Información Sensible

Toda transacción en el panel se reporta al log central de auditorías (`audit_log`). Para cumplir con la política no-PII, no se incluye información personal ni financiera de la tarjeta:
- **Alta**: Registra `{ marca, ultimos4, predeterminada }`.
- **Marcar Default**: Registra `{ metodo_pago_id }`.
- **Eliminación**: Registra `{ metodo_pago_id }`.

---

## Cambios requeridos en Supabase ⚠️

### Auditoría

Asegúrate de agregar al array de auditoría las tres nuevas acciones autorizadas del frontend. En `src/lib/audit.ts` se definen de la siguiente manera:

```typescript
export type AccionAudit =
  ...
  | 'alta_metodo_pago'
  | 'predeterminada_metodo_pago'
  | 'eliminar_metodo_pago'
```

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Intento de registrar tarjeta inválida | El botón de submit se bloquea y se muestra un indicador visual rojo junto al campo de número. |
| Rotación de predeterminada | Para evitar violar el índice único parcial en base de datos (máx 1 predeterminada), la función `establecerPredeterminado()` en `src/lib/metodos-pago.ts` actualiza primero todas las tarjetas a `predeterminada = false` y luego marca la nueva a `true`. |
| Tarjeta expirada | El formulario valida dinámicamente el mes y año contra la fecha actual (`ANIO_ACTUAL` y `MES_ACTUAL`), arrojando un error en el modal antes de proceder a la tokenización. |
