// Sprint 10 · MP-01 — Seed histórico de 3 años de datos de demostración.
//
// Genera ~36 meses de facturas (luz/agua/pensión, en soles) y solicitudes de
// mantenimiento para los residentes demo (@zity-demo.com), para dar realismo a
// las métricas (S7) y al futuro dashboard ejecutivo del dueño (S14).
//
// Uso:  npm run seed:historico
//
// Decisiones (ver ADR-012 / Sprint Planning §1):
//   • SOLO demo/staging: usa SUPABASE_SERVICE_ROLE_KEY y solo toca usuarios
//     @zity-demo.com. NUNCA correr contra producción.
//   • Idempotente y determinista: precarga lo existente y solo inserta lo que
//     falta; los montos/estados se derivan de un PRNG sembrado por
//     (residente, periodo, tipo) → re-ejecutar da el mismo resultado, sin duplicar.
//   • Respeta RLS/constraints: inserta vía service role respetando los CHECK
//     (monto/estado/método) y el UNIQUE(residente_id, tipo, periodo).
//   • Reusa el dominio existente (facturas/solicitudes); no crea tablas nuevas.
//   • Limpia el "ruido" de notificaciones que generan los triggers al insertar
//     facturas/solicitudes históricas (no es el objetivo del seed).

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

const MESES = 36           // 3 años
const DESDE_OFFSET = 2     // arranca hace 2 meses (el seed base cubre el mes actual y el pasado)
const MARCADOR = '[seed-historico]'

// ── PRNG determinista (hash FNV-1a + mulberry32) ──────────────────────────────
function fnv1a(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rngFor = (...parts) => mulberry32(fnv1a(parts.join('|')))
const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)]

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function periodoOffset(monthsAgo) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - monthsAgo)
  return d.toISOString().slice(0, 7)
}
function ultimoDiaDelMes(periodo) {
  const [y, m] = periodo.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}
function diaDelMes(periodo, dia) {
  return `${periodo}-${String(dia).padStart(2, '0')}`
}
function chunks(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}
/** Meses transcurridos desde una fecha ISO hasta hoy (por año*12 + mes). */
function mesesDesde(iso) {
  const alta = new Date(iso)
  const hoy = new Date()
  return (hoy.getFullYear() - alta.getFullYear()) * 12 + (hoy.getMonth() - alta.getMonth())
}

// ── Carga de residentes demo ──────────────────────────────────────────────────
async function cargarContexto() {
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, piso, departamento, email, created_at, empresa_tercero')
    .like('email', '%zity-demo.com')

  if (error) { console.error('Error cargando usuarios demo:', error.message); process.exit(1) }
  // Cada residente recibe historial solo desde su "fecha de alta" (created_at),
  // acotado al rango [DESDE_OFFSET, MESES+DESDE_OFFSET-1].
  const residentes = (usuarios ?? [])
    .filter(u => u.rol === 'residente')
    .map(u => ({
      ...u,
      mesesAntiguedad: Math.min(MESES + DESDE_OFFSET - 1, Math.max(DESDE_OFFSET, mesesDesde(u.created_at))),
    }))
  const tecnicos = (usuarios ?? []).filter(u => u.rol === 'tecnico')
  const admin = (usuarios ?? []).find(u => u.rol === 'admin')
  if (residentes.length === 0) {
    console.warn('No hay residentes demo. Corre primero `npm run seed`.')
    process.exit(0)
  }
  return { residentes, tecnicos, adminId: admin?.id ?? null }
}

// ── Facturas históricas ───────────────────────────────────────────────────────
const PLANTILLAS_FACTURA = [
  { tipo: 'luz',     min: 90,  max: 180 },
  { tipo: 'agua',    min: 30,  max: 55 },
  { tipo: 'pension', min: 800, max: 800 },
]
const METODOS = ['efectivo', 'transferencia', 'tarjeta']

