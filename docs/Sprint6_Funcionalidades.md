# Sprint 6 — Comunicación en tiempo real (guía sencilla)

Esta guía explica, en lenguaje simple, **qué se construyó en el Sprint 6** y
**cómo verlo funcionando en la página web**.

> **Tema del sprint:** que las personas se enteren al instante de lo que pasa con
> sus solicitudes, sin tener que recargar la página.

## Cómo entrar a probar

- **App local:** `npm run dev` → abre `http://localhost:5173`
- **App publicada:** `https://zity.site`
- **Usuarios de prueba** (si se corrió el seed de datos demo):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `carlos@zity-demo.com` | `Admin1234!` |
| Residente | `laura@zity-demo.com` | `Residente1!` |
| Técnico | `mario@zity-demo.com` | `Tecnico1234!` |

> Para ver las notificaciones en vivo conviene abrir **dos navegadores** (o uno
> normal y otro en incógnito): por ejemplo, el admin en uno y la residente Laura
> en el otro.

---

## 1. Campana de notificaciones 🔔

**Qué es:** un ícono de campana en la barra superior (en los paneles de admin,
residente y técnico). Muestra un globo rojo con el número de notificaciones sin
leer y, al hacer clic, abre una lista con las últimas 10.

**Cómo verlo:**
1. Inicia sesión con cualquier usuario.
2. Mira la **campana** arriba a la derecha (en el panel de admin está abajo, junto
   a tu nombre).
3. Haz clic: se abre el menú con tus notificaciones más recientes.
4. Haz clic en una notificación → te lleva directo a la solicitud y la marca como
   leída.

**Detalles:** el número llega hasta `99+`, se puede cerrar con la tecla **Esc**, y
en el celular el menú ocupa todo el ancho de la pantalla.

## 2. Notificaciones en tiempo real ⚡

**Qué es:** cuando cambia el estado de una solicitud, la persona correcta recibe
la notificación **al instante**, sin recargar:
- El **residente** se entera cuando avanza su solicitud.
- El **técnico** se entera cuando le asignan una solicitud.
- Los **administradores** se enteran cuando un residente rechaza una solución.

**Cómo verlo (con dos navegadores):**
1. En un navegador entra como **admin** (Carlos) y abre **Solicitudes**.
2. En otro navegador entra como **residente** (Laura).
3. Con el admin, abre una solicitud de Laura y **asigna un técnico** o cambia su
   estado.
4. En el navegador de Laura, **sin recargar**, aparece la campana con un nuevo
   aviso en uno o dos segundos.

## 3. Centro de notificaciones 📋

**Qué es:** una página completa (`/notificaciones`) con **todo** tu historial de
avisos, filtros y paginación.

**Cómo verlo:**
1. Haz clic en la campana → **"Ver todas"** (o entra a `/notificaciones`).
2. Filtra por **Todas / No leídas / Leídas** o por **rango de fechas**.
3. Si hay muchas, usa los botones **Anterior / Siguiente** (25 por página).

## 4. Marcar como leídas ✓

**Qué es:** puedes marcar una notificación o todas como leídas; el contador baja
al instante.

**Cómo verlo:**
1. En `/notificaciones`, usa **"Marcar como leída"** en una fila.
2. O usa **"Marcar todas como leídas"** arriba: aparece una **ventana de
   confirmación** ("Esto marcará N notificaciones…") antes de hacerlo.
3. Si algo falla, sale un aviso (toast) y el cambio se revierte.

## 5. Email simulado de cambio de estado ✉️

**Qué es:** además del aviso en pantalla, el sistema prepara un correo de
notificación. Por defecto está en **modo simulación (dry-run)**: en lugar de
enviarlo, lo registra en los logs (así no se gastan envíos reales en pruebas).

**Cómo verlo:** en los **logs de la Edge Function** `notificar-cambio-estado` de
Supabase aparece el correo que *se habría enviado* cada vez que cambia un estado.
Para envíos reales solo hace falta configurar la clave de Resend (ver más abajo).

## 6. Foto de cierre del técnico (antes / después) 📷

**Qué es:** al marcar una solicitud como **resuelta**, el técnico puede adjuntar
una foto del trabajo terminado. En el detalle se ven dos fotos lado a lado:
**Antes** (la que subió el residente) y **Después** (la del técnico).

**Cómo verlo:**
1. Entra como **técnico** (Mario), abre una solicitud asignada y ponla **"En
   progreso"** y luego **"Resuelta"**.
2. Al resolver, aparece **"Foto de cierre (opcional)"**: sube una imagen.
3. Entra como el **residente** dueño de esa solicitud y ábrela: verás **Antes** y
   **Después** juntas (en el celular se ven una arriba de la otra).

## 7. Aviso al administrador cuando rechazan una solución 🟠

**Qué es:** si un residente rechaza la solución del técnico, **todos los
administradores** reciben una alerta inmediata (con ícono naranja), desde el
primer rechazo.

**Cómo verlo (dos navegadores):**
1. Como **residente**, en "Pendientes de tu confirmación", **rechaza** una
   solución resuelta.
2. Como **admin**, sin recargar, llega la alerta naranja. Al hacer clic, se abre
   directamente esa solicitud en `/admin/solicitudes`.

## 8. Botón "Ver auditoría" en la solicitud 🔍

**Qué es:** dentro del detalle de una solicitud (vista admin) hay un enlace **"Ver
auditoría"** que abre el historial de acciones ya filtrado por esa solicitud.

**Cómo verlo:**
1. Entra como **admin** → **Solicitudes** → abre una solicitud.
2. En "Historial de estados" verás **"Ver auditoría"** (solo aparece si esa
   solicitud tiene acciones registradas; al pasar el mouse muestra cuántas).
3. Al hacer clic, se abre `/admin/auditoria` mostrando solo esa solicitud. El
   enlace es **compartible** (puedes pegarlo en otra pestaña).

## 9. Cambio de contraseña desde el perfil 🔒

**Qué es:** cada usuario puede cambiar su contraseña sin pasar por el correo de
recuperación, de forma segura.

**Cómo verlo:**
1. Entra con cualquier usuario → **Mi perfil** → pestaña **Seguridad**.
2. Escribe tu contraseña actual, la nueva (mínimo 8 caracteres **y al menos un
   número**, y distinta a la actual) y confírmala.
3. Si te equivocas 3 veces en la actual, el formulario se bloquea 5 minutos con
   una **cuenta regresiva** visible.
4. Al cambiarla **sigues con la sesión abierta**; la contraseña vieja deja de
   funcionar en el próximo inicio de sesión.

---

## Para enviar correos de verdad (opcional)

El email funciona en **modo simulación** sin configurar nada. Si se quiere enviar
correos reales, hay que definir estas variables (en Supabase / GitHub / Vercel):

- `RESEND_API_KEY` — la clave de la cuenta de Resend.
- `RESEND_FROM_ADDRESS` — el remitente (por defecto `no-reply@zity.local`); debe
  pertenecer a un dominio verificado en Resend.

## Datos de demostración

Para llenar la app de notificaciones de ejemplo:

```bash
npm run seed -- --notify
```

Esto crea 10 notificaciones por cada residente de prueba.
