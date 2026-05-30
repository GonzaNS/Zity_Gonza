// Sprint 7 · Chore-T · Setup mínimo de Playwright
//
// Solo Chromium como gate de PR (sin matriz Firefox/Webkit, sin trace viewer
// avanzado), conforme al PDF del Sprint 7 (riesgo R4: mantener el consumo de
// minutos del free tier de GitHub Actions bajo control).
//
// Cada Sprint funcional añade 1 E2E del módulo nuevo como chore (no protagonista).
// Más detalle: /docs/testing/e2e.md y /docs/adr/006-recharts.md.

import { defineConfig, devices } from '@playwright/test'

// `webServer` solo levanta `npm run dev` si nadie está sirviendo ya en 5173.
// Esto permite iterar localmente con la app abierta sin levantarla dos veces.
//
// Usamos `||` (no `??`): en el trigger `push` el workflow pasa E2E_BASE_URL=''
// (string vacío, no nullish), y queremos que ese caso caiga al dev server local
// igual que cuando la variable no está definida. Con `??` el '' se colaba como
// baseURL y `page.goto('/login')` fallaba con "Cannot navigate to invalid URL".
const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',

  // Tiempos generosos pero acotados — el PDF apunta a < 25 s por corrida total.
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // En CI no permitir `test.only`; reintentar 1 vez por flake transitorio.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list']],

  use: {
    baseURL,
    // Capturar trace y screenshot solo cuando un test falla — barato y útil.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  // Solo Chromium en este Sprint. Cuando la suite madure (sprints futuros) se
  // podrá ampliar a Firefox/Webkit cambiando aquí.
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Levantamos el dev server de Vite si no está corriendo. `reuseExistingServer`
  // detecta el que el desarrollador ya tenga abierto.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
