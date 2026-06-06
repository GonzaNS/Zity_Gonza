# Cómo ver lo implementado del Sprint 12

Guía sencilla — en palabras simples — para ver con tus propios ojos cada feature del
Sprint 12 (**"Módulo de Comunicación — Tablón de anuncios del edificio"**). Pensada para
validar la entrega sin leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido**](#el-recorrido) y mira los pasos 1–3.

---

## ¿Qué te entregó el Sprint 12?

El Sprint 11 cerró la **Tienda**. El Sprint 12 abre un **dominio nuevo, la Comunicación**, con
el **Tablón de anuncios del edificio** (Epic COMU-01), y mantiene la **DoD v3** sumándole un
criterio de seguridad:

- **Tablón de anuncios**: el **admin publica comunicados** desde `/admin/anuncios` (categoría,
  prioridad, imagen o PDF opcional, opción de **fijar** y de darles **vigencia**) y cada
  **residente los ve al instante** en su tablón (`/residente/anuncios`), con **indicador de no
  leído** y la posibilidad de **marcarlos como leídos**.
- **Chore OWASP Top 10 (DoD v3)**: endurecimiento de seguridad con foco en **A01** (control de
  acceso), **A03** (sanitización / XSS) y **A05** (configuración). Ver
  [`docs/security/owasp-checklist.md`](../security/owasp-checklist.md).
- **Buffer — PBI-S9-E02**: el recordatorio de factura ahora también sale **el día del
  vencimiento** (además de los 3 días antes).

---

## Antes de empezar

```bash
npm install
npm run seed           # usuarios base + facturas + 4 anuncios demo del tablón
npm run dev            # http://localhost:5173
```

Credenciales demo: **Admin** `carlos@zity-demo.com` / `Admin1234!` ·
**Residente** `laura@zity-demo.com` / `Residente1!` ·
**Técnico** `mario@zity-demo.com` / `Tecnico1234!`. El resto del elenco usa **`Demo1234!`**.

> [!IMPORTANT]
> Las migraciones del Sprint 12 deben estar aplicadas en Supabase (ya lo están en `zity-br`):
> `20260613120000_sprint12_anuncios_tablon.sql` (tablón + sanitización + aviso Realtime) y
> `20260613120100_sprint12_recordatorio_dia_vencimiento.sql` (buffer del recordatorio).

> [!TIP]
> Para los pasos 2 y 3 vale la pena tener **dos navegadores abiertos a la vez**: uno como
> **admin** (Carlos) y otro como **residente** (Laura, ya en `/residente/anuncios`). Así ves
> aparecer el anuncio **en vivo**, sin recargar.

---

## El recorrido

### 1. Carlos publica el primer comunicado y lo fija (`/admin/anuncios`)

1. Login como **admin** (Carlos) → en el menú lateral, **"Anuncios"**.
2. Botón **"Publicar"** → completa el formulario: título **"Corte de agua programado"**,
   **categoría** `mantenimiento`, **prioridad** `importante`, el cuerpo del mensaje y, si
   quieres, una **imagen** (JPEG/PNG, máx. 2 MB). Marca **"Fijar"** y dale **vigencia** si
   aplica → **Publicar**.
3. El anuncio aparece al instante en la tabla; al estar **fijado** se muestra **destacado
   arriba** 📌.

### 2. Laura lo ve aparecer al instante — Realtime (`/residente/anuncios`)

1. En el otro navegador, login como **residente** (Laura) → en el header, **"Anuncios"**.
2. Sin recargar, el anuncio **"Corte de agua programado"** **aparece solo** (Realtime) con el
   badge **"Nuevo"**.
3. Como su prioridad es **importante**, la **campana** de la navbar 🔔 **suma 1** al contador de
   no leídos.

### 3. Laura abre el anuncio y lo marca como leído

1. Click en el anuncio → se abre el **detalle**: ve la **imagen** y el cuerpo del mensaje.
2. Al leerlo, el badge **"Nuevo"** **desaparece** y el **contador de no leídos** de la campana 🔔
   **baja en 1**.

### 4. Un segundo comunicado con PDF, y el filtro por categoría

1. Vuelve como **admin** → **"Publicar"** un segundo anuncio: **"Asamblea general"**, **categoría**
   `asamblea`, **prioridad** `urgente`, con un **PDF adjunto** → **Publicar**.
2. Del lado de **Laura**, el segundo anuncio aparece también al instante (y vuelve a sumar a la
   campana, por ser urgente).
3. Laura **filtra el tablón por categoría** `mantenimiento`: queda solo el **"Corte de agua"**
   (fijado, destacado arriba); la **"Asamblea general"** se oculta hasta limpiar el filtro.

### 5. Control de acceso — solo el admin publica (OWASP A01)

1. Como **residente**, en `/residente/anuncios` **no existe el botón "Publicar"**: el residente
   solo **lee**.
2. Aunque alguien intente **publicar directamente** como residente (saltándose la interfaz), la
   **RLS lo rechaza**: la inserción en `anuncios` está restringida al rol **admin**.

### 6. Sanitización del contenido — XSS neutralizado (OWASP A03)

1. Como **admin**, publica un anuncio cuyo cuerpo incluya un `<script>…</script>` (o etiquetas
   HTML).
2. En el tablón del residente el contenido se **renderiza como texto** (lo ves escrito tal cual):
   **no se ejecuta nada**. El saneo ocurre **en el servidor** al guardar y, además, el cliente
   **no interpreta HTML crudo**.

### 7. Buffer — el recordatorio "vence hoy" (PBI-S9-E02)

```bash
npm run seed:tiempo
```

Reposiciona de forma **reproducible** una factura demo con **vencimiento = hoy** (zona
America/Lima). Al correr el **job diario** `marcar_facturas_vencidas_y_recordatorios()`, emite el
recordatorio **"vence hoy"** (notificación 🔔 + email) **además** del de "vence en 3 días". El
campo del resultado del job que lo reporta es **`recordatorios_hoy`**.

---

## Lo que pasa por dentro

- **Modelo del tablón**: tablas `anuncios` y `anuncio_lecturas` (esta última con **PK
  compuesta** `anuncio_id + residente_id`), con **RLS por rol** (solo el **admin** inserta; el
  residente lee y marca su propia lectura). Migración
  `20260613120000_sprint12_anuncios_tablon.sql`. ([ADR-016](../adr/016-modelo-tablon-anuncios.md))
- **Sanitización (A03)**: en el **servidor**, la función `sanitizar_texto_publicado()` con el
  trigger `before_anuncio_sanitizar` limpia el contenido al guardar. En el **cliente**, el render
  seguro lo hace el componente `MarkdownSeguro` (react-markdown **sin HTML crudo**).
  ([ADR-017](../adr/017-sanitizacion-y-aviso-realtime.md))
- **Aviso Realtime**: el trigger `after_anuncio_publicado` inserta una notificación
  `anuncio_nuevo` **por residente**, pero **solo si la prioridad es importante o urgente**
  (reusa el sistema de notificaciones del S6). El **badge de no leídos** se **recalcula desde la
  BD**, no se adivina en el front. ([ADR-017](../adr/017-sanitizacion-y-aviso-realtime.md))
- **Adjuntos (A05)**: bucket `anuncios-adjuntos` **privado** (acepta JPEG/PNG/PDF, máx. 2 MB),
  servido con **URLs firmadas** (sin acceso público directo).
- **Buffer (PBI-S9-E02)**: nueva columna `facturas.recordatorio_vencimiento_enviado` y una
  **Pasada 2b** dentro de `marcar_facturas_vencidas_y_recordatorios()` que emite el recordatorio
  del **día del vencimiento** (idempotente, no reenvía).
- **Seguridad (OWASP Top 10)**: el chore cubre **A01** (control de acceso vía RLS), **A03**
  (sanitización/XSS) y **A05** (configuración: storage privado, URLs firmadas). Detalle en
  [`docs/security/owasp-checklist.md`](../security/owasp-checklist.md).
