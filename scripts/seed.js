import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  {
    email: 'carlos@zity-demo.com',
    password: 'Admin1234!',
    metadata: { nombre: 'Carlos', apellido: 'Fuentes', rol: 'admin', piso: '', departamento: '', telefono: '' },
  },
  {
    email: 'laura@zity-demo.com',
    password: 'Residente1!',
    metadata: { nombre: 'Laura', apellido: 'Vega', rol: 'residente', piso: '4', departamento: 'B', telefono: '+51 999 000 001' },
  },
  {
    email: 'pedro@zity-demo.com',
    password: 'Residente2!',
    metadata: { nombre: 'Pedro', apellido: 'Ramos', rol: 'residente', piso: '2', departamento: 'A', telefono: '+51 999 000 002' },
  },
  {
    email: 'mario@zity-demo.com',
    password: 'Tecnico1234!',
    metadata: { nombre: 'Mario', apellido: 'Peña', rol: 'tecnico', piso: '', departamento: '', telefono: '+51 999 000 003' },
  },
  {
    email: 'ana@zity-demo.com',
    password: 'Tecnico5678!',
    metadata: { nombre: 'Ana', apellido: 'Torres', rol: 'tecnico', piso: '', departamento: '', telefono: '+51 999 000 004', empresa_tercero: 'TecnoEdif SAC' },
  },
  {
    email: 'julia@zity-demo.com',
    password: 'Residente3!',
    metadata: { nombre: 'Julia', apellido: 'Romero', rol: 'residente', piso: '5', departamento: 'C', telefono: '+51 999 000 005' },
  },
]

async function cleanDb() {
  console.log('Limpiando BD...')
  await supabase.from('audit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('invitaciones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('historial_estados').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('asignaciones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('solicitudes').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  const { data: authUsers } = await supabase.auth.admin.listUsers()
  for (const u of authUsers?.users ?? []) {
    if (USERS.some(seed => seed.email === u.email)) {
      await supabase.auth.admin.deleteUser(u.id)
    }
  }

  const demoEmails = USERS.map(u => u.email)
  await supabase.from('usuarios').delete().in('email', demoEmails)
  console.log('BD limpia.')
}

async function seedUsers() {
  console.log('Insertando usuarios...')
  const createdIds = {}

  // Lookup previo: si los usuarios ya existen (seed corrió antes sin --clean),
  // necesitamos recuperar sus IDs para poder seedear el resto (solicitudes,
  // invitaciones). createUser retorna error duplicado pero no el ID existente.
  const { data: authUsersAll } = await supabase.auth.admin.listUsers()
  const idPorEmail = new Map()
  for (const u of authUsersAll?.users ?? []) {
    if (u.email) idPorEmail.set(u.email, u.id)
  }

  for (const user of USERS) {
    let userId = idPorEmail.get(user.email)

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: user.metadata,
      })
      if (error) {
        console.error(`Error creando ${user.email}:`, error.message)
        continue
      }
      userId = data.user.id
    }

    createdIds[user.email] = userId

    const profileData = {
      id: userId,
      email: user.email,
      nombre: user.metadata.nombre,
      apellido: user.metadata.apellido,
      telefono: user.metadata.telefono,
      rol: user.metadata.rol,
      piso: user.metadata.piso,
      departamento: user.metadata.departamento,
      estado_cuenta: 'activo',
      empresa_tercero: user.metadata.empresa_tercero ?? null,
    }

    const { error: profileError } = await supabase.from('usuarios').upsert(profileData)
    if (profileError) {
      console.error(`Error insertando perfil ${user.email}:`, profileError.message)
    } else {
      console.log(`  ✓ ${user.email} (${user.metadata.rol})`)
    }
  }

  return createdIds
}

