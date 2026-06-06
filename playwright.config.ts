import { defineConfig, devices } from '@playwright/test'

// Sprint 11 · DoD v3 — Config de Playwright para el E2E smoke del flujo crítico de
// la tienda (carrito → confirmar → historial). Smoke LOCAL: no es gate de CI (por
// decisión de alcance del Sprint 11). Se corre con `npm run test:e2e` contra el
// dev server (que Playwright levanta o reusa). Solo Chromium (decisión del S7).

const PORT = 5173
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
