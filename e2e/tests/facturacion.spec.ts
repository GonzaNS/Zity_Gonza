// Sprint 8 · Chore-T · Segundo E2E de la suite Playwright.
//
// Flujo end-to-end del módulo de facturación:
//   1. Admin (Carlos) login → /admin/facturacion
//   2. Emite factura individual a un residente activo (Laura)
//   3. Cierra sesión → login como Laura (residente)
//   4. /residente/facturas: verifica que la nueva factura aparece como pendiente
//   5. Verifica que la campana de notificaciones tiene la notificación factura_nueva
//
// La suite Playwright crece como chore (PDF Sprint 8): 1 E2E por módulo nuevo.
// Sin protagonismo: 1.5 h, P2.

import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL    = process.env.E2E_ADMIN_EMAIL    ?? 'carlos@zity-demo.com'
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'Admin1234!'

const RESIDENTE_EMAIL    = process.env.E2E_RESIDENTE_EMAIL    ?? 'laura@zity-demo.com'
const RESIDENTE_PASSWORD = process.env.E2E_RESIDENTE_PASSWORD ?? 'Residente1!'

// Período único por corrida para evitar colisión con el constraint
// UNIQUE(residente_id, tipo, periodo). El offset depende de la hora (epoch) para
// que cada corrida use un mes futuro distinto; antes era un valor fijo (mes+6),
// por lo que la 2ª corrida del mismo día chocaba con la factura ya creada.
// Rango ~12..611 meses al futuro (≈50 años), colisión despreciable entre runs.
function periodoUnicoParaTest(): string {
  const offsetMeses = 12 + (Math.floor(Date.now() / 1000) % 600)
  const d = new Date()
  d.setMonth(d.getMonth() + offsetMeses)
  return d.toISOString().slice(0, 7)  // 'YYYY-MM'
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/correo electrónico/i).fill(email)
  // Regex anclado: el input de password y el botón "Mostrar contraseña"
  // comparten el texto "contraseña"; `^...$` desambigua hacia el input.
  await page.getByLabel(/^contraseña$/i).fill(password)
  await page.getByRole('button', { name: /iniciar sesión/i }).click()
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: /cerrar sesión/i }).first().click()
  await page.waitForURL('**/login', { timeout: 10_000 })
}

test.describe('Facturación — emisión individual + vista del residente', () => {
  test('admin emite factura → residente la ve + recibe notificación', async ({ page }) => {
    const periodo = periodoUnicoParaTest()
    const monto = '120.00'

    // ── 1. Login admin ────────────────────────────────────────────────────────
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.waitForURL('**/admin', { timeout: 15_000 })

    // ── 2. Ir a /admin/facturacion ────────────────────────────────────────────
    await page.getByRole('link', { name: /facturación/i }).click()
    await page.waitForURL('**/admin/facturacion', { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: /facturación/i })).toBeVisible()

    // ── 3. Modo individual + completar formulario ─────────────────────────────
    // 'Emisión individual' está seleccionada por defecto, no hace falta cambiarla.
    await page.locator('#f-residente').waitFor({ state: 'visible' })

    // Seleccionar a Laura: selectOption no acepta regex en `label`, así que
    // localizamos su <option> por texto y seleccionamos por su value (UUID).
    const opcionLaura = page.locator('#f-residente option', { hasText: /Laura/i }).first()
    const valorLaura = await opcionLaura.getAttribute('value')
    expect(valorLaura).toBeTruthy()
    await page.locator('#f-residente').selectOption(valorLaura!)
    await page.locator('#f-tipo').selectOption('luz')
    await page.locator('#f-monto').fill(monto)
    await page.locator('#f-periodo').fill(periodo)

    // El vencimiento se autocompleta al último día del periodo. Verificamos
    // que tiene un valor antes de submitear (no comparar exacto, depende del mes).
    const vencimientoValor = await page.locator('#f-vencimiento').inputValue()
    expect(vencimientoValor).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // ── 4. Emitir ─────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^emitir factura$/i }).click()

    // Toast de éxito
    await expect(page.getByText(/factura emitida correctamente/i)).toBeVisible({
      timeout: 10_000,
    })

    // ── 5. Logout admin → login residente ─────────────────────────────────────
    await signOut(page)
    await login(page, RESIDENTE_EMAIL, RESIDENTE_PASSWORD)
    await page.waitForURL('**/residente', { timeout: 15_000 })

    // ── 6. Verificar notificación en la campana ───────────────────────────────
    // La campana tiene un badge con el conteo de no leídas. Si llegó la
    // notificación factura_nueva, el botón aria-label se actualiza.
    await expect(
      page.getByRole('button', { name: /notificaciones, \d+ sin leer/i })
    ).toBeVisible({ timeout: 10_000 })

    // ── 7. Ir a /residente/facturas vía link "Mis facturas" del header ────────
    await page.getByRole('link', { name: /mis facturas/i }).click()
    await page.waitForURL('**/residente/facturas', { timeout: 5_000 })
    await expect(page.getByRole('heading', { name: /mis facturas/i })).toBeVisible()

    // ── 8. Verificar que la nueva factura aparece ─────────────────────────────
    // Filtramos por "Pendientes" para no depender del orden global
    await page.getByRole('button', { name: /^pendientes$/i }).click()

    // Una tarjeta de Electricidad ($120.00) debe existir
    // Recharts/UI puede usar "$120.00" o "MX$120.00" según el locale; matcheamos por monto.
    const tarjetaElectricidad = page
      .locator('button', { has: page.getByText('Electricidad') })
      .filter({ hasText: /120/ })
      .first()

    await expect(tarjetaElectricidad).toBeVisible({ timeout: 10_000 })

    // Badge "Pendiente" en la tarjeta
    await expect(tarjetaElectricidad.getByText(/pendiente/i)).toBeVisible()
  })
})
