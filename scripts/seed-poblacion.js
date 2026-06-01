// Sprint 10 · MP-01 (ampliación) — Elenco de demostración del edificio.
//
// Crea el resto de vecinos y técnicos para que el sistema se vea como un edificio
// REAL habitado por 3 años (pedido del profesor): junto a los 3 residentes y 2
// técnicos del seed base, deja ~16 residentes y 3 técnicos demo.
//
// Uso:  npm run seed:poblacion   (luego  npm run seed:historico)
//
// Decisiones:
//   • Cuentas reales de Auth (la tabla usuarios tiene FK a auth.users), con un
//     password común de demostración para poder iniciar sesión como cualquiera.
//   • Solo demo/staging: usa SUPABASE_SERVICE_ROLE_KEY y correos @zity-demo.com.
//   • Idempotente: si el usuario ya existe (por email), reusa su id y solo
//     refresca el perfil. Re-ejecutar no duplica.
//   • Altas escalonadas: cada vecino tiene una "fecha de alta" (created_at del
//     perfil) repartida entre hace 36 y hace 4 meses; el seed histórico genera
//     el historial de cada uno solo desde esa fecha. 2 vecinos se "mudaron"
//     (estado_cuenta = bloqueado).

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Password común de demostración (cumple mayús/minús/número/símbolo). */
const PASSWORD_DEMO = 'Demo1234!'

/** Fecha de alta: hace `meses` meses, día 8, en ISO. */
function fechaAlta(meses) {
  const d = new Date()
  d.setMonth(d.getMonth() - meses)
  d.setDate(8)
  d.setHours(10, 0, 0, 0)
  return d.toISOString()
}

/** Email determinista a partir del nombre (sin tildes ni espacios). */
function emailDe(nombre, apellido) {
  const slug = `${nombre}.${apellido}`
    .toLowerCase()
    .normalize('NFD')        // descompone las tildes (í -> i + acento combinante)
    .replace(/[^a-z.]/g, '') // deja solo letras base a-z y puntos (quita acentos)
  return `${slug}@zity-demo.com`
}

// Vecinos nuevos (los 3 del seed base —Laura 4B, Pedro 2A, Julia 5C— no se
// repiten). Pisos/deptos únicos, antigüedad escalonada, 2 mudados (bloqueado).
const RESIDENTES = [
  { nombre: 'Rosa',     apellido: 'Díaz',    piso: '1', departamento: 'A', meses: 36, telefono: '+51 999 100 001' },
  { nombre: 'Jorge',    apellido: 'Mendoza', piso: '1', departamento: 'B', meses: 35, telefono: '+51 999 100 002' },
  { nombre: 'Carmen',   apellido: 'Salazar', piso: '1', departamento: 'C', meses: 33, telefono: '+51 999 100 003', estado: 'bloqueado' },
  { nombre: 'Miguel',   apellido: 'Huamán',  piso: '1', departamento: 'D', meses: 31, telefono: '+51 999 100 004' },
  { nombre: 'Lucía',    apellido: 'Rojas',   piso: '2', departamento: 'B', meses: 29, telefono: '+51 999 100 005' },
  { nombre: 'Diego',    apellido: 'Castro',  piso: '2', departamento: 'C', meses: 26, telefono: '+51 999 100 006' },
  { nombre: 'Patricia', apellido: 'León',    piso: '2', departamento: 'D', meses: 23, telefono: '+51 999 100 007' },
  { nombre: 'Roberto',  apellido: 'Ríos',    piso: '3', departamento: 'A', meses: 21, telefono: '+51 999 100 008', estado: 'bloqueado' },
  { nombre: 'Sofía',    apellido: 'Paredes', piso: '3', departamento: 'B', meses: 18, telefono: '+51 999 100 009' },
  { nombre: 'Andrés',   apellido: 'Campos',  piso: '3', departamento: 'C', meses: 14, telefono: '+51 999 100 010' },
  { nombre: 'Elena',    apellido: 'Cáceres', piso: '3', departamento: 'D', meses: 11, telefono: '+51 999 100 011' },
  { nombre: 'Fernando', apellido: 'Aguilar', piso: '4', departamento: 'A', meses: 7,  telefono: '+51 999 100 012' },
  { nombre: 'Gabriela', apellido: 'Núñez',   piso: '4', departamento: 'C', meses: 4,  telefono: '+51 999 100 013' },
]