async function seedInvitacion(adminId) {
  console.log('Insertando invitación pendiente (hace 3 días)...')
  const tresDiasAtras = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const expiresAt = new Date(Date.now() + 45 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('invitaciones').insert({
    email: 'nuevo.residente@ejemplo.com',
    rol: 'residente',
    nombre: 'Nuevo Residente',
    piso: '3',
    departamento: 'C',
    token: randomUUID(),
    estado: 'pendiente',
    creada_por: adminId,
    expires_at: expiresAt,
    created_at: tresDiasAtras,
  })

  if (error) {
    console.error('Error insertando invitación:', error.message)
  } else {
    console.log('  ✓ Invitación pendiente (hace 3 días)')
  }
}

// Seeds 3 solicitudes demo con imágenes externas de picsum.photos. Por decisión
// del Sprint 3 (Retro · Acción 2: estrategia de seed) NO subimos archivos
// reales al bucket — guardamos directamente la URL externa en `imagen_url`.
// La UI sabe diferenciar paths del bucket de URLs absolutas y muestra ambas
// (las firmadas se generan sólo cuando el path no comienza con http).
async function seedSolicitudes(ids) {
  console.log('Insertando solicitudes de mantenimiento demo...')
  const lauraId = ids['laura@zity-demo.com']
  const pedroId = ids['pedro@zity-demo.com']
  const juliaId = ids['julia@zity-demo.com']
  if (!lauraId || !pedroId || !juliaId) {
    console.warn('  Faltan IDs de residentes; se omite seed de solicitudes')
    return
  }

  const SOLICITUDES_DEMO = [
    {
      residente_id: lauraId,
      tipo: 'mantenimiento',
      categoria: 'plomeria',
      descripcion: 'Gotera en el baño principal, gotea sobre el piso. Inicia hace 2 días al usar la ducha.',
      prioridad: 'urgente',
      piso: '4',
      departamento: 'B',
      imagen_url: 'https://picsum.photos/seed/zity-001/800/600',
    },
    {
      residente_id: pedroId,
      tipo: 'reparacion',
      categoria: 'electricidad',
      descripcion: 'El interruptor de la sala hace chispa al apagarlo. Sólo ocurre con la luz central.',
      prioridad: 'urgente',
      piso: '2',
      departamento: 'A',
      imagen_url: 'https://picsum.photos/seed/zity-002/800/600',
    },
    {
      residente_id: juliaId,
      tipo: 'queja',
      categoria: 'limpieza',
      descripcion: 'El pasillo del piso 5 lleva 4 días sin barrer. Hay polvo acumulado en las esquinas.',
      prioridad: 'normal',
      piso: '5',
      departamento: 'C',
      imagen_url: 'https://picsum.photos/seed/zity-003/800/600',
    },
  ]

  for (const s of SOLICITUDES_DEMO) {
    // Idempotencia: si ya existe una solicitud demo de ese residente con la
    // misma descripción, no la duplicamos. Esto permite ejecutar `npm run seed`
    // varias veces sin reset y mantener un set estable de datos demo.
    const { data: existente } = await supabase
      .from('solicitudes')
      .select('id, codigo')
      .eq('residente_id', s.residente_id)
      .eq('descripcion', s.descripcion)
      .maybeSingle()

    if (existente) {
      console.log(`  · Solicitud ${existente.codigo} ya existe, se omite`)
      continue
    }

    const { error } = await supabase.from('solicitudes').insert(s)
    if (error) {
      console.error(`  Error insertando solicitud para ${s.residente_id}:`, error.message)
    } else {
      console.log(`  ✓ Solicitud ${s.tipo}/${s.categoria} (${s.prioridad}) para ${s.residente_id.slice(0, 8)}…`)
    }
  }
}

// Sprint 8 · Acción Retro S7 (seed representativo del módulo) —
// Inserta facturas demo para los 3 residentes activos:
//   • Mes pasado: 1 luz + 1 agua + 1 pensión, todas pagadas
//   • Mes actual: 1 luz + 1 agua, pendientes
// Esto hace que /residente/facturas se vea "real" desde el primer click del demo.
async function seedFacturas(ids) {
  console.log('Insertando facturas demo (Sprint 8)...')
  const residentes = [
    { uuid: ids['laura@zity-demo.com'], nombre: 'Laura' },
    { uuid: ids['pedro@zity-demo.com'], nombre: 'Pedro' },
    { uuid: ids['julia@zity-demo.com'], nombre: 'Julia' },
  ].filter(r => r.uuid)

  if (residentes.length === 0) {
    console.warn('  Faltan IDs de residentes; se omite seed de facturas')
    return
  }

  // Helper: 'YYYY-MM' para un mes con offset desde el actual.
  function periodoConOffset(monthsAgo) {
    const d = new Date()
    d.setMonth(d.getMonth() - monthsAgo)
    return d.toISOString().slice(0, 7)
  }
  // Helper: último día del mes en 'YYYY-MM-DD'.
  function ultimoDiaDelMes(periodo) {
    const [y, m] = periodo.split('-').map(Number)
    const ultimo = new Date(y, m, 0)
    return ultimo.toISOString().split('T')[0]
  }

  const periodoActual = periodoConOffset(0)
  const periodoPasado = periodoConOffset(1)

  // Plantillas: tipo, monto (variado por residente para que el desglose se vea real)
  const PLANTILLAS_PASADO = [
    { tipo: 'luz',     montos: [120, 95, 145] },
    { tipo: 'agua',    montos: [40, 35, 42] },
    { tipo: 'pension', montos: [800, 800, 800] },
  ]
  const PLANTILLAS_ACTUAL = [
    { tipo: 'luz',  montos: [135, 105, 160] },
    { tipo: 'agua', montos: [45, 38, 48] },
  ]

  let creadas = 0
  let omitidas = 0

  // Mes pasado: pagadas
  for (let i = 0; i < residentes.length; i++) {
    for (const tpl of PLANTILLAS_PASADO) {
      const fila = {
        residente_id:  residentes[i].uuid,
        tipo:          tpl.tipo,
        monto:         tpl.montos[i],
        periodo:       periodoPasado,
        fecha_emision: `${periodoPasado}-01`,
        vencimiento:   ultimoDiaDelMes(periodoPasado),
        estado:        'pagada',
      }
      const { error } = await supabase.from('facturas').insert(fila)
      if (error) {
        if (error.code === '23505') { omitidas++; continue }
        console.error(`  Error factura ${tpl.tipo}/${residentes[i].nombre}/${periodoPasado}:`, error.message)
      } else {
        creadas++
      }
    }
  }

  // Mes actual: pendientes
  for (let i = 0; i < residentes.length; i++) {
    for (const tpl of PLANTILLAS_ACTUAL) {
      const fila = {
        residente_id:  residentes[i].uuid,
        tipo:          tpl.tipo,
        monto:         tpl.montos[i],
        periodo:       periodoActual,
        fecha_emision: `${periodoActual}-01`,
        vencimiento:   ultimoDiaDelMes(periodoActual),
        estado:        'pendiente',
      }
      const { error } = await supabase.from('facturas').insert(fila)
      if (error) {
        if (error.code === '23505') { omitidas++; continue }
        console.error(`  Error factura ${tpl.tipo}/${residentes[i].nombre}/${periodoActual}:`, error.message)
      } else {
        creadas++
      }
    }
  }

  console.log(`  ✓ ${creadas} facturas creadas (${omitidas} ya existían y se omitieron)`)
}

// Sprint 6 (--notify) — encola 10 notificaciones iniciales por residente activo
// del seed, para demostrar el centro de notificaciones y el Realtime en la Review.
// Usa service_role (policy notificaciones_insert_service_role).
async function seedNotificaciones(ids) {
  console.log('Encolando notificaciones demo (--notify)...')
  const residentes = USERS.filter(u => u.metadata.rol === 'residente')
  const plantillas = [
    { tipo: 'estado_cambio', titulo: 'Solicitud en progreso', mensaje: 'Tu solicitud cambió a: en progreso.' },
    { tipo: 'estado_cambio', titulo: 'Solución reportada por el técnico', mensaje: 'Tu solicitud cambió a: resuelta.' },
    { tipo: 'asignacion', titulo: 'Solicitud asignada a un técnico', mensaje: 'Se asignó un técnico a tu solicitud.' },
    { tipo: 'nueva_solicitud', titulo: 'Solicitud registrada', mensaje: 'Tu solicitud se registró correctamente.' },
    { tipo: 'sistema', titulo: 'Bienvenido a Zity', mensaje: 'Tu cuenta está activa. Ya puedes crear solicitudes.' },
  ]
  for (const r of residentes) {
    const uid = ids[r.email]
    if (!uid) continue
    const filas = Array.from({ length: 10 }, (_, i) => {
      const p = plantillas[i % plantillas.length]
      return {
        usuario_id: uid,
        solicitud_id: null,
        tipo: p.tipo,
        titulo: p.titulo,
        mensaje: p.mensaje,
        leida: i >= 4, // las primeras 4 quedan sin leer
      }
    })
    const { error } = await supabase.from('notificaciones').insert(filas)
    if (error) console.error(`  Error notificaciones ${r.email}:`, error.message)
    else console.log(`  ✓ 10 notificaciones para ${r.email}`)
  }
}

// Sprint 12 — Anuncios demo del tablón (publicados por el admin Carlos).
// IDs deterministas + upsert → idempotente (re-correr no duplica). El trigger
// after_anuncio_publicado solo notifica los importante/urgente (no los normal).
async function seedAnuncios(ids) {
  const adminId = ids['carlos@zity-demo.com']
  if (!adminId) { console.warn('Sin admin demo; omito anuncios.'); return }

  console.log('Sembrando anuncios demo del tablón...')
  const en30dias = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

  const anuncios = [
    {
      id: 'a1a1a1a1-0000-4000-8000-000000000001',
      titulo: 'Bienvenidos al tablón de anuncios',
      cuerpo: 'Desde ahora la administración publicará aquí los **comunicados oficiales** del edificio.\n\n- Avisos de mantenimiento\n- Convocatorias a asamblea\n- Recordatorios de seguridad\n\nActiva las notificaciones para enterarte al instante.',
      categoria: 'general', prioridad: 'normal', fijado: true, imagen_url: null, vigente_hasta: null,
    },
    {
      id: 'a1a1a1a1-0000-4000-8000-000000000002',
      titulo: 'Mantenimiento del ascensor el sábado',
      cuerpo: 'El **sábado de 8:00 a 12:00** se realizará el mantenimiento preventivo del ascensor principal. Durante ese lapso usa el ascensor de servicio. Disculpa las molestias.',
      categoria: 'mantenimiento', prioridad: 'importante', fijado: false,
      imagen_url: 'https://picsum.photos/seed/zity-ascensor/800/450', vigente_hasta: null,
    },
    {
      id: 'a1a1a1a1-0000-4000-8000-000000000003',
      titulo: 'Convocatoria a asamblea general',
      cuerpo: 'Se convoca a **asamblea general de propietarios** para revisar el presupuesto anual.\n\nRevisa la fecha y el orden del día en el documento adjunto. Tu participación es importante.',
      categoria: 'asamblea', prioridad: 'normal', fijado: false,
      imagen_url: 'https://picsum.photos/seed/zity-asamblea/800/450', vigente_hasta: en30dias,
    },
    {
      id: 'a1a1a1a1-0000-4000-8000-000000000004',
      titulo: 'Recordatorio de seguridad',
      cuerpo: 'Recuerda **no abrir la puerta principal a desconocidos** y cerrar bien la cochera al salir. Ante cualquier emergencia, contacta a la administración.',
      categoria: 'seguridad', prioridad: 'normal', fijado: false, imagen_url: null, vigente_hasta: null,
    },
  ].map(a => ({ ...a, publicado_por: adminId }))

  const { error } = await supabase.from('anuncios').upsert(anuncios, { onConflict: 'id' })
  if (error) console.error('  Error anuncios:', error.message)
  else console.log(`  ✓ ${anuncios.length} anuncios demo (1 fijado, 2 con imagen)`)
}

async function main() {
  // `--clean` borra los datos demo antes de insertar (uso recomendado en
  // staging después de pruebas manuales). Sin la bandera el seed es
  // idempotente gracias al upsert por id.
  if (process.argv.includes('--clean')) {
    await cleanDb()
  }
  const ids = await seedUsers()
  const adminId = ids['carlos@zity-demo.com']
  if (adminId) await seedInvitacion(adminId)
  await seedSolicitudes(ids)
  // Sprint 8 — facturas demo (mes pasado pagadas + mes actual pendientes)
  await seedFacturas(ids)
  // Sprint 12 — anuncios demo del tablón
  await seedAnuncios(ids)
  // Sprint 6 — notificaciones demo opcionales para la Review.
  if (process.argv.includes('--notify')) {
    await seedNotificaciones(ids)
  }
  console.log('\n✅ Seed completado.')
}

main().catch(console.error)
