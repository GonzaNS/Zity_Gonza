# ADR-016 — Modelo del Tablón de anuncios

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 12 |
| Fecha | Sprint 12, Semana 14 |
| Decisores | Scrum Team Zity |

> Nota de numeración: el artefacto del Sprint 12 llama "ADR-015" a esta decisión; el número
> real es **ADR-016** (el 015 ya lo ocupa [la integración pedido → factura](015-integracion-pedido-factura.md)).

## Contexto

El edificio no tenía un canal de comunicación oficial. La HU-ANUNCIO abre el módulo de
Comunicación: el admin publica comunicados y cada residente los ve al instante en un tablón,
con indicador de no leído. Debíamos resolver:

1. **Quién publica** — solo el admin; residentes y técnicos solo leen (criterio A01 del chore OWASP).
2. **Estado de lectura por residente** sin desincronización (R3 del Sprint).
3. **Vigencia y archivado** — el tablón no debe saturarse con comunicados viejos (R6/R7).
4. **Adjunto** (imagen o PDF) reusando el patrón de Storage del S3/S10.

## Opciones evaluadas

### Modelo del estado de lectura

| Opción | Pros | Contras |
|---|---|---|
| **A · Tabla `anuncio_lecturas` con PK compuesta (anuncio_id, residente_id)** (seleccionada) | Fuente de verdad única; el contador de "no leído" se **recalcula desde BD**, nunca en memoria (R3). Idempotente (upsert `ON CONFLICT DO NOTHING`). | Una fila por (anuncio, residente) que abre el detalle — volumen acotado al condominio. |
| B · Campo `leido_por uuid[]` en `anuncios` | Una sola tabla. | Carreras al actualizar el array; difícil de consultar "no leídos por residente"; viola la normalización. |

### Baja de un anuncio

| Opción | Pros | Contras |
|---|---|---|
| **A · Baja lógica (`archivado=true`), nunca DELETE** (seleccionada) | Conserva el histórico; coherente con `productos.activo` del S10. Sale del tablón pero queda auditable. | Hay que filtrar `archivado=false` en el feed (lo hace la RLS para no-admin). |
| B · DELETE físico | Simple. | Pierde el histórico y rompe `anuncio_lecturas` por cascada. |

### Alcance de lectura por rol

| Opción | Pros | Contras |
|---|---|---|
| **A · SELECT a cualquier autenticado, pero residente/técnico solo ven vigentes y no archivados** (seleccionada) | Cumple A01 (escritura solo admin) y R7 (vencidos/archivados fuera del feed) **en la propia BD**, no solo en la query del cliente. | La política de SELECT evalúa la fecha por fila (igual que `productos.activo`). |
| B · SELECT abierto y filtrar en el cliente | Política trivial. | Un residente podría leer archivados/vencidos vía la API REST directa. |

## Decisión

- **`anuncios`** (`id, titulo, cuerpo, categoria` enum `[aviso·mantenimiento·asamblea·seguridad·general]`,
  `prioridad` enum `[normal·importante·urgente]`, `imagen_url`, `fijado`, `vigente_hasta date`,
  `archivado`, `publicado_por`, `created_at`, `updated_at`). Baja **lógica**.
- **`anuncio_lecturas`** (`anuncio_id`, `residente_id`, `leido_at`) con **PK compuesta**; fuente
  de verdad del badge de no leído.
- **RLS**: `anuncios` SELECT para admin (todo) o cualquier autenticado **solo vigentes y no
  archivados** (`vigente_hasta IS NULL OR >= hoy_lima`); INSERT/UPDATE solo `admin` (A01); sin DELETE.
  `anuncio_lecturas`: cada residente solo la suya (`residente_id = auth.uid()`).
- **Bucket `anuncios-adjuntos`** (privado, `JPEG/PNG/PDF`, 2 MB): admin escribe, lectura
  autenticada con URL firmada — reusa el patrón de `productos-fotos` ([ADR-005](005-storage.md)).
- **Orden del tablón**: los `fijado` arriba, luego por `created_at` desc.
- **Realtime**: `anuncios` y `anuncio_lecturas` se publican en `supabase_realtime`; el feed y el
  badge de no leídos se actualizan en vivo (reusa la conexión única del S6, [ADR-009](009-realtime-notificaciones.md)).

El **aviso** al publicar (notificación + sanitización) se detalla en [ADR-017](017-sanitizacion-y-aviso-realtime.md).

## Consecuencias

### Positivas

- **No-desincronización (R3)** — el contador siempre se deriva de `anuncio_lecturas`.
- **Histórico preservado (R7)** — archivar saca del tablón sin perder el dato.
- **A01 en BD** — la RLS garantiza que solo el admin publica, verificado con test de 3 roles.
- **Cero infraestructura nueva** — reusa Storage (S3/S10), Realtime (S6) y el patrón de baja lógica (S10).

### Negativas

- La política de SELECT evalúa `now()` por fila; es barata para el volumen del condominio pero
  no usa índice de fecha para el caso admin (que ve todo de todas formas).
- El badge requiere publicar `anuncio_lecturas` en Realtime (eventos de inserción de lecturas,
  filtrados por residente vía RLS).

## Variables de entorno

No introduce variables nuevas. Reusa Storage, Realtime y Resend ya configurados.

## Evidencia

- **Migración:** `20260613120000_sprint12_anuncios_tablon.sql`, aplicada a `zity-br`.
- **RLS (A01/R7):** `src/test/admin/rls-anuncios.test.ts` — un residente no puede insertar (42501);
  residente/técnico solo ven vigentes y no archivados; el admin ve todo.
- **E2E:** `e2e/tests/anuncios.spec.ts` — el admin publica "Corte de agua" → la residente lo ve con
  badge 'Nuevo' → al abrirlo queda marcado como leído.
- **no-PII:** `anuncio_lecturas` guarda IDs, no PII (ver [`docs/privacidad/no-pii.md`](../privacidad/no-pii.md)).
