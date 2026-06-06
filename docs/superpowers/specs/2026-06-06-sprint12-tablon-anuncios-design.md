# Sprint 12 — Comunicación · Tablón de anuncios + Chore OWASP · Design / Spec

> Estado: **Aprobado** (2026-06-06) · Deriva de `docs/sprints/Zity_Sprint12_Artefactos.pdf`
> Abre el **módulo de Comunicación**. Segunda aplicación de **DoD v3** (suma el criterio
> de seguridad: checklist OWASP top 10 con foco en A01/A03/A05).

## 1. Contexto

El edificio no tiene un canal oficial de comunicación. El S12 entrega un **tablón de
anuncios**: el admin publica comunicados (categoría, prioridad, imagen/PDF opcional, con
opción de fijar y darles vigencia) y cada residente los ve al instante en un tablón, con
indicador de no leído y la posibilidad de marcarlos como leídos. En paralelo, el chore
OWASP cubre el criterio de seguridad de DoD v3 (control de acceso + sanitización del
contenido publicado). Se absorbe **PBI-S9-E02** (recordatorio de factura también el día
del vencimiento) con el buffer.

Estado real verificado en `zity-br` (Postgres 17) al iniciar:
- Migraciones aplicadas hasta `sprint11_facturar_pedidos` (33 migraciones).
- No existen `anuncios` ni `anuncio_lecturas` (terreno limpio).
- 27 usuarios, 78 notificaciones, 1171 facturas, 7 productos.
- Reusa: Realtime/notificaciones (S6), Storage privado + URLs firmadas (S3/S10),
  audit por trigger (S5/S10), cron de facturas (S9).

## 2. Decisiones tomadas (incluye respuestas del usuario)

| Tema | Decisión |
|---|---|
| Aplicación BD | Migraciones aditivas aplicadas a `zity-br` vía MCP **y** versionadas en `supabase/migrations/`. |
| Markdown | **`react-markdown`** (nueva dependencia) + sanitización en servidor (trigger). Render seguro sin `rehype-raw`. |
| Verificación | Tests automatizados (typecheck/lint/build + vitest + Playwright) **+** verificación del guión de demo en navegador (Playwright MCP). |
| Numeración ADR | **ADR-016** (modelo del tablón) + **ADR-017** (sanitización + aviso Realtime). El PDF los llama 015/016; ya existen hasta el 015. |
| Numeración migración | Timestamp + comentario "Migración 013 (nominal)" (patrón del repo). |
| Docs de seguridad | En `docs/security/` (carpeta existente), con los nombres del PDF: `owasp-checklist.md`, `sanitizacion.md`. |
| `imagen_url` | Se mantiene el nombre del PDF aunque almacene también PDFs; se detecta `.pdf` por extensión al renderizar. |
| Técnicos | La RLS les permite **leer** (cubre el test de 3 roles); sin UI de tablón ni notificación (el PDF solo pide `/admin` y `/residente`). |
| Notificación de campana | Solo a **residentes**, y solo prioridad `importante`/`urgente` (evita spam). |
| Navegación residente | Se extrae un **`ResidenteHeader`** compartido (hoy duplicado inline en 4 páginas) para alojar el link "Anuncios" + badge. |

## 3. Capa de base de datos (2 migraciones, aplicadas a zity-br + versionadas)

### 3.1 `sprint12_anuncios_tablon` (HU-ANUNCIO-01)
Sigue el patrón de `sprint10_tienda.sql`.

- **Enums** (idempotentes con `DO $$ … duplicate_object`):
  - `anuncio_categoria` AS ENUM (`aviso`, `mantenimiento`, `asamblea`, `seguridad`, `general`).
  - `anuncio_prioridad` AS ENUM (`normal`, `importante`, `urgente`).
- **`public.anuncios`**: `id uuid PK`, `titulo text NOT NULL CHECK(len(trim)>0)`,
  `cuerpo text NOT NULL CHECK(len(trim)>0)`, `categoria anuncio_categoria NOT NULL DEFAULT 'general'`,
  `prioridad anuncio_prioridad NOT NULL DEFAULT 'normal'`, `imagen_url text` (path en bucket;
  imagen o PDF), `fijado boolean NOT NULL DEFAULT false`, `vigente_hasta date` (NULL = sin
  caducidad), `archivado boolean NOT NULL DEFAULT false`, `publicado_por uuid REFERENCES
  usuarios(id) ON DELETE SET NULL`, `created_at timestamptz DEFAULT now()`, `updated_at`.
  Baja **lógica** (`archivado`), nunca DELETE.
