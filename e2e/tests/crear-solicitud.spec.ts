// Sprint 7 · Chore-T · Primer E2E del flujo crítico "crear solicitud".
//
// Cobertura del flujo end-to-end:
//   1. Login del residente (laura@zity-demo.com del seed)
//   2. Apertura del modal "Nueva solicitud" en /residente
//   3. Llenado del formulario (tipo, categoría, descripción, prioridad, foto)
//   4. Submit → pantalla de confirmación con código
//   5. Cierre del modal → la solicitud aparece en "Mis solicitudes"
//
// Filosofía (PDF Sprint 7, sección Chore-T): este es el "primer E2E como
// semilla". A partir del Sprint 8 cada módulo nuevo añade 1 E2E como chore.
// Sin matriz Firefox, sin trace viewer avanzado.
//
// Credenciales: por defecto usa el usuario del seed (laura). Para CI o entornos
// aislados, los env vars E2E_RESIDENTE_EMAIL / E2E_RESIDENTE_PASSWORD sobreescriben.

import { test, expect } from '@playwright/test'
import { TEST_PNG_FILE } from '../fixtures/test-image.png'

const RESIDENTE_EMAIL    = process.env.E2E_RESIDENTE_EMAIL    ?? 'laura@zity-demo.com'
const RESIDENTE_PASSWORD = process.env.E2E_RESIDENTE_PASSWORD ?? 'Residente1!'

test.describe('Crear solicitud — flujo del residente', () => {
  test('residente logea, completa el formulario, envía y ve la solicitud en su lista', async ({ page }) => {
    // ── 1. Login ──────────────────────────────────────────────────────────────
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible()

    await page.getByLabel(/correo electrónico/i).fill(RESIDENTE_EMAIL)
    await page.getByLabel(/contraseña/i).fill(RESIDENTE_PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()

    // ── 2. Aterriza en /residente ─────────────────────────────────────────────
    await page.waitForURL('**/residente', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: /hola,/i })).toBeVisible()

    // Contar solicitudes ANTES de crear: usamos el código (mono-fuente) como
    // identificador para verificar que la nueva aparece después.
    const codigosAntes = await page.locator('span.font-mono').allTextContents()

    // ── 3. Abrir modal "Nueva solicitud" ──────────────────────────────────────
    await page.getByRole('button', { name: /nueva solicitud/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nueva solicitud' })).toBeVisible()

    // ── 4. Llenar formulario ──────────────────────────────────────────────────
    await page.locator('#sol-tipo').selectOption('mantenimiento')
    await page.locator('#sol-categoria').selectOption('plomeria')
    await page.locator('#sol-desc').fill(
      'E2E Playwright (Sprint 7 chore-T): fuga en el lavadero. ' +
      'Esta solicitud fue creada automáticamente por el E2E smoke test.',
    )

    // Subir foto via setInputFiles directo al input file oculto.
    // El componente UploadFoto tiene dos inputs file ocultos (galería + cámara);
    // usamos el primero (galería) que es el único visible en desktop.
    await page.locator('input[type="file"]').first().setInputFiles(TEST_PNG_FILE)

    // Esperar a que el preview se renderice (img con alt de preview)
    await expect(page.getByAltText(/vista previa/i)).toBeVisible()

    // ── 5. Submit ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /enviar solicitud/i }).click()

    // ── 6. Pantalla de confirmación con código ────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Solicitud enviada' })).toBeVisible({
      timeout: 15_000,
    })

    // El texto "Solicitud SOL-xxxx creada" debe aparecer
    const confirmTexto = await page.getByText(/solicitud .* creada/i).textContent()
    expect(confirmTexto).toMatch(/SOL-/i)

    // ── 7. Cerrar modal con "Listo" ───────────────────────────────────────────
    await page.getByRole('button', { name: /listo/i }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // ── 8. Verificar que aparece en "Mis solicitudes" ─────────────────────────
    // El toast con "Solicitud SOL-xxxx registrada" aparece tras crear.
    await expect(page.getByText(/registrada/i)).toBeVisible({ timeout: 5_000 })

    // Y el listado tiene al menos una solicitud más que antes.
    // Esperamos hasta que el código nuevo aparezca (refetch async tras crear).
    await expect.poll(async () => {
      const codigosAhora = await page.locator('span.font-mono').allTextContents()
      return codigosAhora.length
    }, { timeout: 10_000, message: 'la lista debería tener un código más después de crear' })
      .toBeGreaterThan(codigosAntes.length)
  })
})
