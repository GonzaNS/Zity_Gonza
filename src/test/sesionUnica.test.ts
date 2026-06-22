// Fix post Sprint 13/14 (PBI-S6-E03) — Helpers de "sesión única".
// Cubre la decodificación del claim session_id del JWT y la decisión de cierre.

import { describe, it, expect } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import { getSessionIdFromToken, marcaInvalidaSesion } from '../lib/sesionUnica'

/** Construye un JWT de juguete (base64url sin padding); la firma no se valida. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.firma-no-validada`
}

const sessionCon = (accessToken: string) =>
  ({ access_token: accessToken } as unknown as Session)

describe('getSessionIdFromToken', () => {
  it('extrae el claim session_id de un JWT válido', () => {
    const token = fakeJwt({ sub: 'user-1', session_id: '11111111-2222-3333-4444-555555555555' })
    expect(getSessionIdFromToken(token)).toBe('11111111-2222-3333-4444-555555555555')
  })

  it('devuelve null si el token no trae session_id', () => {
    expect(getSessionIdFromToken(fakeJwt({ sub: 'user-1' }))).toBeNull()
  })

  it('devuelve null para entradas vacías o malformadas', () => {
    expect(getSessionIdFromToken(null)).toBeNull()
    expect(getSessionIdFromToken(undefined)).toBeNull()
    expect(getSessionIdFromToken('')).toBeNull()
    expect(getSessionIdFromToken('no-es-un-jwt')).toBeNull()
    expect(getSessionIdFromToken('aaa.%%%.ccc')).toBeNull()
  })
})

describe('marcaInvalidaSesion', () => {
  const token = fakeJwt({ sub: 'u1', session_id: 'sid-actual' })
  const session = sessionCon(token)

  it('no invalida cuando no hay marca (varias sesiones permitidas)', () => {
    expect(marcaInvalidaSesion(null, session)).toBe(false)
    expect(marcaInvalidaSesion(undefined, session)).toBe(false)
  })

  it('no invalida cuando la marca coincide con la sesión actual', () => {
    expect(marcaInvalidaSesion('sid-actual', session)).toBe(false)
  })

  it('invalida cuando la marca apunta a otra sesión', () => {
    expect(marcaInvalidaSesion('sid-de-otra-sesion', session)).toBe(true)
  })

  it('no invalida si no hay sesión o el token no trae session_id', () => {
    expect(marcaInvalidaSesion('sid-x', null)).toBe(false)
    expect(marcaInvalidaSesion('sid-x', sessionCon(fakeJwt({ sub: 'u1' })))).toBe(false)
  })
})
