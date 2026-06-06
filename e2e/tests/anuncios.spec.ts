import { test, expect, type Page } from '@playwright/test'

// Sprint 12 · HU-ANUNCIO · DoD v3 — E2E del flujo crítico del Tablón.
//
// Recorre: el admin publica un comunicado en /admin/anuncios → el residente lo
// ve en su tablón /residente/anuncios con badge 'Nuevo' → al abrirlo queda
// marcado como leído. Es el E2E del módulo Comunicación ("1 E2E por módulo").
//
// Smoke LOCAL (no gate de CI por alcance del Sprint). Cada corrida publica un
// comunicado real contra el Supabase del entorno (datos ficticios, título único);
// para limpiar el histórico, archívalos desde /admin/anuncios.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'carlos@zity-demo.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!'
const RES_EMAIL = process.env.E2E_RESIDENTE_EMAIL ?? 'laura@zity-demo.com'
const RES_PASSWORD = process.env.E2E_RESIDENTE_PASSWORD ?? 'Residente1!'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(email)
  await page.getByRole('textbox', { name: 'Contraseña' }).fill(password)
  await page.getByRole('button', { name: 'Iniciar sesión' }).click()
}

test.describe('Tablón de anuncios — admin publica → residente recibe y lee', () => {
  test('el admin publica un comunicado y el residente lo ve y lo marca leído', async ({ page }) => {
    const titulo = `Corte de agua programado E2E ${Date.now()}`

    // ── 1) El admin publica un comunicado ──────────────────────────────────
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await expect(page).toHaveURL(/\/admin$/)

    await page.getByRole('link', { name: 'Anuncios' }).click()
    await expect(page.getByRole('heading', { name: 'Anuncios' })).toBeVisible()

    await page.getByRole('button', { name: 'Nuevo comunicado' }).click()
    const dialog = page.getByRole('dialog', { name: 'Nuevo comunicado' })
    await expect(dialog).toBeVisible()

    await dialog.getByPlaceholder('Ej: Corte de agua programado').fill(titulo)
    await dialog.getByPlaceholder(/Escribe el comunicado/).fill('**Importante**: el agua se corta el martes de 9 a 12 h.')
    await dialog.getByRole('combobox').first().selectOption('mantenimiento')
    await dialog.getByRole('combobox').nth(1).selectOption('importante')
    await dialog.getByRole('button', { name: 'Publicar comunicado' }).click()

    // El comunicado aparece en la lista del admin.
    await expect(page.getByText(titulo)).toBeVisible()

    // ── 2) Cierra sesión del admin ─────────────────────────────────────────
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login/)

    // ── 3) El residente ve el comunicado en su tablón ──────────────────────
    await login(page, RES_EMAIL, RES_PASSWORD)
    await expect(page).toHaveURL(/\/residente$/)

    // Navegación SPA (no page.goto: recargar compite con la restauración de sesión).
    await page.getByRole('link', { name: /Anuncios/ }).click()
    await expect(page).toHaveURL(/\/residente\/anuncios$/)
    await expect(page.getByRole('heading', { name: 'Tablón de anuncios' })).toBeVisible()

    const card = page.getByText(titulo)
    await expect(card).toBeVisible()

    // ── 4) Al abrirlo, queda marcado como leído ────────────────────────────
    await card.click()
    const detalle = page.getByRole('dialog', { name: titulo })
    await expect(detalle).toBeVisible()
    await expect(detalle.getByText('Marcado como leído')).toBeVisible()
    // El cuerpo se renderiza (markdown sanitizado): se ve el texto, no el markup '**'.
    await expect(detalle.getByText(/el agua se corta el martes/)).toBeVisible()
  })
})