- **`public.anuncio_lecturas`**: `anuncio_id uuid REFERENCES anuncios(id) ON DELETE CASCADE`,
  `residente_id uuid REFERENCES usuarios(id) ON DELETE CASCADE`, `leido_at timestamptz
  DEFAULT now()`, **PK compuesta (anuncio_id, residente_id)**. Fuente de verdad del "no leído".
- **Índices**: `anuncios (archivado, vigente_hasta)`, `anuncios (fijado, created_at desc)`,
  `anuncio_lecturas (residente_id)`.
- **RLS** (cada política con test de 3 roles):
  - `anuncios_select`: `USING (admin OR (archivado=false AND (vigente_hasta IS NULL OR
    vigente_hasta >= hoy_lima)))` — residente/técnico solo ven vigentes y no archivados.
  - `anuncios_admin_insert` / `anuncios_admin_update`: `WITH CHECK (get_user_rol()='admin')`. Sin DELETE.
  - `anuncio_lecturas_select` / `_insert`: `residente_id = auth.uid()` (cada quien la suya).
- **Triggers**:
  - `anuncios_set_updated_at` BEFORE UPDATE (reusa `public.set_updated_at` del S8).
  - `before_anuncio_sanitizar` BEFORE INSERT/UPDATE → `sanitizar_texto_publicado()` (§4).
  - `after_anuncio_publicado` AFTER INSERT → notificación `anuncio_nuevo` por residente si
    `prioridad ∈ {importante,urgente}` y no archivado (best-effort, §6).
  - `after_anuncio_cambio` AFTER INSERT/UPDATE → auditoría (`crear_anuncio`, `editar_anuncio`,
    `archivar_anuncio`), patrón `log_producto_cambio`. Best-effort.
- **Catálogos / dominios**:
  - `audit_acciones` += `crear_anuncio`, `editar_anuncio`, `archivar_anuncio`.
  - `notificaciones_tipo_check` += `anuncio_nuevo` (patrón "drop + recreate" del S9 Parte D).
  - `ALTER PUBLICATION supabase_realtime ADD TABLE public.anuncios` (feed/badge en vivo).
- **Bucket `anuncios-adjuntos`** (igual a `productos-fotos` + PDF):
  `INSERT INTO storage.buckets (… public=false, file_size_limit=2097152,
  allowed_mime_types=ARRAY['image/jpeg','image/png','application/pdf'])`.
  Políticas: admin INSERT/UPDATE/DELETE; SELECT authenticated.

### 3.2 `sprint12_recordatorio_dia_vencimiento` (Buffer PBI-S9-E02)
- `ALTER TABLE facturas ADD COLUMN recordatorio_vencimiento_enviado boolean NOT NULL DEFAULT false`.
- `CREATE OR REPLACE marcar_facturas_vencidas_y_recordatorios()` + **Pasada 2b**:
  `WHERE estado='pendiente' AND vencimiento = v_hoy AND recordatorio_vencimiento_enviado=false`
  → notificación "vence hoy" + email (pasa `dias_restantes=0`); marca la columna. Idempotente.
- Devuelve `recordatorios_hoy` además de `vencidas`/`recordatorios`.

## 4. Sanitización del contenido — Chore OWASP A03 (defensa en profundidad)

- **Servidor** (`sanitizar_texto_publicado(text) RETURNS text`, `IMMUTABLE`):
  elimina tags HTML (`regexp_replace(txt,'<[^>]*>','','g')`), neutraliza `javascript:`/`data:`/
  `vbscript:` (case-insensitive), colapsa espacios de control. Trigger
  `before_anuncio_sanitizar` la aplica a `titulo` (además se recorta a una línea) y `cuerpo`.
  Es el patrón reutilizable de la **Acción 2 del Retro** (`docs/security/sanitizacion.md`).
- **Cliente** (`MarkdownSeguro`, react-markdown): `skipHtml` ON, **sin** `rehype-raw`,
  `allowedElements=['p','br','strong','em','del','code','blockquote','ul','ol','li','a','h3','h4']`,
  `unwrapDisallowed`, `urlTransform` por defecto (bloquea `javascript:`),
  `components.a` con `target=_blank rel="noopener noreferrer nofollow"`.

## 5. Capa de frontend

- **`src/lib/anuncios.ts`** (puro, coverage ≥ 60%): tipos (`Anuncio`, `AnuncioLectura`,
  `AnuncioCategoria`, `AnuncioPrioridad`), constantes (`ANUNCIOS_BUCKET`,
  `ANUNCIO_ADJUNTO_MIME_PERMITIDOS` [+pdf], `ANUNCIO_ADJUNTO_MAX_BYTES=2MB`, labels/colores
  por categoría y prioridad), helpers `pathAdjuntoAnuncio`, `validarAdjunto`, `esPdf`,
  `extracto`, `estaVigente`, `ordenarFeed` (fijados → fecha desc).
