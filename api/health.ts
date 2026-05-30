// Sprint 9 · Chore técnico — Endpoint /health (cierra el último criterio de DoD v2).
//
// Función serverless de Vercel (runtime Node) que verifica las tres dependencias
// críticas del backend y responde un JSON compacto:
//   { status, db, auth, storage, version }
//
// Seguridad (R6 / OWASP): la respuesta NUNCA incluye mensajes de error internos
// ni secretos — solo 'ok' | 'error' por dependencia. Los detalles se loguean en
// el servidor. Reusa SUPABASE_SERVICE_ROLE_KEY (Sprint 3); sin variables nuevas.
//
// Se expone como /health vía el rewrite de vercel.json.

import { createClient } from '@supabase/supabase-js'

// Vercel type-chequea las funciones de /api con el tsconfig raíz, cuyo
// `types: ['vitest/globals']` no incluye @types/node, así que `process` no está
// tipado. Lo declaramos localmente (en el runtime Node de Vercel sí existe).
declare const process: { env: Record<string, string | undefined> }

type Estado = 'ok' | 'error'

export default async function handler(): Promise<Response> {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.npm_package_version ??
    '0.1.0'

  let db: Estado = 'error'
  let auth: Estado = 'error'
  let storage: Estado = 'error'

  if (!url || !serviceKey) {
    console.error('[health] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    return json({ status: 'error', db, auth, storage, version }, 503)
  }

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // DB: una lectura mínima sobre una tabla del esquema (SELECT 1 equivalente).
  try {
    const { error } = await supabase.from('usuarios').select('id', { head: true, count: 'exact' })
    if (error) { console.error('[health] db:', error.message) } else { db = 'ok' }
  } catch (e) {
    console.error('[health] db:', (e as Error).message)
  }

  // Auth: el admin API responde (servicio GoTrue operativo).
  try {
    const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) { console.error('[health] auth:', error.message) } else { auth = 'ok' }
  } catch (e) {
    console.error('[health] auth:', (e as Error).message)
  }

  // Storage: el servicio de almacenamiento lista los buckets.
  try {
    const { error } = await supabase.storage.listBuckets()
    if (error) { console.error('[health] storage:', error.message) } else { storage = 'ok' }
  } catch (e) {
    console.error('[health] storage:', (e as Error).message)
  }

  const allOk = db === 'ok' && auth === 'ok' && storage === 'ok'
  return json({ status: allOk ? 'ok' : 'error', db, auth, storage, version }, allOk ? 200 : 503)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
