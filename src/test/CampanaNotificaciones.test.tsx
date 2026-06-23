import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CampanaNotificaciones from '../components/shared/CampanaNotificaciones'
import type { Notificacion } from '../types/database'

// El panel de notificaciones vive en un Portal y está position:fixed anclado al
// botón. Por eso se cierra cuando la página de fondo hace scroll (quedaría
// desalineado). Pero NO debe cerrarse cuando el scroll ocurre dentro de su
// propia lista interna (overflow-y-auto) — ese era el bug.

const mockMarcarComoLeida = vi.fn().mockResolvedValue({ ok: true })
let mockNotificaciones: Notificacion[] = []

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { rol: 'residente' } }),
}))

vi.mock('../contexts/NotificacionesContext', () => ({
  useNotificaciones: () => ({
    notificaciones: mockNotificaciones,
    noLeidasCount: mockNotificaciones.filter(n => !n.leida).length,
    marcarComoLeida: mockMarcarComoLeida,
  }),
}))

function notif(over: Partial<Notificacion> = {}): Notificacion {
  return {
    id: 'n1',
    usuario_id: 'u1',
    solicitud_id: null,
    tipo: 'estado_cambio',
    titulo: 'Título',
    mensaje: 'Mensaje',
    leida: false,
    created_at: '2026-05-20T00:00:00Z',
    ...over,
  }
}

function abrirPanel() {
  fireEvent.click(screen.getByRole('button', { name: /notificaciones/i }))
  return screen.getByRole('dialog')
}

describe('CampanaNotificaciones — scroll dentro del panel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNotificaciones = [notif({ id: 'n1' }), notif({ id: 'n2' }), notif({ id: 'n3' })]
    render(
      <MemoryRouter>
        <CampanaNotificaciones />
      </MemoryRouter>,
    )
  })

  it('NO se cierra al hacer scroll dentro de la lista del panel', () => {
    const dialog = abrirPanel()
    const lista = within(dialog).getByRole('list')

    fireEvent.scroll(lista)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('se cierra al hacer scroll fuera del panel (página de fondo)', () => {
    abrirPanel()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.scroll(document.body)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