async function seedFacturas(residentes, adminId) {
  const periodos = Array.from({ length: MESES }, (_, k) => periodoOffset(DESDE_OFFSET + k))

  // Precarga: claves (residente|tipo|periodo) ya existentes → idempotencia.
  const existentes = new Set()
  for (const r of residentes) {
    const { data } = await supabase
      .from('facturas').select('tipo, periodo').eq('residente_id', r.id).in('periodo', periodos)
    for (const f of data ?? []) existentes.add(`${r.id}|${f.tipo}|${f.periodo}`)
  }

  const filas = []
  for (const r of residentes) {
    for (let k = 0; k < MESES; k++) {
      const offset = DESDE_OFFSET + k
      if (offset > r.mesesAntiguedad) continue // el residente aún no vivía aquí
      const periodo = periodoOffset(offset)
      for (const tpl of PLANTILLAS_FACTURA) {
        if (existentes.has(`${r.id}|${tpl.tipo}|${periodo}`)) continue
        const rnd = rngFor(r.id, periodo, tpl.tipo)
        const monto = tpl.min === tpl.max ? tpl.min : tpl.min + Math.round(rnd() * (tpl.max - tpl.min))
        const x = rnd()
        const fila = {
          residente_id: r.id, tipo: tpl.tipo, monto, periodo,
          fecha_emision: `${periodo}-01`, vencimiento: ultimoDiaDelMes(periodo),
        }
        if (x < 0.82) {            // mayoría pagada (con método y fecha de pago)
          const metodo = pick(rnd, METODOS)
          fila.estado = 'pagada'
          fila.fecha_pago = diaDelMes(periodo, 5 + Math.floor(rnd() * 22))
          fila.metodo_pago = metodo
          fila.registrado_por = metodo === 'tarjeta' ? r.id : adminId
        } else if (x < 0.93) {     // algunas vencidas
          fila.estado = 'vencida'
        } else {                   // pocas pendientes
          fila.estado = 'pendiente'
        }
        filas.push(fila)
      }
    }
  }

  const facturaIds = []
  for (const lote of chunks(filas, 100)) {
    const { data, error } = await supabase.from('facturas').insert(lote).select('id')
    if (error) { console.error('  Error insertando lote de facturas:', error.message); continue }
    for (const f of data ?? []) facturaIds.push(f.id)
  }
  console.log(`  ✓ Facturas: ${facturaIds.length} creadas, ${existentes.size} ya existían`)
  return facturaIds
}

// ── Solicitudes históricas ────────────────────────────────────────────────────
const TIPOS_SOLICITUD = [
  ['mantenimiento', 'plomeria'], ['mantenimiento', 'electricidad'], ['mantenimiento', 'limpieza'],
  ['mantenimiento', 'areas_comunes'], ['mantenimiento', 'seguridad'],
  ['reparacion', 'electricidad'], ['reparacion', 'plomeria'], ['queja', 'limpieza'],
]