// Técnico nuevo (Mario y Ana ya existen en el seed base → con este, 3 demo).
const TECNICOS = [
  { nombre: 'Luis', apellido: 'Quispe', meses: 30, telefono: '+51 999 200 001', empresa: 'ServiTec EIRL' },
]

// Los 3 residentes del seed base se tratan como vecinos "fundadores" (antiguos):
// su created_at real es reciente, así que lo retrasamos para que su historial
// cubra los 3 años completos.
const FUNDADORES = [
  { email: 'laura@zity-demo.com', meses: 36 },
  { email: 'pedro@zity-demo.com', meses: 36 },
  { email: 'julia@zity-demo.com', meses: 34 },
]

async function emailsExistentes() {
  const mapa = new Map()
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) { console.error('Error listando usuarios:', error.message); break }
    for (const u of data?.users ?? []) if (u.email) mapa.set(u.email, u.id)
    if (!data?.users?.length || data.users.length < 1000) break
    page++
  }
  return mapa
}

async function crearPersona(p, rol, idsExistentes) {
  const email = emailDe(p.nombre, p.apellido)
  let id = idsExistentes.get(email)

  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD_DEMO,
      email_confirm: true,
      user_metadata: { nombre: p.nombre, apellido: p.apellido, rol },
    })
    if (error) { console.error(`  Error creando ${email}:`, error.message); return false }
    id = data.user.id
  }

  const { error } = await supabase.from('usuarios').upsert({
    id,
    email,
    nombre: p.nombre,
    apellido: p.apellido,
    telefono: p.telefono ?? '',
    rol,
    piso: p.piso ?? '',
    departamento: p.departamento ?? '',
    estado_cuenta: p.estado ?? 'activo',
    empresa_tercero: p.empresa ?? null,
    created_at: fechaAlta(p.meses),
  })
  if (error) { console.error(`  Error perfil ${email}:`, error.message); return false }

  const etiqueta = p.estado === 'bloqueado' ? ' [bloqueado/mudado]' : ''
  console.log(`  ✓ ${email} (${rol}, alta hace ${p.meses} meses)${etiqueta}`)
  return true
}

async function main() {
  console.log('Poblando el edificio con el elenco de demostracion...\n')
  const idsExistentes = await emailsExistentes()

  console.log(`Residentes (${RESIDENTES.length} nuevos):`)
  let okR = 0
  for (const r of RESIDENTES) if (await crearPersona(r, 'residente', idsExistentes)) okR++

  console.log(`\nTecnicos (${TECNICOS.length} nuevos):`)
  let okT = 0
  for (const t of TECNICOS) if (await crearPersona(t, 'tecnico', idsExistentes)) okT++

  console.log('\nAjustando a los fundadores (Laura/Pedro/Julia) como vecinos antiguos:')
  for (const f of FUNDADORES) {
    const { error } = await supabase.from('usuarios').update({ created_at: fechaAlta(f.meses) }).eq('email', f.email)
    if (error) console.error(`  Error ${f.email}:`, error.message)
    else console.log(`  ✓ ${f.email} → alta hace ${f.meses} meses`)
  }

  console.log(`\n✅ Elenco listo: ${okR} residentes y ${okT} tecnicos demo procesados.`)
  console.log(`   Password comun de demostracion: ${PASSWORD_DEMO}`)
  console.log('   Ahora corre  npm run seed:historico  para generar su historial.')
}

main().catch(err => { console.error(err); process.exit(1) })
