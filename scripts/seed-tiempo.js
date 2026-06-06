// Sprint 9 · Acción 1 del Retro — Seed de "avance del tiempo".
//
// Ajusta de forma REPRODUCIBLE los vencimientos de las facturas demo para poder
// mostrar en una Review los recordatorios (3 días antes) y el marcado automático
// de "vencida", sin esperar al calendario real. Luego ejecuta el job diario
// (marcar_facturas_vencidas_y_recordatorios) para aplicar el efecto al instante.
//
// Uso:  npm run seed:tiempo
//
// Idempotente: re-ejecutarlo reinicia las facturas demo del mes a 'pendiente'
// (recordatorio_enviado=false) antes de reposicionar las fechas, así el resultado
// es siempre el mismo.

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

/** Fecha de hoy en America/Lima (UTC-5) desplazada `offsetDias`, en 'YYYY-MM-DD'. */
function fechaLima(offsetDias) {
  const lima = new Date(Date.now() - 5 * 3600 * 1000)
  lima.setUTCDate(lima.getUTCDate() + offsetDias)
  return lima.toISOString().slice(0, 10)
}

async function main() {
  const periodoActual = new Date().toISOString().slice(0, 7)
  console.log(`Seed de tiempo — periodo ${periodoActual} (zona America/Lima)\n`)

  // 1. Residentes demo
  const { data: residentes, error: errRes } = await supabase
    .from('usuarios')
    .select('id, nombre, email')
    .eq('rol', 'residente')
    .like('email', '%zity-demo.com')
    .order('email')

  if (errRes) { console.error('Error cargando residentes:', errRes.message); process.exit(1) }
  if (!residentes?.length) {
    console.warn('No hay residentes demo. Corre primero `npm run seed`.')
    process.exit(0)
  }

  const fechaEmision = fechaLima(-10)
  const fechaRecordatorio = fechaLima(3)   // vence en 3 días → recordatorio
  const fechaVencida = fechaLima(-2)       // venció hace 2 días → 'vencida'
  const fechaVenceHoy = fechaLima(0)       // vence hoy → recordatorio del día (S12 · PBI-S9-E02)

  // 2. Por cada residente, reposicionar sus facturas NO pagadas del mes:
  //    la 1ª a "vence en 3 días", la 2ª a "ya vencida", la 3ª a "vence hoy".
  //    Reset para reproducibilidad.
  for (const r of residentes) {
    const { data: facturas, error } = await supabase
      .from('facturas')
      .select('id, tipo')
      .eq('residente_id', r.id)
      .eq('periodo', periodoActual)
      .neq('estado', 'pagada')
      .order('tipo')

    if (error) { console.error(`  Error (${r.email}):`, error.message); continue }
    if (!facturas?.length) { console.log(`  · ${r.nombre}: sin facturas pendientes este mes`); continue }

    const plan = [
      { factura: facturas[0], vencimiento: fechaRecordatorio, etiqueta: 'vence en 3 días' },
      facturas[1] ? { factura: facturas[1], vencimiento: fechaVencida, etiqueta: 'ya vencida' } : null,
      facturas[2] ? { factura: facturas[2], vencimiento: fechaVenceHoy, etiqueta: 'vence hoy' } : null,
    ].filter(Boolean)

    for (const p of plan) {
      const { error: upErr } = await supabase
        .from('facturas')
        .update({
          estado: 'pendiente',
          recordatorio_enviado: false,
          recordatorio_vencimiento_enviado: false,
          fecha_emision: fechaEmision,
          vencimiento: p.vencimiento,
        })
        .eq('id', p.factura.id)
      if (upErr) console.error(`  Error ajustando ${p.factura.tipo}:`, upErr.message)
      else console.log(`  ✓ ${r.nombre}: ${p.factura.tipo} → ${p.etiqueta} (${p.vencimiento})`)
    }
  }

  // 3. Ejecutar el job diario para aplicar el efecto de inmediato.
  console.log('\nEjecutando el job diario (vencidas + recordatorios)…')
  const { data: resultado, error: errJob } = await supabase.rpc('marcar_facturas_vencidas_y_recordatorios')
  if (errJob) {
    console.error('Error ejecutando el job:', errJob.message)
    process.exit(1)
  }
  console.log(`  → ${JSON.stringify(resultado)}`)
  console.log('\n✅ Seed de tiempo completado. Revisa /residente/facturas y la campana de notificaciones.')
}

main().catch(err => { console.error(err); process.exit(1) })
