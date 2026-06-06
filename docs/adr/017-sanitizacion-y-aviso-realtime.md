# ADR-017 — Sanitización del contenido publicado y aviso Realtime

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 12 |
| Fecha | Sprint 12, Semana 14 |
| Decisores | Scrum Team Zity |

> Nota de numeración: el artefacto del Sprint 12 llama "ADR-016" a esta decisión; el número
> real es **ADR-017** (ver [ADR-016](016-modelo-tablon-anuncios.md)).

## Contexto

El cuerpo de un anuncio es **contenido publicado que ven todos los residentes**, así que es el
vector de XSS más relevante del producto (R1 del Sprint, criterio **A03** del chore OWASP).
Además, publicar debe **avisar** a los residentes reusando el sistema del S6, pero sin generar
spam (R5). Decisiones a cerrar:

1. ¿El cuerpo admite HTML, markdown o solo texto, y cómo se evita el XSS?
2. ¿Dónde se sanitiza: en el cliente, en el servidor, o en ambos?
3. ¿Todos los anuncios notifican o solo los importantes?

## Opciones evaluadas

### Formato del cuerpo y defensa contra XSS

| Opción | Pros | Contras |
|---|---|---|
| **A · Markdown limitado + sanitización en servidor + render seguro en cliente** (seleccionada) | Texto enriquecido útil (negrita, listas, enlaces) con **defensa en profundidad**: el servidor neutraliza HTML antes de guardar y el cliente nunca interpreta HTML crudo. | Dos capas a mantener. |
| B · Solo texto plano | Cero superficie de XSS. | Comunicados pobres (sin enlaces ni énfasis). |
| C · HTML enriquecido (WYSIWYG) | Máxima expresividad. | Superficie de XSS enorme; exige un sanitizador HTML robusto y auditado. |

### Dónde sanitizar

| Opción | Pros | Contras |
|---|---|---|
| **A · Servidor (trigger) + cliente (render)** (seleccionada) | El trigger protege aunque alguien haga un `INSERT` directo por la API REST (no solo desde el form). El render protege aunque entre contenido legado. | Redundante por diseño (intencional). |
| B · Solo cliente | Simple. | Un `INSERT` directo guardaría `<script>` crudo; cualquier otro consumidor lo renderizaría. |

### Política de notificación

| Opción | Pros | Contras |
|---|---|---|
| **A · Solo `importante`/`urgente` notifican; `normal` aparece en el feed sin avisar** (seleccionada) | Evita el spam que haría que los residentes ignoren el aviso (R5). El feed/badge sí reflejan todos. | El admin debe elegir prioridad con criterio. |
| B · Todo notifica | Simple. | Ruido; se debatió y descartó en el Daily 2. |

## Decisión

- **Servidor** — `public.sanitizar_texto_publicado(text)` (`IMMUTABLE`): elimina bloques
  `<script|style|iframe|object|embed>…</…>`, quita cualquier tag `<…>` y neutraliza los esquemas
  `javascript:`/`vbscript:`/`data:`. El trigger `before_anuncio_sanitizar` (BEFORE INSERT/UPDATE)
  la aplica a `titulo` (en una línea) y `cuerpo` **antes de persistir**. Es un patrón reutilizable
  (Retro S12 · Acción 2, ver [`docs/security/sanitizacion.md`](../security/sanitizacion.md)).
- **Cliente** — `MarkdownSeguro` (`react-markdown`): `skipHtml`, **sin** `rehype-raw`,
  `allowedElements` acotado (negrita, cursiva, enlaces, listas, citas, código, h3/h4),
  `urlTransform` por defecto (bloquea `javascript:`), enlaces con `rel="noopener noreferrer nofollow"`
  y `target="_blank"`. El HTML crudo nunca se interpreta.
- **Aviso (reusa S6)** — el trigger `after_anuncio_publicado` (AFTER INSERT) inserta una
  notificación `tipo='anuncio_nuevo'` por **cada residente activo** solo si la prioridad es
  `importante`/`urgente` y el anuncio no está archivado. La campana + badge de la navbar del S6
  reaccionan sin cambios. Best-effort (`EXCEPTION WHEN others`): un fallo de notificación nunca
  revierte la publicación (convención §4).

## Consecuencias

### Positivas

- **A03 cubierto en dos capas** — un `INSERT` directo con `<script>` se guarda neutralizado y,
  aun así, el render no lo ejecutaría.
- **Patrón reutilizable** — `sanitizar_texto_publicado` servirá a comentarios u otros textos
  publicados futuros (Retro S12 · Acción 2).
- **Sin spam (R5)** — solo lo importante interrumpe; lo normal vive en el feed.
- **Cero infraestructura** — el aviso reusa la tabla `notificaciones` y el canal Realtime del S6.

### Negativas

- `react-markdown` suma ~35 kB gzip, aislados en un chunk lazy que solo cargan las páginas de
  anuncios (no afecta el bundle inicial; se vigilará en el Lighthouse del S13).
- La sanitización por regex en SQL es conservadora (elimina, no "repara") — un cuerpo con HTML
  pierde ese fragmento. Aceptable: el cuerpo es markdown, no HTML.

## Variables de entorno

No introduce variables nuevas.

## Evidencia

- **Migración:** `20260613120000_sprint12_anuncios_tablon.sql` (función + triggers), aplicada a `zity-br`.
- **Sanitización servidor:** prueba en `zity-br` — `sanitizar_texto_publicado('<script>alert(1)</script>**Aviso** <img src=x onerror=alert(1)> [a](javascript:alert(1))')`
  → `**Aviso**  visita [a](alert(1))` (tags y `javascript:` neutralizados; markdown intacto).
- **Render seguro (A03):** `src/test/anuncios/MarkdownSeguro.test.tsx` — `<script>`/`<img onerror>` no
  llegan al DOM; un enlace `javascript:` queda con `href` vacío.
- **Aviso sin spam (R5):** el trigger solo notifica `importante`/`urgente`; los `normal` no insertan
  notificación (verificado en la demo del Daily 2).
- **Checklist OWASP:** [`docs/security/owasp-checklist.md`](../security/owasp-checklist.md).
