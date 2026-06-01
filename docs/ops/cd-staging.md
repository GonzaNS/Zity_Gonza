# CD a staging (Sprint 10 · chore técnico)

Despliegue continuo a staging: en cada merge a `main`, tras pasar el CI, se hace
build y deploy a Vercel y se verifica `/health`. Cierra el último criterio de
**DoD v2**. Decisión de diseño en [ADR-013](../adr/013-cd-staging.md).

## Cómo funciona

```
push/merge a main
      │
      ▼
  Workflow CI  (lint + typecheck + tests)        .github/workflows/ci.yml
      │  conclusion == success
      ▼
  Workflow Deploy to Staging                     .github/workflows/deploy-staging.yml
      ├─ vercel pull   (config + env vars)
      ├─ vercel build  --prod
      ├─ vercel deploy --prebuilt --prod   → URL del deploy
      └─ GET <url>/health   → debe responder 200 (si no, el run falla)
```

- El deploy **solo** corre si el CI terminó en verde (gate). Si lint o los tests
  fallan, no se publica nada.
- Se dispara solo en `main` (los PRs corren el CI en su rama, no este workflow).
- Si los secrets de Vercel aún **no** están configurados, el deploy se **omite
  limpiamente**: el job queda en verde con los pasos marcados como *skipped* y un
  aviso (`::notice::`), no en rojo. Empieza a desplegar solo en cuanto los cargues.

## Configuración (una vez)

### 1. Secrets de GitHub

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | De dónde sale |
|---|---|
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens → *Create Token*. |
| `VERCEL_ORG_ID` | Ejecuta `vercel link` en local; queda en `.vercel/project.json` como `orgId`. |
| `VERCEL_PROJECT_ID` | Mismo `.vercel/project.json`, campo `projectId`. |

> El `.vercel/` es local y está en `.gitignore`; los IDs se copian a Secrets, no al repo.

### 2. Variables de entorno en Vercel

En **Vercel → Project → Settings → Environment Variables** (entorno *Production*):

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | Build de Vite (cliente). |
| `VITE_SUPABASE_ANON_KEY` | Build de Vite (cliente). |
| `SUPABASE_SERVICE_ROLE_KEY` | La usa la función `/health` (servidor). |

Sin estas, el build o el `/health` fallarán y el deploy quedará en rojo (lo cual
es correcto: no queremos publicar una build mal configurada).

## Verificación manual

```bash
curl -s https://<tu-staging>.vercel.app/health | jq
# → { "status": "ok", "db": "ok", "auth": "ok", "storage": "ok", "version": "…" }
```

`status: ok` y HTTP 200 ⇒ las tres dependencias (DB, Auth, Storage) responden.

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| El deploy no se dispara tras el merge | El workflow `deploy-staging.yml` aún no está en `main`, o el CI falló | `workflow_run` usa el workflow de `main`: mergéalo primero. Revisa que el run de CI esté en verde. |
| `Error: No existing credentials` | Falta `VERCEL_TOKEN` o es inválido | Recrea el token y actualiza el Secret. |
| Build falla con `VITE_SUPABASE_URL is undefined` | Faltan env vars en Vercel | Configúralas en el proyecto (sección anterior). |
| `/health` responde 503 | Falta `SUPABASE_SERVICE_ROLE_KEY` en Vercel o Supabase caído | Revisa la env var y los logs de la función en Vercel. |
| El job de verificación agota los 10 intentos | El dominio tardó en propagar o `/health` está caído | Revisa el deploy en Vercel; reintenta el workflow. |

## Pendiente (chore del Sprint 14)

Smoke tests post-deploy más completos (flujos de UI), además de la verificación
`/health` actual. Antes de mergear el workflow del S14 se aplicará la checklist de
revisión de workflows (Acción 1 del Retro S10).
