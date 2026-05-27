# Tests End-to-End (Playwright) — sección inicial

Documento "vivo" sobre cómo escribimos, corremos y mantenemos los E2E de Zity. Creado en el Sprint 7 como parte del **Chore-T técnico** (1 h, P3): "Instalar Playwright + workflow CI + primer E2E del flujo crear-solicitud (semilla)".

> [!IMPORTANT]
> **Filosofía del proyecto (PDF Sprint 7):** la suite E2E crece como chore en cada Sprint funcional — **1 E2E nuevo por módulo nuevo** (S8 facturación, S10 tienda, etc.). Nunca como sprint dedicado.

---

## Setup local

### Primera vez

```bash
# 1. Instalar las dependencias del proyecto (incluye @playwright/test)
npm install

# 2. Descargar los binarios de Chromium (~140 MB; solo la primera vez)
npm run test:e2e:install
```

> [!NOTE]
> Playwright descarga Chromium fuera de `node_modules/` — queda en `~/.cache/ms-playwright/` (Linux/macOS) o `%LOCALAPPDATA%\ms-playwright\` (Windows). Por eso `npm install` solo no es suficiente: hay que correr `test:e2e:install` para tener el browser.

### Variables de entorno

Los E2E necesitan poder hacer login contra un Supabase real. Si tienes `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, el dev server lo lee automáticamente (Vite no necesita más).

Las credenciales del usuario residente las puedes pasar por env vars, pero por defecto usan el usuario del seed (`laura@zity-demo.com` / `Residente1!`). Si quieres sobreescribir:

```bash
# PowerShell (Windows)
$env:E2E_RESIDENTE_EMAIL = "laura@zity-demo.com"
$env:E2E_RESIDENTE_PASSWORD = "Residente1!"

# Bash (Linux/macOS/Git Bash)
export E2E_RESIDENTE_EMAIL=laura@zity-demo.com
export E2E_RESIDENTE_PASSWORD='Residente1!'
```

---

## Cómo correr los tests

| Comando | Para qué |
|---|---|
| `npm run test:e2e` | Headless en CLI (la forma "de PR/CI"). |
| `npm run test:e2e:ui` | UI interactiva — útil para debuggear paso a paso. |
| `npx playwright test --headed` | Como `test:e2e` pero abriendo Chrome para ver qué pasa. |
| `npx playwright test --debug` | Inspector de Playwright — pausa antes de cada acción. |
| `npx playwright test e2e/tests/crear-solicitud.spec.ts` | Correr solo un spec. |
| `npx playwright show-report` | Ver el HTML report de la última corrida. |

### El dev server se levanta solo

`playwright.config.ts` tiene un `webServer` que levanta `npm run dev` si nadie está sirviendo en `localhost:5173`. Si **ya tienes** `npm run dev` corriendo, Playwright reusa esa instancia (`reuseExistingServer: true` cuando no es CI).

Esto significa que puedes:
1. Levantar `npm run dev` en una terminal mientras programas.
2. Correr `npm run test:e2e` en otra — Playwright se conecta a tu dev server sin reiniciarlo.

---

## Estructura de carpetas

```
e2e/
├── fixtures/              ← datos / archivos / helpers reutilizables
│   └── test-image.png.ts  ← PNG dummy 1×1 generado en memoria
└── tests/                 ← specs (.spec.ts)
    └── crear-solicitud.spec.ts   ← Sprint 7 · chore-T (semilla)
```

### Convenciones

- **Un spec = un módulo funcional.** El de Sprint 7 cubre "crear solicitud"; el de Sprint 8 cubrirá "admin emite → residente ve factura"; etc.
- **No mezclar setups.** Si un test necesita un estado previo (usuario logueado, datos en BD), levantarlo dentro del `beforeEach` del describe, no compartir estado entre describes.
- **Selectores estables:** preferir `getByRole`, `getByLabel`, `getByText` sobre selectores CSS. Solo usar `locator('#id')` cuando el ID está hardcoded en el componente y es estable (ej. `#sol-tipo`).
- **No depender de tiempos exactos.** Usar `expect.poll` o `waitFor` en vez de `page.waitForTimeout`.

