import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Sprint 7 chore-T — los tests E2E de Playwright viven en `e2e/` y se corren
    // con `npm run test:e2e` (Playwright runner, distinto runtime que Vitest).
    // Sin este exclude, Vitest intentaria importar los .spec.ts de Playwright y
    // crashea con "test.describe() was not expected to be called here".
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    // En CI no existe .env, así que sin estos defaults el módulo
    // src/lib/supabase.ts llama a createClient(undefined, …) y todos los
    // tests que importen (directa o transitivamente) ese módulo fallan al
    // cargar. Los tests reales mockean supabase via vi.mock, por lo que
    // estos valores nunca se usan para hacer una llamada de red — solo
    // permiten que createClient construya el cliente al cargar el módulo.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-not-real',
    },
    // Sprint 4 (DoD v2): gate de cobertura ≥ 60 % en el módulo core de solicitudes.
    // El reporter `text` imprime el resumen en la salida del CI; `lcov` es el formato
    // que consumen herramientas externas (Codecov, etc.).
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/types/**',
      ],
      thresholds: {
        // Sprint 4 — Helper centralizado de cambio de estado + utilidades.
        'src/lib/solicitudes.ts': {
          lines: 60,
          statements: 60,
          functions: 60,
          branches: 60,
        },
        // Sprint 5 — Helper centralizado de auditoría.
        'src/lib/audit.ts': {
          lines: 60,
          statements: 60,
          functions: 60,
          branches: 60,
        },
        // Sprint 6 — Helper de notificaciones en tiempo real.
        'src/lib/notificaciones.ts': {
          lines: 60,
          statements: 60,
          functions: 60,
          branches: 60,
        },
        // Sprint 7 — PBI-22 Fórmulas de métricas de mantenimiento.
        'src/lib/metricas.ts': {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 80,
        },
      },
    },
  },
})