- **Hooks**: `useAnunciosAdmin` (CRUD + firma adjuntos, patrón `useTiendaAdmin`),
  `useAnunciosResidente` (feed + lecturas + Realtime + `marcarLeido`),
  `useAnunciosNoLeidos` (conteo del badge, recalculado desde BD, Realtime).
- **Páginas**: `pages/admin/Anuncios.tsx` (listado vigentes+archivados + `AnuncioFormModal`),
  `pages/residente/Anuncios.tsx` (feed + filtro por categoría + detalle).
- **Componentes**: `admin/anuncios/AnuncioFormModal` (título, cuerpo markdown con preview,
  categoría, prioridad, `UploadAdjunto`, fijar, vigencia), `admin/anuncios/TablaAnuncios`,
  `admin/anuncios/UploadAdjunto` (img/PDF con preview), `residente/anuncios/CardAnuncio`,
  `residente/anuncios/DrawerAnuncio` (abrir = marcar leído), `shared/MarkdownSeguro`,
  `residente/ResidenteHeader` (refactor compartido + link "Anuncios" + badge).
- **Routing** (`App.tsx`): `/admin/anuncios` (admin), `/residente/anuncios` (residente).
- **Navbar admin** (`AdminShell`): item "Anuncios".

## 6. Aviso Realtime + badge — HU-ANUNCIO-04

- **Campana (reusa S6):** `after_anuncio_publicado` inserta `notificaciones.tipo='anuncio_nuevo'`
  por residente solo si prioridad importante/urgente. El canal `notificaciones:{uid}` del S6
  la propaga sin cambios en el cliente.
- **Badge "Anuncios no leídos":** `useAnunciosNoLeidos` cuenta vigentes-no-leídos **desde BD**
  (R3) y se suscribe al canal Realtime de `anuncios` para subir/bajar en vivo (cubre normales).
  Baja al marcar leído.

## 7. Tests (DoD v3)

- `src/test/admin/rls-anuncios.test.ts` — 3 roles (admin publica; residente/técnico solo leen;
  residente no inserta anuncios; cada quien su lectura).
- `src/test/anuncios/anuncios-helpers.test.ts` — helpers puros.
- `src/test/anuncios/MarkdownSeguro.test.tsx` — payload `<script>` y `javascript:` neutralizados (A03).
- Ampliar `src/test/admin/facturas-cron.test.ts` — Pasada 2b (recordatorio el día del vencimiento).
- E2E `e2e/tests/anuncios.spec.ts` — admin publica → residente ve en el feed → marca leído.

## 8. Documentación

- `docs/adr/016-modelo-tablon-anuncios.md`, `docs/adr/017-sanitizacion-y-aviso-realtime.md`.
- `docs/security/owasp-checklist.md` (chore A01/A03/A05), `docs/security/sanitizacion.md` (Acción 2 Retro).
- `docs/conventions.md`: sección "Política de notificaciones" + entidad **Anuncio** en §10 (ciclos de vida).
- `docs/storage.md`: bucket `anuncios-adjuntos`.
- `docs/sprints/Sprint12_Como_Verlo.md`, `README.md` (+módulo Comunicación).
- Seed demo: 3-4 anuncios de ejemplo (en `scripts/seed.js` o seed dedicado) para no mostrar el tablón vacío.

## 9. Verificación final

`npm run typecheck && npm run lint && npm run build && npm run test:run && npm run test:e2e`,
`get_advisors` (security/performance) en zity-br, y verificación en navegador del guión de
demo: admin publica "Corte de agua" (mantenimiento, importante, imagen, fijado) → Laura lo
ve en vivo con badge "Nuevo" + campana → abre y el badge baja → intento de `<script>` queda
neutralizado (A01/A03).

## 10. Riesgos (del PDF) y mitigación

- **R1 XSS** → sanitización servidor + render seguro + test con `<script>`.
- **R2 RLS falla** → solo admin INSERT/UPDATE; test de 3 roles (A01).
- **R3 badge desincronizado** → `anuncio_lecturas` es la verdad; conteo recalculado desde BD.
- **R4 adjunto sin validar** → validación tipo/peso (JPEG/PNG/PDF ≤ 2 MB), reusa patrón S3.
- **R5 spam** → solo importante/urgente notifican.
- **R6 urgente perdido** → fijados + urgentes destacados arriba.
- **R7 vencidos saturan** → `vigente_hasta` + archivado; el feed solo muestra vigentes.
