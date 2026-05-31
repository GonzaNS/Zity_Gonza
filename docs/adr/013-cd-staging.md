# ADR-013 — CD a staging (deploy automático en merge a main)

| Campo | Valor |
|---|---|
| Estado | Aprobado — Sprint 10 |
| Fecha | Sprint 10, Semana 12 |
| Decisores | Scrum Team Zity |

## Contexto

Desde el Sprint 8 arrastrábamos la deuda de "deploy automático": cada cambio en `main` se desplegaba a mano. El Sprint 9 dejó listo el endpoint [`/health`](../ops/health.md) como verificación post-deploy, pero su uso seguía siendo manual. El **chore técnico del Sprint 10** automatiza el despliegue a staging y cierra el **último criterio de DoD v2** ("despliegue a staging con verificación post-deploy").

Restricciones:

1. **CI como gate** — nunca desplegar una build que no pasó lint + typecheck + tests (R3).
2. **Secrets fuera del repo** — el token de Vercel jamás en el código ni en logs (R4).
3. **Verificación post-deploy** — el deploy se marca en rojo si `/health` no responde `200`.
4. **Sin smoke tests aún** — los smoke tests post-deploy más completos son chore del S14.

## Opciones evaluadas

### Cómo encadenar "CD depende de CI"

| Opción | Pros | Contras |
|---|---|---|
| **A · `workflow_run` + `conclusion == 'success'`** (seleccionada) | CD en archivo propio (`deploy-staging.yml`). Corre tras CI y solo si pasó. No re-ejecuta lint/tests. | El evento `workflow_run` usa el workflow de la rama por defecto; hay que tenerlo en `main` para que dispare. |
| B · Un solo workflow con `deploy` y `needs: [lint-and-test]` | `needs:` nativo, simple. | Mezcla CI y CD en un archivo; el job de deploy queda atado al de CI también en PRs (hay que filtrarlo con `if`). El artefacto del Sprint pide `deploy-staging.yml` separado. |
| C · Action de Vercel que despliega en cada push | Cero configuración. | Despliega **antes** de que el CI pase → publica builds rotas (justo el R3 que queremos evitar). |

> El Día 2 del Sprint reprodujimos exactamente el riesgo de la opción C: un primer intento desplegó antes de terminar el CI. Por eso el gate es obligatorio.

### Entorno de Vercel

| Opción | Pros | Contras |
|---|---|---|
| **A · `--prod` al proyecto de Vercel** (seleccionada) | El "staging" del equipo es el dominio estable del proyecto académico (el que referencia la encuesta de usabilidad). Una sola URL para la demo y el `/health`. | En un setup multi-entorno real, "staging" y "production" serían proyectos/dominios distintos (se separará cuando haga falta). |
| B · Preview deploy (sin `--prod`) | Aísla cada deploy. | URL efímera por commit → no hay un dominio estable de staging para la demo ni para difundir la encuesta. |

## Decisión

### Workflow `deploy-staging.yml`

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}   # ← gate
    steps:
      - checkout + setup-node 24
      - vercel pull  --yes --environment=production --token=$VERCEL_TOKEN
      - vercel build --prod                          --token=$VERCEL_TOKEN
      - vercel deploy --prebuilt --prod              --token=$VERCEL_TOKEN   # → URL
      - GET <url>/health  (reintentos; falla el job si no responde 200)
```

- **Gate de CI:** `workflow_run` + `conclusion == 'success'` es el equivalente de `needs: [ci]` entre workflows separados (Actions no permite `needs` cross-workflow).
- **Secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` como GitHub Secrets, referenciados con `secrets.*`; nunca impresos.
- **Verificación post-deploy:** `GET /health` sobre la URL del deploy, con reintentos (el dominio tarda unos segundos en propagar). Si nunca responde `200`, el run queda en rojo.
- **Concurrencia:** `concurrency: deploy-staging` con `cancel-in-progress` — un merge nuevo cancela un deploy en curso (último gana).

## Consecuencias

### Positivas

- **DoD v2 cerrada al 100%** — la verificación post-deploy automática era el último criterio _core_ pendiente desde el S8.
- **No se publican builds rotas** — el gate de CI lo impide (R3).
- **Trazable y reproducible** — cada merge a `main` deja un run con build → deploy → `/health` en verde.

### Negativas

- **Acoplado a Vercel CLI** — migrar de proveedor implicaría reescribir los pasos de deploy (aceptable: Vercel es el PaaS del proyecto).
- **`workflow_run` es algo indirecto** — el deploy aparece como un run separado del CI; hay que mirar dos workflows para ver el panorama completo de un merge.
- **Sin smoke tests funcionales aún** — `/health` valida que el backend responde, no los flujos de UI. Los smoke tests entran en el S14.

## Variables de entorno

Tres Secrets nuevos en GitHub (Settings → Secrets and variables → Actions):

| Secret | Descripción |
|---|---|
| `VERCEL_TOKEN` | Token de despliegue de Vercel (Account → Tokens). |
| `VERCEL_ORG_ID` | ID de la organización/cuenta (`.vercel/project.json` tras `vercel link`). |
| `VERCEL_PROJECT_ID` | ID del proyecto en Vercel. |

Además, el proyecto en Vercel debe tener configuradas `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta última la usa `/health`). Guía operativa en [`docs/ops/cd-staging.md`](../ops/cd-staging.md).

## Evidencia

- **Workflow:** `.github/workflows/deploy-staging.yml`.
- **Gate:** depende del workflow `CI` (`.github/workflows/ci.yml`, job `lint-and-test`).
- **Verificación:** `GET /health` (Sprint 9 · [`api/health.ts`](../../api/health.ts)).
- **Demo Sprint Review:** un merge de prueba a `main` → CI en verde → deploy a Vercel → `/health` `200` en ~1-2 min.
