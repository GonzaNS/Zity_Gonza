# HU-PAGO-03 · Pago de factura con tarjeta guardada

**Sprint 13 · 2.5 h · Addendum · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como residente, quiero pagar una factura con una tarjeta guardada, para completar el pago en un par de clics sin reescribir mis datos.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Precarga de tarjeta predeterminada | ✅ | Al abrir el modal, se consultan las tarjetas del usuario y se selecciona automáticamente la marcada como default. |
| Selector de tarjetas guardadas o ingreso de nueva | ✅ | Toggle visual `"Tarjeta guardada"` / `"Nueva tarjeta"`. Permite cambiar la tarjeta de cobro con un clic. |
| Solicitar CVV en cada pago (sin persistencia) | ✅ | Campo obligatorio para confirmar la operación. Se procesa únicamente en memoria del componente frontend. |
| Registro de pago y cambio de estado en tiempo real | ✅ | Ejecuta la RPC `pagar_factura_residente`. Las actualizaciones de estado ('pagada') se propagan por Realtime. |
| Compatibilidad y fallback para usuarios sin tarjetas | ✅ | Si el usuario no tiene tarjetas guardadas, se desactiva el toggle y se muestra el formulario manual heredado del Sprint 10. |

---

## Archivos creados / modificados

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/components/residente/ModalPagoSimulado.tsx`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/components/residente/ModalPagoSimulado.tsx) | Reescrito por completo para integrar el listado de métodos de pago, el selector de tarjetas guardadas, validación de CVV en caliente y opción para tokenizar y guardar nuevas tarjetas durante el flujo de checkout. Mantiene intacta su firma de Props para evitar romper dependencias en `Facturas.tsx`. |

---

## Explicación técnica detallada

### 1. Preservación del Contrato de Interfaz (Props API)

El modal rediseñado mantiene exactamente las mismas propiedades que en el Sprint 10. Esto garantiza cero fricciones de integración y evita tener que refactorizar los componentes llamadores de facturación:

```typescript
type Props = {
  factura: Factura
  onClose: () => void
  onPagado: (mensaje: string) => void
}
```

### 2. Flujo de Control de Tarjeta Nueva vs Guardada

**Archivo:** `src/components/residente/ModalPagoSimulado.tsx`

Al cargarse el modal, se ejecuta una consulta para listar los métodos de pago. Si la respuesta es vacía, el estado del formulario cambia automáticamente a `modo = 'nueva'`. Si hay tarjetas guardadas:
- Se lista un selector dropdown/radio donde cada tarjeta muestra su enmascaramiento e icono de marca.
- Se selecciona automáticamente el método predeterminado.
- El usuario solo debe ingresar el CVV en una caja de texto pequeña para autorizar la simulación de pago.

### 3. Registro de Tarjeta en Caliente (On-the-fly)

Si el residente selecciona "Nueva tarjeta" en el modal y activa la opción `"Guardar tarjeta para futuros pagos"`, el componente realiza el flujo de tokenización en caliente durante la ejecución del pago:
1. El número es validado con Luhn local.
2. Se tokeniza descartando el PAN en bruto.
3. Se invoca de forma asíncrona la función `agregarMetodoPago()` en modo fire-and-forget: si por algún motivo falla el registro de la tarjeta (ej. alias duplicado), el pago de la factura **no se interrumpe**, priorizando la conversión y experiencia del usuario.

### 4. Ciclo del CVV y OWASP A02

En ningún momento el CVV ingresado se propaga fuera del estado interno del formulario:
- No se incluye en el payload enviado a la RPC de Supabase.
- No se guarda en variables de sesión.
- No se pasa a los callbacks de auditoría ni logs de consola.
- Su única función es simular el paso de autenticación del cliente (UX realista).

---

## Cambios requeridos en Supabase ⚠️

> [!NOTE]
> No se requieren migraciones adicionales para esta historia de usuario. Utiliza la tabla `metodos_pago` y las vistas creadas en las HUs previas del Sprint 13, así como la RPC `pagar_factura_residente` ya existente desde el Sprint 10.

---

## Casos de borde documentados

| Caso | Comportamiento esperado |
|---|---|
| Usuario sin tarjetas | Se oculta el switch de tarjeta guardada, mostrando directamente el formulario manual (fallback seguro). |
| CVV inválido | El botón de confirmación se deshabilita si el campo tiene menos de 3 dígitos (o menos de 4 en caso de American Express detectada). |
| Realtime latency | Tras confirmar la transacción exitosa, el modal invoca `onPagado()` y el WebSocket de Supabase en `Facturas.tsx` se encarga de actualizar el renglón de la factura en el listado principal a "pagada" sin recargar la página. |
