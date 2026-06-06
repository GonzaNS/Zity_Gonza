# Sanitización de texto publicado — Zity

> **Retro S12 · Acción 2.** Toda entrada de texto que se publique y se renderice a otros
> usuarios (anuncios hoy; comentarios u otros textos en el futuro) pasa por la **misma**
> sanitización en servidor y se renderiza con el **mismo** componente seguro en el cliente.
> Es parte del checklist de revisión de cualquier PBI que publique texto de un usuario a otros.

## Principio: defensa en profundidad

El contenido publicado es el vector de XSS más relevante (lo ve todo el edificio). No confiamos
en una sola capa:

1. **Servidor** — se neutraliza el HTML/script **antes de persistir** (protege incluso ante un
   `INSERT` directo por la API REST, no solo desde el formulario).
2. **Cliente** — se renderiza **sin interpretar HTML crudo** (protege ante contenido legado o
   cualquier otro consumidor del dato).

Ninguna capa "confía" en la otra: ambas asumen que la entrada es hostil.

## Capa 1 — Servidor: `sanitizar_texto_publicado(text)`

Función SQL `IMMUTABLE` (migración `20260613120000_sprint12_anuncios_tablon.sql`). Aplicada por
el trigger `before_anuncio_sanitizar` (BEFORE INSERT/UPDATE) a `anuncios.titulo` y `anuncios.cuerpo`.

Qué hace, en orden:

1. Elimina bloques peligrosos completos: `<script>…</script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`.
2. Elimina cualquier etiqueta HTML residual (`<[^>]*>`).
3. Neutraliza esquemas de URL peligrosos: `javascript:`, `vbscript:`, `data:`.
4. Recorta espacios (`btrim`). El título, además, se colapsa a una sola línea.

```sql
-- Ejemplo (probado en zity-br):
select public.sanitizar_texto_publicado(
  '<script>alert(1)</script>**Aviso** <img src=x onerror=alert(1)> [a](javascript:alert(1))'
);
-- → '**Aviso**  visita [a](alert(1))'   (tags y javascript: fuera; markdown intacto)
```

Es **conservadora**: elimina, no intenta "reparar". Como el cuerpo es markdown (no HTML), no se
pierde nada legítimo. El markdown (`**negrita**`, `[enlace](url)`, listas) se conserva tal cual.

## Capa 2 — Cliente: `MarkdownSeguro`

Componente `src/components/shared/MarkdownSeguro.tsx` (sobre `react-markdown`). Configuración:

| Ajuste | Valor | Por qué |
|---|---|---|
| `skipHtml` | `true` | El HTML crudo se descarta, no se renderiza. |
| `rehype-raw` | **ausente** | Habilitarlo permitiría HTML — jamás se usa. |
| `allowedElements` | `p, br, strong, em, del, code, blockquote, ul, ol, li, a, h3, h4` | Markdown "limitado"; cualquier otro elemento se descarta (se conserva su texto con `unwrapDisallowed`). |
| `urlTransform` | por defecto (`defaultUrlTransform`) | Bloquea `javascript:`/`data:` en `href`/`src`. |
| `components.a` | `target="_blank" rel="noopener noreferrer nofollow"` | Enlaces externos seguros. |

El resultado son **elementos React** (texto escapado por React), nunca `dangerouslySetInnerHTML`
con HTML del usuario.

## Tabla de campos sujetos a esta política

| Campo | Origen | Capa 1 (servidor) | Capa 2 (cliente) |
|---|---|---|---|
| `anuncios.titulo` | Admin | `before_anuncio_sanitizar` (una línea) | Texto plano (sin markdown) |
| `anuncios.cuerpo` | Admin | `before_anuncio_sanitizar` | `MarkdownSeguro` |
| *(futuro)* comentarios | Residente | reusar `sanitizar_texto_publicado` | reusar `MarkdownSeguro` |

## Cómo aplicarlo a un texto publicado nuevo (checklist)

1. ¿El texto lo escribe un usuario y lo ven **otros**? Si sí, aplica esta política.
2. **Servidor:** añade un trigger BEFORE que pase el campo por `sanitizar_texto_publicado()`.
3. **Cliente:** renderiza con `MarkdownSeguro` (o, si es texto plano, deja que React lo escape;
   nunca `dangerouslySetInnerHTML`).
4. **Test:** añade un caso con payload `<script>` y un enlace `javascript:` (ver
   `src/test/anuncios/MarkdownSeguro.test.tsx`).

## Validación de adjuntos (relacionado, R4)

Los adjuntos (`anuncios-adjuntos`) se validan por **tipo y peso en dos lugares**: en el cliente
(`validarAdjunto` en `src/lib/anuncios.ts`) y en el **propio bucket** (`allowed_mime_types` +
`file_size_limit`), de modo que un `upload` directo tampoco acepta un tipo o tamaño no permitido.

Ver también: [ADR-017](../adr/017-sanitizacion-y-aviso-realtime.md), [`owasp-checklist.md`](./owasp-checklist.md).
