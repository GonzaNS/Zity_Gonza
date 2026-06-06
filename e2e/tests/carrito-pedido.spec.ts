import { test, expect } from '@playwright/test'

// Sprint 11 · HU-TIENDA-03 · DoD v3 — E2E del flujo crítico de la tienda v2.
//
// Recorre: login del residente → arma el carrito → confirma el pedido (descuento
// atómico de stock en el servidor) → el carrito queda vacío → el pedido aparece en
// el historial. Es el primer E2E del módulo tienda (política "1 E2E por módulo").
//
// Smoke LOCAL (no gate de CI por alcance del Sprint 11). Cada corrida confirma un
// pedido real contra el Supabase del entorno (datos ficticios); para repetirlo
// limpio, re-sembrar con `npm run seed`.

const EMAIL = process.env.E2E_RESIDENTE_EMAIL ?? 'laura@zity-demo.com'
const PASSWORD = process.env.E2E_RESIDENTE_PASSWORD ?? 'Residente1!'

test.describe('Tienda v2 — carrito → confirmar → historial', () => {
  test('el residente arma el carrito, confirma el pedido y lo ve en su historial', async ({ page }) => {
    // 1) Login del residente
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Correo electrónico' }).fill(EMAIL)
    await page.getByRole('textbox', { name: 'Contraseña' }).fill(PASSWORD)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page).toHaveURL(/\/residente$/)

    // 2) Ir a la tienda (navegación SPA, sin recargar)
    await page.getByRole('link', { name: 'Tienda' }).click()
    await expect(page.getByRole('heading', { name: 'Tienda del edificio' })).toBeVisible()

    // 3) Agregar el primer producto disponible al carrito
    await page.getByRole('button', { name: 'Agregar', exact: true }).first().click()
    const miniCarrito = page.getByRole('button', { name: /^Carrito,/ })
    await expect(miniCarrito).toBeVisible()

    // 4) Abrir el carrito desde el mini-carrito (popover → "Ver carrito")
    await miniCarrito.click()
    await page.getByRole('button', { name: 'Ver carrito' }).click()

    // 5) Confirmar el pedido (paso de resumen + confirmación)
    const drawer = page.getByRole('dialog', { name: 'Tu carrito' })
    await expect(drawer).toBeVisible()
    await drawer.getByRole('button', { name: 'Confirmar pedido' }).click()
    await expect(drawer.getByRole('heading', { name: 'Confirmar tu pedido' })).toBeVisible()
    await drawer.getByRole('button', { name: 'Confirmar pedido' }).click()

    // 6) El carrito queda vacío tras confirmar
    await expect(page.getByRole('button', { name: 'Carrito vacío' })).toBeVisible()

    // 7) El pedido aparece en el historial como confirmado
    await page.getByRole('link', { name: 'Mis pedidos' }).click()
    await expect(page.getByRole('heading', { name: 'Mis pedidos' })).toBeVisible()
    await expect(page.getByText('Confirmado').first()).toBeVisible()
  })
})
