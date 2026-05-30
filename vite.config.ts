import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Sprint 7 · Hotfix Recharts + es-toolkit pre-bundle
  //
  // Problema: Recharts 3.8.1 importa funciones de `es-toolkit/compat/*` con default
  // import (ej. `import get from 'es-toolkit/compat/get'`) pero los archivos `.mjs`
  // de es-toolkit solo tienen named exports (`export { get }`). El interop CJS↔ESM
  // de Vite falla de dos maneras según la config:
  //   - Sin optimizeDeps: SyntaxError "does not provide an export named 'default'"
  //   - Con exclude: misma cosa, peor.
  //   - Con pre-bundle por defecto: bug `require_isUnsafeProperty is not a function`
  //     por un wrap CJS recursivo que produce esbuild.
  //
  // Fix: forzar a Vite a pre-bundlear recharts JUNTO con es-toolkit usando esbuild
  // (que sí maneja el interop bien cuando los procesa juntos). El `needsInterop`
  // le dice a Vite que es-toolkit es CJS internamente y debe envolverse para
  // exponer default exports a los consumidores ESM.
  optimizeDeps: {
    include: ['recharts', 'es-toolkit', 'es-toolkit/compat'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // Sprint 7 chore-T — los tests E2E de Playwright viven en `e2e/` y se corren
    // con `npm run test:e2e` (Playwright runner, distinto runtime que Vitest).
    // Sin este exclude, Vitest intentaria importar los .spec.ts de Playwright y
    // crashea con "test.describe() was not expected to be called here".
    exclude: ['**/node_modules/**', '**/dist/**'],
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
