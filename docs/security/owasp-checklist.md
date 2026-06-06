# Checklist OWASP Top 10 — Endpoints de Anuncios (Sprint 12)

> **Chore técnico del Sprint 12.** Cumple el **criterio de seguridad de DoD v3**.
> Aplica la checklist OWASP Top 10 (2021) a los endpoints del módulo Comunicación
> (tablón de anuncios), con foco en **A01** (control de acceso), **A03** (inyección/XSS)
> y **A05** (configuración). Complementa el panorama general en [`checklist.md`](./checklist.md).

Los "endpoints" de anuncios son las operaciones sobre `public.anuncios`, `public.anuncio_lecturas`
y el bucket `anuncios-adjuntos`, expuestas vía PostgREST/Storage y gobernadas por RLS.

## Resumen

| ID | Control | Estado | Dónde |
|---|---|---|---|
| **A01** | Broken Access Control | ✅ Cubierto | RLS: solo admin publica; lectura por rol |
| **A02** | Cryptographic Failures | ✅ Heredado | TLS + JWT de Supabase Auth |
| **A03** | Injection (XSS) | ✅ Cubierto | Sanitización en servidor + render seguro |
| **A04** | Insecure Design | ✅ Cubierto | Baja lógica, vigencia, idempotencia de lectura |
| **A05** | Security Misconfiguration | ✅ Cubierto | Bucket privado, `search_path` fijo, REVOKE |
| **A06** | Vulnerable Components | ✅ Revisado | `npm audit` = 0 vulnerabilidades |
| **A07** | Identification & Auth | ✅ Heredado | Supabase Auth (S2/S4) |
| **A08** | Software & Data Integrity | ✅ Cubierto | Triggers `SECURITY DEFINER`, validación de tipo de adjunto |
| **A09** | Logging & Monitoring | ✅ Parcial | `audit_log` de alta/edición/archivado |
| **A10** | SSRF | ✅ N/A | Sin fetch de URLs provistas por el usuario |

## A01 · Broken Access Control (foco — control de acceso)

**Riesgo (R2):** un residente o técnico podría publicar o editar anuncios si la RLS falla.

- `anuncios` **INSERT/UPDATE** solo para `get_user_rol() = 'admin'`; **sin** política de DELETE
  (la baja es lógica). Residente y técnico **no** tienen política de escritura → denegado.
- `anuncios` **SELECT**: el admin ve todo; residente/técnico solo **vigentes y no archivados**
  (no pueden leer borradores vencidos ni archivados por la API directa).
- `anuncio_lecturas`: cada residente solo **la suya** (`residente_id = auth.uid()` en USING y WITH CHECK);
  no puede registrar ni leer la lectura de otro.
- El frontend **no** decide el acceso: el botón "Publicar" solo se muestra al admin, pero la
  garantía real es la RLS (un `INSERT` directo de un residente es rechazado con `42501`).

**Verificación:** `src/test/admin/rls-anuncios.test.ts` (3 roles) + intento real en `zity-br`.

## A03 · Injection / Cross-Site Scripting (foco — sanitización)

**Riesgo (R1):** el cuerpo de un anuncio podría incluir HTML/script malicioso visible para todos.

Defensa en profundidad (ver [ADR-017](../adr/017-sanitizacion-y-aviso-realtime.md)):

1. **Servidor (antes de guardar):** trigger `before_anuncio_sanitizar` → `sanitizar_texto_publicado()`
   elimina tags HTML y bloques `<script>`/`<iframe>`/etc., y neutraliza `javascript:`/`data:`/`vbscript:`.
2. **Cliente (al renderizar):** `MarkdownSeguro` con `skipHtml`, **sin** `rehype-raw`, lista de
   elementos permitida y `urlTransform` que bloquea esquemas peligrosos. El HTML crudo nunca se interpreta.
3. **SQL parametrizado:** todo acceso usa el cliente de Supabase (consultas parametrizadas);
   las funciones `SECURITY DEFINER` fijan `search_path` (sin inyección de catálogo).

**Verificación:** prueba SQL de `sanitizar_texto_publicado` + `src/test/anuncios/MarkdownSeguro.test.tsx`
(payload `<script>` y enlace `javascript:` neutralizados).

## A05 · Security Misconfiguration (foco — configuración)

- **Bucket `anuncios-adjuntos` privado** (`public=false`): nada es accesible sin URL firmada (1 h).
- **`allowed_mime_types`** restringido a `image/jpeg, image/png, application/pdf` y
  `file_size_limit = 2 MB` **en el propio bucket** (no solo validación de cliente, R4).
- **Funciones de trigger** `SECURITY DEFINER` con `SET search_path` y `REVOKE ALL … FROM anon,
  authenticated, public` (solo las invoca el trigger).
- **Sin secretos nuevos**: el módulo reusa la configuración existente; nada sensible en el código.

## Otros controles (cobertura estándar)

- **A04 Insecure Design** — baja lógica (no DELETE), `vigente_hasta` para expirar, lectura
  idempotente (`ON CONFLICT DO NOTHING`); el contador se recalcula desde BD (R3).
- **A06 Vulnerable Components** — `npm audit` sin vulnerabilidades tras añadir `react-markdown`.
- **A08 Integrity** — el adjunto valida tipo/peso en cliente **y** en el bucket; la auditoría la
  escribe un trigger, no el cliente.
- **A09 Logging** — `audit_log` registra `crear_anuncio`/`editar_anuncio`/`archivar_anuncio` con
  solo IDs (no-PII). Alertas activas: fuera de alcance (como el resto del proyecto).

## Pendiente / fuera de alcance

- **Rate limiting** de publicación: no aplica (un único admin de confianza).
- **CSP a nivel de cabeceras** (defensa adicional de A03): candidato para el hardening de la
  Release Candidate (S14).
