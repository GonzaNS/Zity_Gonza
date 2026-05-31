# Endpoint `/health` (Sprint 9 · cierre de DoD v2)

Ruta serverless (Vercel) que verifica el estado de las tres dependencias críticas
del backend de Zity y responde un JSON compacto. Es el **chore técnico del Sprint 9**
y cierra el último criterio _core_ pendiente de la **Definition of Done v2** (abierto
desde el Sprint 4).

## Ubicación

- Función: [`api/health.ts`](../../api/health.ts) — runtime Node de Vercel.
- Expuesta como `/health` mediante el rewrite en [`vercel.json`](../../vercel.json):

  ```json
  { "rewrites": [{ "source": "/health", "destination": "/api/health" }] }
  ```

  El rewrite de `/health` va **antes** del catch-all de la SPA (`/(.*) → /index.html`),
  porque las reglas se evalúan en orden.

## Qué verifica

| Dependencia | Comprobación                                        |
|-------------|-----------------------------------------------------|
| `db`        | `SELECT` mínimo sobre `public.usuarios` (DB viva).  |
| `auth`      | `auth.admin.listUsers` responde (GoTrue operativo). |
| `storage`   | `storage.listBuckets` responde (Storage operativo). |

Usa `SUPABASE_SERVICE_ROLE_KEY` (Sprint 3) — **sin variables nuevas** en el Sprint 9.

## Respuesta

```json
{ "status": "ok", "db": "ok", "auth": "ok", "storage": "ok", "version": "9cab1a4" }
```

- `status`: `ok` solo si las tres dependencias responden; de lo contrario `error`.
- Código HTTP: **200** si todo OK, **503** si alguna dependencia falla.
- `version`: hash corto del commit (`VERCEL_GIT_COMMIT_SHA`) o `0.1.0` en local.

## Seguridad (R6 / OWASP)

- La respuesta **nunca** incluye mensajes de error internos ni secretos: solo
  `ok` | `error` por dependencia.
- Los detalles de cada fallo se registran en los logs del servidor (`console.error`),
  no en el cuerpo de la respuesta.

## Verificación post-deploy

```bash
curl -s https://staging.zity.app/health | jq
# → { "status": "ok", "db": "ok", "auth": "ok", "storage": "ok", "version": "…" }
```

> Sprint 9: el deploy a staging era manual. **Sprint 10:** la verificación
> post-deploy automática (CD en cada merge a `main`) ya está implementada — ver
> [`cd-staging.md`](./cd-staging.md) y [ADR-013](../adr/013-cd-staging.md). Con
> esto se cierra el último criterio de **DoD v2**.