---

## Workflow CI

`.github/workflows/e2e.yml` corre la suite en cada push/PR a `main`:

1. Setup Node 24 + `npm ci`
2. Validación temprana: chequea que `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` estén configurados como GitHub Secrets. Si no, falla con mensaje claro apuntando aquí.
3. Descarga Chromium con `npx playwright install --with-deps chromium`
4. Ejecuta `npm run test:e2e`
5. Si falla, sube `playwright-report/` y `test-results/` como artifacts (retención: 7 días).

### Secrets requeridos en GitHub

Configurar en **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Valor sugerido |
|---|---|
| `VITE_SUPABASE_URL` | URL pública del proyecto Supabase (ej: `https://abc123.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima del proyecto |
| `E2E_RESIDENTE_EMAIL` | (opcional) Email del residente de prueba — default: `laura@zity-demo.com` |
| `E2E_RESIDENTE_PASSWORD` | (opcional) Password — default: `Residente1!` |

> [!WARNING]
> Si los E2E corren contra el Supabase de producción, cada corrida crea una solicitud real en la BD. Para entornos académicos esto está OK (datos ficticios). En producción "real" deberías usar un proyecto Supabase aparte para E2E y limpiarlo con un script periódico.

---

## Política para sprints siguientes

| Sprint | E2E a añadir como chore |
|---|---|
| S8 (Facturación) | "Admin emite factura → residente la ve" |
| S9 (Facturación v2) | "Marcar factura como pagada + PDF descargable" |
| S10 (Tienda v1) | "Admin gestiona catálogo: agregar producto con foto" |
| S11 (Tienda v2) | "Residente agrega al carrito → descuento de stock atómico" |
| S12 (Notificaciones avanzadas) | "Web Push se entrega y aparece en /notificaciones" |
| S13 (Panel residente integral) | "Residente ve sus 3 dominios en una sola vista" |
| S14 (Dashboard ejecutivo) | "Dueño abre dashboard ejecutivo y ve los 3 dominios" |

Cada uno aporta **1 E2E nuevo de ~1.5–2 h**, sin volverse protagonista del Sprint.

---

## Cosas a NO hacer

- **No agregues una matriz Firefox/Webkit** hasta que el equipo tenga banda para mantenerla. Chromium solo es el gate de PR (decisión del Sprint 7, riesgo R4).
- **No agregues trace viewer avanzado / video grabado en cada corrida** — `retain-on-failure` + `only-on-failure` es suficiente. Capturar video en cada corrida infla el storage del free tier.
- **No mezcles tests E2E con tests unitarios.** Los E2E viven en `e2e/`, los unitarios en `src/test/`. Vitest **excluye** `e2e/` automáticamente (no es parte de `include` en `vite.config.ts`).
- **No bloquees PRs por flakes transitorios.** Tenemos `retries: 1` en CI. Si un test falla 2 veces seguidas, hay un bug real — investigar, no aumentar retries.

---

## Debug rápido cuando un E2E falla

1. **Lee el output de la consola** — Playwright imprime el step exacto que falló.
2. **Abre el HTML report:** `npx playwright show-report` te muestra screenshot + DOM al momento del fallo.
3. **Reproduce localmente:** `npx playwright test e2e/tests/<spec>.spec.ts --headed` para ver el browser en acción.
4. **Inspector interactivo:** `npx playwright test --debug` te permite avanzar paso a paso.
5. **Revisa el trace:** Playwright lo guarda en `test-results/<test-name>/trace.zip` cuando hay failure. Subirlo a [trace.playwright.dev](https://trace.playwright.dev) (drag & drop, no se envía a ningún server) para ver una línea de tiempo completa.

---

## Referencias

- ADR-006: [Recharts vs SVG nativo](../adr/006-recharts.md) — la otra decisión técnica del Sprint 7.
- PDF Sprint 7: `docs/sprints/Zity_Sprint7_Artefactos.pdf` (sección Chore-T).
- [Playwright docs oficiales](https://playwright.dev/docs/intro) — getting started, locators, fixtures.
