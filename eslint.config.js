import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // El prefijo `_` marca descartes intencionales (vars, args y destructuring de arrays).
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Permitimos console.warn / console.error pero no console.log en producción.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // eslint-plugin-react-hooks v7 incorpora reglas del React Compiler. El patrón de
      // data-fetching (un useEffect que invoca un loader async el cual fija la bandera
      // `loading` con setState) es idiomático y está cubierto por los tests, por lo que
      // set-state-in-effect queda como advertencia y no bloquea el build.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Sprint 11 — Specs E2E (Playwright) y su config: corren en Node, no en el browser.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
])
