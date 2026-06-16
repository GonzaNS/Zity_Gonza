import type { Rol } from '../types/database'

export const ROLE_ROUTES: Record<Rol, string> = {
  admin:      '/admin',
  residente:  '/residente',
  tecnico:    '/tecnico',
  // Sprint 14 · HU-EJEC-01 — El observador aterriza en el panel ejecutivo,
  // no en el panel operativo /admin (que exige rol admin).
  observador: '/admin/ejecutivo',
}

export function rutaPorRol(rol: Rol | undefined | null): string {
  return ROLE_ROUTES[rol ?? 'residente']
}