async function seedSolicitudes(residentes, tecnicos, adminId) {
  // Reset: borra las solicitudes históricas previas (el marcador). El ON DELETE
  // CASCADE limpia su historial_estados y asignaciones. Así se pueden repartir de
  // nuevo entre TODO el elenco de forma determinista (mismo resultado al reejecutar).
  await supabase.from('solicitudes').delete().like('descripcion', `%${MARCADOR}%`)

  // Genera las solicitudes repartidas entre los residentes ya dados de alta.
  const filas = []
  for (let k = 0; k < MESES; k++) {
    const offset = DESDE_OFFSET + k
    const periodo = periodoOffset(offset)
    const elegibles = residentes.filter(r => r.mesesAntiguedad >= offset)
    if (elegibles.length === 0) continue // nadie vivía aún en el edificio ese mes
    const rndMes = rngFor('sol-mes', periodo)
    const n = 2 + Math.floor(rndMes() * 3)   // 2-4 solicitudes por mes
    for (let i = 0; i < n; i++) {
      const rnd = rngFor('sol', periodo, String(i))
      const r = pick(rnd, elegibles)
      const [tipo, categoria] = pick(rnd, TIPOS_SOLICITUD)
      const x = rnd()
      const estado = x < 0.62 ? 'resuelta' : x < 0.78 ? 'cerrada' : x < 0.88 ? 'en_progreso' : x < 0.96 ? 'asignada' : 'pendiente'
      const dia = 1 + Math.floor(rnd() * 26)
      const hora = 8 + Math.floor(rnd() * 10)
      const createdAt = `${diaDelMes(periodo, dia)}T${String(hora).padStart(2, '0')}:00:00-05:00`
      // Para resueltas/cerradas, updated_at = creación + tiempo de resolución (alimenta tiempos_resolucion).
      let updatedAt = createdAt
      if (estado === 'resuelta' || estado === 'cerrada') {
        const horas = 2 + Math.floor(rnd() * 160)
        updatedAt = new Date(new Date(createdAt).getTime() + horas * 3600 * 1000).toISOString()
      }
      filas.push({
        residente_id: r.id, tipo, categoria,
        descripcion: `Solicitud de ${categoria} (datos de demostración para el historial). ${MARCADOR} ${periodo}#${i}`,
        prioridad: rnd() < 0.3 ? 'urgente' : 'normal',
        piso: r.piso, departamento: r.departamento,
        estado, created_at: createdAt, updated_at: updatedAt,
      })
    }
  }

  // Inserta y recupera id + estado + created_at para asignar técnico.
  const insertadas = []
  for (const lote of chunks(filas, 100)) {
    const { data, error } = await supabase.from('solicitudes').insert(lote).select('id, estado, created_at')
    if (error) { console.error('  Error insertando lote de solicitudes:', error.message); continue }
    insertadas.push(...(data ?? []))
  }

  // Asigna un técnico a las solicitudes que dejaron de estar 'pendiente'
  // (asignada/en_progreso/resuelta/cerrada): el trabajo se reparte entre el
  // equipo de mantenimiento a lo largo de los 3 años. fecha_asignacion = poco
  // después de crearse; asignado_por = el admin.
  let asignadas = 0
  if (tecnicos.length && adminId) {
    const asignaciones = []
    for (const s of insertadas) {
      if (s.estado === 'pendiente') continue
      const rnd = rngFor('asig', s.id)
      const tec = pick(rnd, tecnicos)
      const fecha = new Date(new Date(s.created_at).getTime() + (2 + Math.floor(rnd() * 30)) * 3600 * 1000).toISOString()
      asignaciones.push({
        solicitud_id: s.id,
        tecnico_id: tec.id,
        asignado_por: adminId,
        fecha_asignacion: fecha,
        empresa_tercero: tec.empresa_tercero ?? null,
      })
    }
    for (const lote of chunks(asignaciones, 100)) {
      const { data, error } = await supabase.from('asignaciones').insert(lote).select('id')
      if (error) { console.error('  Error insertando asignaciones:', error.message); continue }
      asignadas += (data ?? []).length
    }
  }

  console.log(`  ✓ Solicitudes: ${insertadas.length} creadas y repartidas · ${asignadas} asignadas a técnicos`)
  return insertadas.map(s => s.id)
}

// ── Limpieza del ruido de notificaciones generado por los triggers ────────────
async function limpiarNotificaciones(facturaIds, solicitudIds) {
  let borradas = 0
  // Notificaciones de facturas (after_factura_inserted → factura_nueva). El
  // factura_id va en metadata; filtramos por el operador JSON de PostgREST.
  for (const lote of chunks(facturaIds, 100)) {
    const { data } = await supabase
      .from('notificaciones').delete().in('metadata->>factura_id', lote).select('id')
    borradas += (data ?? []).length
  }
  // Notificaciones ligadas a las solicitudes históricas (si las hubiera).
  for (const lote of chunks(solicitudIds, 100)) {
    const { data } = await supabase
      .from('notificaciones').delete().in('solicitud_id', lote).select('id')
    borradas += (data ?? []).length
  }
  if (borradas) console.log(`  ✓ ${borradas} notificaciones de relleno eliminadas`)
}

async function main() {
  console.log(`Seed histórico — ${MESES} meses (desde hace ${DESDE_OFFSET} meses), zona America/Lima\n`)
  const { residentes, tecnicos, adminId } = await cargarContexto()
  console.log(`Residentes demo: ${residentes.map(r => r.nombre).join(', ')}`)
  console.log(`Técnicos demo: ${tecnicos.map(t => t.nombre).join(', ')}\n`)

  console.log('Generando facturas históricas…')
  const facturaIds = await seedFacturas(residentes, adminId)

  console.log('Generando solicitudes históricas…')
  const solicitudIds = await seedSolicitudes(residentes, tecnicos, adminId)

  console.log('Limpiando notificaciones de relleno…')
  await limpiarNotificaciones(facturaIds, solicitudIds)

  // Refrescar la vista de métricas (best-effort; requiere rol admin — si falla,
  // el cron la refresca y los conteos directos ya reflejan el histórico).
  const { error: errRefresh } = await supabase.rpc('refresh_metricas_on_demand')
  if (errRefresh) console.log(`  · No se pudo refrescar la vista de métricas (${errRefresh.message}). El cron la actualizará.`)
  else console.log('  ✓ Vista de métricas refrescada')

  console.log('\n✅ Seed histórico completado. Revisa el dashboard de métricas y las facturas.')
}

main().catch(err => { console.error(err); process.exit(1) })
