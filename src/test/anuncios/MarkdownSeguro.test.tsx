// Sprint 12 · Chore OWASP A03 — Tests del render seguro de markdown.
//
// Verifica que el cuerpo publicado (que ven todos los residentes) no abre una
// vulnerabilidad de XSS: el HTML/script crudo no se interpreta y los enlaces con
// esquemas peligrosos quedan neutralizados, mientras el markdown legítimo funciona.

import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import MarkdownSeguro from '../../components/shared/MarkdownSeguro'

describe('MarkdownSeguro', () => {
  it('renderiza markdown básico: negrita, listas y enlaces seguros', () => {
    render(<MarkdownSeguro>{'**Corte de agua** el martes\n\n- piso 1\n- piso 2\n\n[portal](https://zity.pe)'}</MarkdownSeguro>)

    expect(screen.getByText('Corte de agua').tagName).toBe('STRONG')
    expect(screen.getByText('piso 1').tagName).toBe('LI')

    const link = screen.getByRole('link', { name: 'portal' })
    expect(link).toHaveAttribute('href', 'https://zity.pe')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('no interpreta HTML/script crudo (A03)', () => {
    const { container } = render(
      <MarkdownSeguro>{'Texto **seguro** del aviso.\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>'}</MarkdownSeguro>,
    )
    // Ni el script ni la imagen llegan al DOM; el markdown legítimo sí.
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('seguro')
    expect(container.textContent).not.toContain('alert(1)')
  })

  it('neutraliza enlaces con esquema javascript: (A03)', () => {
    const { getByText } = render(<MarkdownSeguro>{'[hazme click](javascript:alert(document.cookie))'}</MarkdownSeguro>)
    // urlTransform por defecto vacía el href peligroso (queda href="").
    const link = getByText('hazme click').closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href') ?? '').not.toContain('javascript:')
  })

  it('descarta encabezados de nivel alto fuera del subconjunto pero conserva su texto', () => {
    const { container } = render(<MarkdownSeguro>{'# Titulo gigante'}</MarkdownSeguro>)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.textContent).toContain('Titulo gigante')
  })
})
