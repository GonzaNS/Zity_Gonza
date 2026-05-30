// Sprint 9 · Chore técnico — Endpoint /health (cierra el último criterio de DoD v2).
//
// Función serverless de Vercel (runtime Node, @vercel/node) que verifica las tres
// dependencias críticas del backend y responde un JSON compacto:
//   { status, db, auth, storage, version }
//
// Usa la firma Node clásica (req, res) — la que espera @vercel/node en un proyecto
// Vite — y completa la respuesta con res.status().json(). (Devolver un `Response`
// estilo Web API deja la petición colgada → 504 FUNCTION_INVOCATION_TIMEOUT.)
//
// Seguridad (R6 / OWASP): la respuesta NUNCA incluye mensajes de error internos ni
// secretos — solo 'ok' | 'error' por dependencia. Los detalles van a los logs.
// Reusa SUPABASE_SERVICE_ROLE_KEY (Sprint 3); sin variables nuevas.

import { createClient } from '@supabase/supabase-js'

// Vercel type-chequea /api con el tsconfig raíz (sin @types/node); declaramos lo
// mínimo del runtime Node que usamos para evitar depender de @types/node.
declare const process: { env: Record<string, string | undefined> }

/** Forma mínima del response de @vercel/node que usamos (evita la dep de tipos). */
type VercelRes = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => VercelRes
  json: (body: unknown) => void
}

type Estado = 'ok' | 'error'

export default async function handler(_req: unknown, res: VercelRes): Promise<void> {
  res.setHeader('cache-control', 'no-store')

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
    res.status(503).json({ status: 'error', db, auth, storage, version })
    return
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
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'error', db, auth, storage, version })
}
