# -*- coding: utf-8 -*-
"""
Artefactos Scrum — Zity · Sprint 9 (Semana 11) · Facturación v2.

Contenido derivado de:
  - Zity_Roadmap_Sprints.pdf  (Sprint 9 — Facturación v2: cobros y recordatorios)
  - Zity_Sprint8_Artefactos.pdf  ("Vista previa Sprint 9" + emergentes S8-E01/E02)
  - Zity_PRD.md  (Epic FACT-01, modelo de datos, DoD, stakeholders)

Render:  python sprint9.py   (desde scripts/artefactos/)
"""
import os
from zity_artefactos import (
    cover, sec, meta, goal, note, sub, para, bullets, numlist, table, spacer,
    finalnote, hucard, dot, dotline, chk, xmk, star, build_pdf,
)

FOOT = " · Artefactos Scrum · Sprint 9"

BLOCKS = []
B = BLOCKS.append

# --------------------------------------------------------------------------- #
#  PORTADA                                                                     #
# --------------------------------------------------------------------------- #
B(cover(
    "Sprint 9",
    "Artefactos Scrum — Sprint 9",
    "Facturación v2 — Cerrar el ciclo de cobro: el admin marca facturas como pagadas (notificación Realtime) · "
    "un job diario dispara recordatorios 3 días antes del vencimiento y marca las vencidas · el residente descarga "
    "su comprobante PDF · el admin ve los totales del periodo · /health cierra DoD v2 como chore técnico",
    [
        ("Producto", "Zity"),
        ("Sprint", "Sprint 9 — Semana 11"),
        ("Stack", "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                  "Resend · Vercel · GitHub Actions · Vitest · Recharts (desde S7) · Playwright (desde S7) · "
                  "pdf-lib (nuevo, comprobantes) · pg_cron (nuevo, job diario)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers", "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "12.5 horas (2.5 horas de buffer)"),
        ("DoD aplicable", "DoD v2 — sexta aplicación (cierra el criterio /health pendiente desde el S4)"),
        ("Nuevo en este sprint",
         "Marcar factura como pagada (estado pendiente/vencida → pagada) con notificación Realtime · "
         "un job diario (pg_cron + Edge Function) que marca facturas como 'vencida' y dispara recordatorios "
         "3 días antes del vencimiento (Realtime + email) · descarga de comprobante PDF por factura pagada (pdf-lib) · "
         "tarjeta de totales del periodo (emitido / cobrado / pendiente / vencido) en /admin/facturacion"),
        ("Chore técnico del Sprint",
         "Endpoint /health (DB + Auth + Storage) que cierra el último criterio core de DoD v2 + tercer E2E de la suite "
         "Playwright (flujo 'marcar pagada'). 1 h, P2."),
        ("Variables nuevas",
         "Ninguna en código fuente · /health reusa SUPABASE_SERVICE_ROLE_KEY (S3) y el cron reusa "
         "RESEND_API_KEY / RESEND_FROM_ADDRESS (S2/S6)"),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ],
))

# --------------------------------------------------------------------------- #
#  1 · ACTA DE SPRINT PLANNING                                                 #
# --------------------------------------------------------------------------- #
B(sec(1, "Acta de Sprint Planning"))
B(meta([
    ("Sprint", "Sprint 9 — Semana 11"),
    ("Fecha", "Lunes — inicio de semana 11"),
    ("Duración del evento", "75 minutos + 30 min de Planning ampliado con stakeholder (Acción 2 del Retro S8)"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Asistentes", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
    ("Stakeholder invitado",
     "Laura Vega (Residente ficticia) — primera aplicación de la Acción 2 del Retro S8: el stakeholder entra al "
     "Planning, no solo a la Review. Valida los recordatorios y el comprobante PDF que ella misma pidió en el S8."),
    ("Capacidad", "15 horas disponibles · se usarán 12.5 h (2.5 h de buffer)"),
    ("Entrada",
     "Product Backlog actualizado tras Sprint 8 Review. Entran los 2 emergentes del S8 absorbidos en Facturación v2: "
     "PBI-S8-E01 (comprobante PDF) y PBI-S8-E02 (totales del periodo). El /health pasa de 'pendiente DoD v2' a chore "
     "comprometido de este Sprint, cerrando el último criterio."),
    ("Refinement previo",
     "Quinta aplicación de la práctica (viernes anterior, 30 min). Incluye por primera vez la sección "
     "'Edge cases del dominio' (Acción 3 del Retro S8): se capturan «¿qué pasa si se marca pagada dos veces?», "
     "«¿qué pasa si el cron corre dos veces?» y «¿en qué zona horaria se calcula el vencimiento?»."),
]))
B(goal(
    "Cerrar el ciclo de facturación: el admin marca como pagada cada factura — con notificación al residente —, "
    "un job diario dispara recordatorios automáticos 3 días antes del vencimiento y etiqueta solas las facturas "
    "vencidas, y el residente descarga el comprobante PDF de las que ya pagó. El admin ve de un vistazo los totales "
    "del periodo (emitido / cobrado / pendiente / vencido).",
    prefix="Sprint Goal:"))
B(note(
    "Nota: Sexta aplicación de DoD v2 y cierre del último criterio pendiente (/health). Facturación v2 completa el "
    "dominio de finanzas abierto en el S8 y deja la estructura de facturas lista para que la Tienda (S10/S11) sume "
    "sus pedidos como línea de factura. El chore añade /health y el tercer E2E de la suite Playwright (flujo "
    "'marcar pagada'), sosteniendo el patrón de 1 E2E por incremento."))

B(sub("PBIs seleccionados — Sprint 9"))
B(table(
    ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"],
    [
        ["HU-FACT-04", "Marcar factura como pagada (fecha + método de pago) + notificación Realtime al residente",
         "Historia", dot("P1"), "3 h", "Gonza Morales"],
        ["HU-FACT-06", "Estado automático 'vencida' (cron diario por fecha) + filtros y badge en /admin/facturacion",
         "Historia", dot("P2"), "2 h", "Gonza Morales"],
        ["HU-FACT-08", "Recordatorio 3 días antes del vencimiento (Edge Function cron diario: Realtime + email)",
         "Historia", dot("P1"), "3 h", "Cortez Zamora"],
        ["PBI-S8-E01", "Descargar comprobante PDF por factura pagada (pdf-lib)",
         "Historia", dot("P2"), "2 h", "Santiago Flores"],
        ["PBI-S8-E02", "Tarjeta de totales del periodo en /admin/facturacion (emitido/cobrado/pendiente/vencido)",
         "Historia", dot("P2"), "1.5 h", "Santiago Flores"],
        ["Chore-T", "Endpoint /health (DB + Auth + Storage) — cierra DoD v2 + tercer E2E 'marcar pagada'",
         "Chore", dot("P2"), "1 h", "Cortez Zamora"],
        ["Buffer", "Reservado para imprevistos del cron (zona horaria, idempotencia) o de la generación del PDF",
         "—", dot("P2", "—"), "2.5 h", "—"],
    ],
    [0.95, 2.75, 0.75, 0.7, 0.55, 1.0]))
B(para("<b>Total estimado:</b> 12.5 horas comprometidas + 2.5 h de buffer respecto al techo de 15 h."))

B(sub("Decisiones técnicas del Sprint"))
B(para("Antes de empezar el desarrollo, el equipo cierra las siguientes decisiones técnicas:"))
B(table(
    ["Decisión", "Detalle", "Registrado en"],
    [
        ["Marcar como pagada",
         "Nuevas columnas en <b>facturas</b>: fecha_pago (date, nullable), metodo_pago (text: efectivo/transferencia/otro), "
         "registrado_por (uuid del admin). Transición permitida pendiente|vencida → pagada. Idempotente: si ya está "
         "pagada, no reescribe fecha_pago. Helper centralizado registrarPagoFactura() inserta en audit_log y dispara "
         "trigger after_factura_paid → notificación tipo='factura_pagada'.",
         "Migración 010 + ADR-009"],
        ["Job diario (vencidas + recordatorios)",
         "Un job diario: pg_cron (06:00, America/Lima) ejecuta una función SQL en dos pasadas — (1) marca estado='vencida' "
         "donde vencimiento &lt; CURRENT_DATE y estado='pendiente'; (2) por cada factura pendiente con "
         "vencimiento = CURRENT_DATE + 3 inserta notificación tipo='factura_por_vencer'; la Edge Function recordatorios-facturas envía el email vía net.http_post (fire-and-forget). Idempotencia "
         "con columna recordatorio_enviado (boolean) para no repetir si el cron corre dos veces.",
         "Migración 010 (pg_cron) + ADR-009"],
        ["Zona horaria de las fechas",
         "Todos los cálculos de fecha del job ('vencida', 'hoy + 3') usan la zona <b>America/Lima</b>, no UTC, para no "
         "adelantar/atrasar el vencimiento un día. Regla elevada a estándar del proyecto en el Retro.",
         "/docs/conventions.md"],
        ["Comprobante PDF",
         "Se genera en el cliente con <b>pdf-lib</b> (no reportlab: el stack de runtime es Deno/JS y reportlab es Python). "
         "Plantilla: logo Zity + datos del residente + desglose + número F-YYYY-MM-NNN + método y fecha de pago + sello "
         "'PAGADO'. Solo disponible si estado='pagada'. Corrige la proyección del roadmap.",
         "Refinement → conventions.md + ADR-010"],
        ["Totales del periodo",
         "RPC totales_facturacion(periodo) suma en servidor (numeric(10,2)) por estado; nunca se hace aritmética de "
         "montos en JS (regla de conventions.md del Retro S8). Tarjeta en la cabecera de /admin/facturacion con "
         "selector de mes. Se recalcula al registrar un pago.",
         "Criterio PBI-S8-E02 + conventions.md"],
        ["Endpoint /health",
         "Ruta serverless /health (Vercel) que verifica DB (SELECT 1), Auth (getUser con service role) y Storage "
         "(list del bucket) y responde JSON {status, db, auth, storage, version}. Sin detalles de error ni secretos en "
         "la respuesta. Cierra el último criterio de DoD v2.",
         "Chore-T + /docs/ops/health.md"],
    ],
    [1.45, 4.05, 1.2]))

B(sub("Desglose de tareas — ¿Cómo?"))

B(para("<b>Gonza Morales Yoel — HU-FACT-04 + HU-FACT-06 (5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Migración 010: columnas fecha_pago, metodo_pago, registrado_por y recordatorio_enviado en facturas + índice "
         "por (estado, vencimiento). El enum de estado ya incluía 'vencida' desde el S8.", "1 h"],
        ["Helper registrarPagoFactura() + trigger after_factura_paid (notificación 'factura_pagada') + tests de "
         "transición: pendiente→pagada, vencida→pagada y doble pago idempotente.", "1 h"],
        ["Acción 'Marcar como pagada' en el drawer/detalle de /admin/facturacion: modal con método y fecha de pago "
         "(default hoy), efecto Realtime visible en la campana del residente.", "1.5 h"],
        ["Primera pasada del job: marca estado='vencida' (vencimiento pasado) + filtro 'Vencidas' y badge rojo en "
         "/admin/facturacion (HU-FACT-06). Tests con seed de fechas.", "1.5 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Cortez Zamora Leonardo — HU-FACT-08 + Chore técnico (4 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Job diario (pg_cron 06:00 America/Lima) — segunda pasada: la función SQL busca "
         "vencimiento = hoy + 3, estado='pendiente', recordatorio_enviado=false → notificación 'factura_por_vencer'; la "
         "Edge Function recordatorios-facturas envía el email vía net.http_post (fire-and-forget) + marca recordatorio_enviado=true.", "3 h"],
        ["Endpoint /health (DB + Auth + Storage) en Vercel + documentación /docs/ops/health.md + verificación manual "
         "post-deploy. Cierra el último criterio de DoD v2.", "0.5 h"],
        ["Tercer E2E de la suite (e2e/facturacion-cobros.spec.ts): admin marca pagada → residente ve badge verde + "
         "notificación + descarga comprobante. Se sube al workflow.", "0.5 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Santiago Flores Carlos — PBI-S8-E01 + PBI-S8-E02 (3.5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Generación de comprobante PDF con pdf-lib: plantilla con logo, datos del residente, desglose, número legible, "
         "método y fecha de pago, sello 'PAGADO'. Botón 'Descargar comprobante' visible solo en facturas pagadas "
         "(tarjeta + detalle).", "2 h"],
        ["Tarjeta de totales del periodo en /admin/facturacion: RPC totales_facturacion(periodo) + UI con "
         "emitido/cobrado/pendiente/vencido y selector de mes. Suma 100% en servidor.", "1.5 h"],
    ],
    [5.9, 0.8]))

B(sub("Riesgos del Sprint 9"))
B(table(
    ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"],
    [
        ["R1", "El cron diario corre dos veces (reintento) y duplica recordatorios o emails.",
         dotline("Media"), dotline("Medio"),
         "Columna recordatorio_enviado (boolean); la pasada filtra recordatorio_enviado=false. Test que ejecuta el job "
         "dos veces y verifica 1 sola notificación por factura."],
        ["R2", "Zona horaria: 'vencida' o 'hoy + 3' calculados en UTC marcarían un día antes/después en Lima (UTC-5).",
         dotline("Alta"), dotline("Medio"),
         "El job fija America/Lima (CURRENT_DATE en la zona configurada). Tests con fechas límite. Documentado en "
         "conventions.md."],
        ["R3", "Marcar pagada dos veces (doble click o dos admins) deja fecha_pago inconsistente.",
         dotline("Media"), dotline("Bajo"),
         "Transición idempotente: si ya está 'pagada', el helper no reescribe y devuelve aviso 'La factura ya estaba "
         "pagada'. El botón se deshabilita tras el primer click."],
        ["R4", "El comprobante PDF se genera de una factura no pagada o con datos de otro residente.",
         dotline("Baja"), dotline("Alto"),
         "El botón solo aparece si estado='pagada'; los datos se arman desde una fila que ya pasó por RLS. Test: "
         "residente_B no puede generar el comprobante de residente_A."],
        ["R5", "El email del recordatorio no llega (Resend caído o sin API key).",
         dotline("Media"), dotline("Bajo"),
         "Fire-and-forget: el email no bloquea la notificación in-app (fuente de verdad). Sin RESEND_API_KEY corre en "
         "dry-run (log). El recordatorio Realtime igual se entrega."],
        ["R6", "/health expone información sensible (versión, estructura interna) públicamente.",
         dotline("Baja"), dotline("Medio"),
         "/health devuelve solo {status, db, auth, storage, version} sin detalles de error ni secretos. Los errores se "
         "loguean en el servidor, no en la respuesta (regla OWASP/DoD)."],
        ["R7", "El número del comprobante PDF no coincide con el F-YYYY-MM-NNN mostrado en la vista.",
         dotline("Baja"), dotline("Bajo"),
         "El PDF reusa el campo numero ya persistido en el S8 (no se recalcula). Test compara el número del PDF con el "
         "de la fila."],
    ],
    [0.4, 1.85, 0.7, 0.7, 3.05]))

# --------------------------------------------------------------------------- #
#  2 · REGISTRO DE DAILY SCRUMS                                                #
# --------------------------------------------------------------------------- #
B(sec(2, "Registro de Daily Scrums"))
B(note("Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y adapta el Sprint Backlog. "
       "Duración máxima: 15 minutos."))
B(goal("Facturación v2: el admin marca pagada (con notificación), un cron diario manda recordatorios 3 días antes y "
       "marca vencidas, el residente descarga su comprobante PDF y el admin ve los totales del periodo.",
       prefix="Sprint Goal:"))

B(sub("Daily Scrum — Día 1 (Lunes)"))
B(meta([
    ("DÍA", "Lunes — Día 1"),
    ("Progreso hacia el objetivo",
     "Migración 010 lista: columnas fecha_pago, metodo_pago, registrado_por y recordatorio_enviado + índice por "
     "(estado, vencimiento). Helper registrarPagoFactura() y trigger after_factura_paid operativos, con tests de "
     "transición (incluye doble pago idempotente). Acción 'Marcar como pagada' en el drawer del admin funcionando: "
     "marca pagada y la campana del residente recibe 'factura_pagada'."),
    ("Plan siguiente 24h",
     "Gonza: primera pasada del cron ('vencida') + filtros/badge en /admin/facturacion. Cortez: Edge Function "
     "programada de recordatorios (hoy + 3) con idempotencia. Santiago: comprobante PDF con pdf-lib (plantilla + "
     "botón en facturas pagadas)."),
    ("Impedimentos",
     "Debate sobre la zona horaria del cron: ¿UTC o America/Lima? Decisión: fijar America/Lima en Postgres para que "
     "'vencida' y 'hoy + 3' coincidan con el calendario del residente. Capturado como edge case en el Refinement."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

B(sub("Daily Scrum — Día 2 (Martes)"))
B(meta([
    ("DÍA", "Martes — Día 2"),
    ("Progreso hacia el objetivo",
     "Job diario completo: la primera pasada marca 'vencida' (probada con seed de fechas pasadas) y la segunda envía "
     "el recordatorio 'factura_por_vencer' (Realtime + email Resend) usando recordatorio_enviado para no duplicar. "
     "Comprobante PDF generándose con pdf-lib (logo + datos + desglose + sello 'PAGADO'). Filtros y badge de vencidas "
     "en /admin/facturacion."),
    ("Plan siguiente 24h",
     "Gonza: pulir badge de vencidas + test del cron corriendo dos veces (idempotencia). Cortez: endpoint /health "
     "(DB + Auth + Storage) + doc + tercer E2E 'marcar pagada'. Santiago: tarjeta de totales del periodo "
     "(RPC totales_facturacion) + selector de mes."),
    ("Impedimentos",
     "Al adelantar el reloj del seed, ejecutar el cron dos veces seguidas generaba 2 notificaciones. Se añadió el "
     "filtro recordatorio_enviado=false; corregido y testeado en el día."),
    ("Ajuste Sprint Backlog",
     "Sin cambios. Se usan ~20 min del buffer para añadir el método de pago al comprobante PDF (sugerencia del PO "
     "en el Refinement)."),
]))

B(sub("Daily Scrum — Día 3 (Miércoles)"))
B(meta([
    ("DÍA", "Miércoles — Día 3"),
    ("Progreso hacia el objetivo",
     "Flujo completo demostrable: Carlos marca pagada la factura de Luz de Laura → Laura recibe 'Tu factura de Luz "
     "fue registrada como pagada' y el badge pasa a verde; descarga su comprobante PDF con sello 'PAGADO'. El seed "
     "adelanta el reloj: aparecen recordatorios 3 días antes y una factura pasa sola a 'vencida' (badge rojo). La "
     "tarjeta de totales del periodo muestra emitido/cobrado/pendiente/vencido. /health responde JSON {status:ok}. "
     "e2e/facturacion-cobros.spec.ts verde en CI (tercer E2E)."),
    ("Plan siguiente 24h",
     "Gonza: guión de la Sprint Review (pagar + simular avance del tiempo). Santiago: validar comprobante PDF y vista "
     "en móvil (360 px). Cortez: ensayar /health (curl) y el E2E en pantalla compartida (mostrar trace)."),
    ("Impedimentos",
     "Laura (stakeholder) preguntó si recibirá también un recordatorio el mismo día del vencimiento, no solo 3 días "
     "antes. Está fuera del scope del S9; se registra como insumo para Notificaciones avanzadas (S12)."),
    ("Ajuste Sprint Backlog",
     "Sin cambios. El recordatorio del día de vencimiento queda como emergente (PBI-S9-E02) para el S12."),
]))

# --------------------------------------------------------------------------- #
#  3 · ACTA DE SPRINT REVIEW                                                   #
# --------------------------------------------------------------------------- #
B(sec(3, "Acta de Sprint Review"))
B(note("Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina adaptaciones futuras. "
       "Es una sesión de trabajo, no una presentación."))
B(meta([
    ("Sprint", "Sprint 9 — Semana 11"),
    ("Fecha", "Viernes — cierre de semana 11"),
    ("Duración", "55 minutos"),
    ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
    ("Scrum Team", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos"),
    ("Stakeholders",
     "Laura Vega (Residente — paga y descarga su comprobante), Carlos Fuentes (Admin — registra pagos y ve totales), "
     "Sra. Rosa Díaz (Dueña — observadora; le interesa el ratio cobrado/pendiente para el dashboard ejecutivo del "
     "S14), Profesor del curso"),
    ("Incremento presentado",
     "Facturación v2 operativa: marcar pagada con notificación Realtime, job diario de recordatorios (3 días antes) + "
     "estado 'vencida' automático, comprobante PDF descargable, tarjeta de totales del periodo, endpoint /health "
     "(cierra DoD v2) y tercer E2E en la suite."),
    ("Modalidad de demo",
     "Dos navegadores en pantalla compartida (admin + residente) + avance simulado del tiempo con un seed especial "
     "para mostrar recordatorios y vencidas. Trace viewer de Playwright para el E2E. curl a /health en vivo."),
]))
B(sub("Guión de demostración"))
B(numlist([
    "Carlos (admin) abre /admin/facturacion. En la cabecera, la tarjeta de totales del periodo '2026-05' muestra "
    "'Emitido $480 · Cobrado $160 · Pendiente $280 · Vencido $40'.",
    "Carlos abre la factura de Luz de Laura ($120, pendiente) y pulsa 'Marcar como pagada': elige método "
    "'transferencia', fecha hoy y confirma. La tarjeta de totales recalcula al instante (Cobrado sube, Pendiente baja).",
    "En el navegador derecho, Laura recibe en su campana 'Tu factura de Luz ($120) fue registrada como pagada'. El "
    "badge de la tarjeta pasa de ámbar 'Pendiente' a verde 'Pagada'.",
    "Laura abre el detalle de la factura pagada y pulsa 'Descargar comprobante'. Se descarga un PDF con logo Zity, sus "
    "datos, el desglose, el número F-2026-05-001, el método de pago y el sello 'PAGADO' con la fecha.",
    "El equipo carga un seed que adelanta el reloj 3 días: en el panel de Laura aparece 'Tu factura de Agua vence en "
    "3 días (30/05)'. Carlos ve el mismo recordatorio reflejado.",
    "El seed adelanta el reloj más allá del vencimiento de otra factura: el job diario la marca sola como 'vencida' "
    "(badge rojo) y aparece bajo el filtro 'Vencidas' en /admin/facturacion.",
    "Cortez ejecuta <font face='Courier'>curl https://staging.zity.app/health</font> en vivo: responde "
    "{status:ok, db:ok, auth:ok, storage:ok, version:...}. Con esto se cierra el último criterio de DoD v2.",
    "Trace viewer de Playwright: e2e/facturacion-cobros.spec.ts pasando (login admin → marcar pagada → login "
    "residente → ve badge verde + notificación + descarga comprobante). Tercer E2E de la suite, verde y reproducible.",
]))
B(goal(
    chk() + " CUMPLIDO: Facturación v2 operativa — marcar pagada con notificación Realtime, job diario de "
    "recordatorios (3 días antes) y estado 'vencida' automático, comprobante PDF descargable y tarjeta de totales del "
    "periodo. /health en staging cierra DoD v2 (ahora al 100% de sus criterios core). Tercer E2E en la suite "
    "Playwright. Sprint cerrado usando ~20 min del buffer."))

B(sub("Feedback de stakeholders"))
B(para("<b>Laura Vega (Residente)</b>"))
B(bullets([
    "«El recordatorio 3 días antes me da tiempo real para organizar el pago — antes me enteraba el mismo día del "
    "vencimiento.» → Validación.",
    "«Descargar el comprobante con el sello 'PAGADO' es justo lo que pedí en el Sprint anterior; lo guardo para mis "
    "registros.» → Validación (PBI-S8-E01 cerrado).",
    "«¿Podría pagar dentro de la app, no solo que el admin registre el pago?» → Fuera de alcance del curso (pagos en "
    "línea, exclusión del PRD). Se registra y se descarta con justificación.",
], marker="•"))
B(para("<b>Carlos Fuentes (Administrador)</b>"))
B(bullets([
    "«Ver emitido/cobrado/pendiente del mes sin sacar cuentas me dice al instante cómo va la cobranza.» → Validación "
    "(PBI-S8-E02 cerrado).",
    "«Que las facturas se marquen vencidas solas me quita trabajo manual y evita olvidos.» → Validación.",
    "«Me gustaría exportar los totales del periodo a CSV, como hago con solicitudes.» → PBI-S9-E01: 'Exportar totales "
    "de facturación a CSV'. P3, 1.5 h. Candidato para Sprint 13.",
], marker="•"))
B(para("<b>Sra. Rosa Díaz (Dueña — observadora)</b>"))
B(bullets([
    "«El ratio cobrado/pendiente es exactamente el número que quiero ver en grande en el dashboard ejecutivo del "
    "Sprint 14.» → Validación + semilla del S14.",
], marker="•"))

B(sub("Decisiones de adaptación del Product Backlog"))
B(table(
    ["Decisión", "Detalle"],
    [
        ["DoD v2 cerrada", "Con /health en staging, DoD v2 queda 100% cumplida en sus criterios core. A partir del "
                           "Sprint 11 entra DoD v3."],
        ["Cero hotfixes", "Quinto Sprint consecutivo sin hotfixes — práctica consolidada."],
        ["Emergentes del S8 cerrados", "PBI-S8-E01 (comprobante PDF) y PBI-S8-E02 (totales del periodo) entregados "
                                       "dentro de Facturación v2."],
        ["PBI-S9-E01 (NUEVA)", "Exportar totales de facturación a CSV (feedback Carlos). P3, 1.5 h. Candidato S13."],
        ["PBI-S9-E02 (NUEVA)", "Recordatorio también el día del vencimiento, no solo 3 días antes (feedback Laura). "
                               "Se absorbe en Notificaciones avanzadas (S12)."],
        ["Suite Playwright crece", "Tercer E2E entregado (facturacion-cobros). Patrón sostenido: 1 E2E por incremento, "
                                   "como chore."],
        ["Sprint 10 confirmado", "Tienda interna v1: BD productos/pedidos/pedido_items + RLS, admin gestiona catálogo "
                                 "(alta/baja/stock/precio + foto), residente navega con filtros y búsqueda. Chore: CD "
                                 "a staging (deploy automático en merge a main)."],
    ],
    [1.7, 5.0]))

# --------------------------------------------------------------------------- #
#  4 · ACTA DE SPRINT RETROSPECTIVE                                            #
# --------------------------------------------------------------------------- #
B(sec(4, "Acta de Sprint Retrospective"))
B(note("Referencia Scrum: la Retrospective planifica formas de aumentar calidad y efectividad. Los cambios más "
       "impactantes pueden entrar al Sprint Backlog del próximo Sprint."))
B(meta([
    ("Sprint", "Sprint 9 — Semana 11"),
    ("Fecha", "Viernes — después de la Sprint Review"),
    ("Duración", "30 minutos"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
]))
B(sub(chk() + " ¿Qué salió bien?"))
B(bullets([
    "Las tres acciones del Retro S8 se aplicaron en este Sprint: conventions.md ya documentaba 'numeric(10,2) + sumar "
    "en servidor', el stakeholder (Laura) entró al Planning y el Refinement incluyó 'edge cases del dominio'. Las tres "
    "ahorraron debate.",
    "Tener a Laura en el Planning capturó el método de pago en el comprobante a tiempo (cabía en el buffer), validando "
    "la Acción 2 del Retro S8.",
    "Reusar la infraestructura de notificaciones del S6 por tercera vez (ahora 'factura_pagada' y 'factura_por_vencer') "
    "fue trivial: solo nuevos tipos en el switch.",
    "Unificar vencidas + recordatorios en una sola Edge Function diaria evitó duplicar la lógica de fechas y mantuvo "
    "el cron simple.",
    "/health cerró DoD v2 con 1 h de chore — la deuda técnica que arrastrábamos desde el S4 quedó saldada sin un "
    "sprint dedicado.",
    "Quinto Sprint consecutivo sin hotfixes.",
], marker="•"))
B(sub(xmk() + " ¿Qué salió mal?"))
B(bullets([
    "La zona horaria del cron costó 15 min de debate el Día 1. Aunque el Refinement marcó 'edge cases de fecha', no "
    "habíamos fijado la zona como decisión previa. Se añadió a conventions.md la regla 'todo job de fecha corre en "
    "America/Lima'.",
    "pdf-lib tiene una curva inicial para posicionar texto (coordenadas absolutas): el primer intento descuadró el "
    "sello 'PAGADO'. Faltó un spike corto de la librería en el Refinement.",
    "El seed de 'avance del tiempo' se armó a mano para la demo; sería mejor un script reutilizable para futuras "
    "Reviews que dependan del calendario.",
], marker="•"))

B(sub("Acciones de mejora (máx. 3)"))
B(para("<b>Acción 1 — Script de seed para simular avance del tiempo</b>"))
B(meta([
    ("Descripción", "Crear <font face='Courier'>npm run seed:tiempo</font> que adelante fechas de emisión/vencimiento "
                    "de forma reproducible, para demos que dependan del calendario (recordatorios, vencidas). Evita "
                    "armar el seed a mano en cada Review."),
    ("Dueño", "Cortez Zamora Leonardo"),
    ("Evidencia", "Script seed:tiempo documentado en README + usado en la demo del S10/S11"),
    ("Fecha", "Sprint 10"),
]))
B(para("<b>Acción 2 — Spike corto de librería nueva en el Refinement</b>"))
B(meta([
    ("Descripción", "Cuando un PBI introduce una librería nueva (pdf-lib en este Sprint), el Refinement reserva 15 min "
                    "para un 'hola mundo' de la librería antes del Planning. Evita la curva en pleno Sprint."),
    ("Dueño", "Meza Pelaez Carlos"),
    ("Evidencia", "El acta del Refinement del S10 (subida de fotos de producto a Storage) incluye un spike previo"),
    ("Fecha", "Sprint 10"),
]))
B(para("<b>Acción 3 — Mantener conventions.md como fuente de decisiones recurrentes</b>"))
B(meta([
    ("Descripción", "Seguir alimentando /docs/conventions.md (creado en el Retro S8): ya tiene decimales, zona horaria "
                    "y naming de RPCs. Cada Retro añade lo que se haya re-discutido; se revisa en el Refinement."),
    ("Dueño", "Cortez Zamora Leonardo"),
    ("Evidencia", "conventions.md con ≥ 8 decisiones documentadas al cierre del S10"),
    ("Fecha", "Continuo (revisión S10)"),
]))

B(sub("Verificación DoD v2"))
B(table(
    ["Criterio", "Estado"],
    [
        ["Todo lo de DoD v1 (lint, unit tests, README, manejo errores, seed, deploy preview)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Pruebas de integración para flujos críticos (marcar pagada, cron vencidas/recordatorios, totales)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — 9 tests de integración nuevos</b></font>"],
        ["Cobertura ≥ 60% en módulos core (src/lib/facturas.ts)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — 76%</b></font>"],
        ["Endpoint /health disponible en staging",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — cerrado en este Sprint (chore)</b></font>"],
        ["Variables de entorno vía Secrets CI/CD — sin hardcode",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — sin variables nuevas</b></font>"],
        ["Despliegue staging con verificación post-deploy",
         "<font name='%s' color='#C8862A'>■</font> <font color='#C8862A'><b>Parcial — /health habilita la "
         "verificación; el deploy automático (CD) llega en el chore del S10</b></font>" % "ZBody"],
        ["tsc --noEmit pasa sin errores en CI",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Playwright: E2E en pipeline",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — 3 E2E (crear-solicitud + facturacion + "
         "facturacion-cobros)</b></font>"],
        ["ADR-009 (ciclo de cobro y jobs) + ADR-010 (comprobante PDF) documentados",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — adicional a DoD v2</b></font>"],
    ],
    [4.4, 2.3]))
B(goal(
    "DoD v2 al 100% en sus criterios core: /health cerró el último pendiente. El único matiz (verificación "
    "post-deploy automática) se formaliza con el CD del Sprint 10; el deploy manual documentado sigue vigente. A "
    "partir del Sprint 11 entra DoD v3. Sprint 9 cerrado usando ~20 min del buffer."))

# --------------------------------------------------------------------------- #
#  5 · HISTORIAS DE USUARIO — SPRINT 9                                         #
# --------------------------------------------------------------------------- #
B(sec(5, "Historias de Usuario — Sprint 9"))
B(sub("Módulo FACTURACIÓN — Sprint 9 (v2)"))

B(hucard(
    "HU-FACT-04", "Marcar factura como pagada + notificación Realtime", "Sprint 9 · 3 h", "P1 · 3 h",
    "Como <b>administrador</b>, quiero <b>registrar el pago de una factura y que el residente sea notificado</b>, "
    "para cerrar el ciclo de cobro con trazabilidad y sin avisos manuales.",
    [
        "Acción 'Marcar como pagada' en el drawer/detalle de /admin/facturacion, disponible solo para facturas en "
        "estado 'pendiente' o 'vencida'.",
        "Modal con método de pago (efectivo / transferencia / otro) y fecha de pago (default: hoy). Al confirmar: "
        "estado → 'pagada', fecha_pago, metodo_pago y registrado_por = admin.",
        "Transición idempotente: si la factura ya está pagada, no se reescribe fecha_pago y se muestra el aviso "
        "'La factura ya estaba pagada'.",
        "Trigger after_factura_paid inserta notificación tipo='factura_pagada' (reusa Realtime del S6); el residente "
        "la recibe en su campana en &lt; 1.5 s.",
        "Toda la transición pasa por el helper registrarPagoFactura(), que registra en audit_log.",
        "Tests de integración: pendiente→pagada, vencida→pagada, doble pago idempotente y notificación entregada al "
        "residente correcto.",
    ],
    "Carlos marcó pagada la factura de Luz de Laura en la Review; la campana de Laura recibió 'factura_pagada' y el "
    "badge pasó a verde."))

B(hucard(
    "HU-FACT-06", "Estado automático 'vencida' + filtros en admin", "Sprint 9 · 2 h", "P2 · 2 h",
    "Como <b>sistema</b>, quiero <b>marcar automáticamente como 'vencida' toda factura impaga cuyo vencimiento ya "
    "pasó, y que el admin pueda filtrarlas</b>, para que el estado refleje la realidad sin intervención manual.",
    [
        "Primera pasada del job diario (pg_cron, 06:00 America/Lima) marca estado='vencida' donde vencimiento &lt; "
        "CURRENT_DATE y estado='pendiente'.",
        "El cálculo de fechas usa la zona America/Lima (no UTC) para no adelantar ni atrasar el vencimiento un día.",
        "/admin/facturacion incluye filtro 'Vencidas' y badge rojo en las facturas vencidas.",
        "/residente/facturas muestra la factura vencida con badge rojo (reusa la vista del S8).",
        "Idempotente: re-ejecutar el job no cambia facturas ya pagadas ni re-marca las ya vencidas.",
        "Tests con seed de fechas (vencimiento ayer / hoy / mañana) verifican el marcado correcto.",
        "Consolida la HU-FACT-07 del roadmap (filtros y badge de vencidas) en esta misma historia, por compartir la "
        "lógica de fechas y la vista de /admin/facturacion.",
    ],
    "En la Review, el seed adelantó el reloj y una factura pasó sola a 'vencida' con badge rojo, filtrable desde el "
    "panel admin."))

B(hucard(
    "HU-FACT-08", "Recordatorio 3 días antes del vencimiento", "Sprint 9 · 3 h", "P1 · 3 h",
    "Como <b>residente</b>, quiero <b>recibir un recordatorio automático 3 días antes de que venza una factura</b>, "
    "para pagar a tiempo y evitar que se marque como vencida.",
    [
        "Segunda pasada del mismo job diario: por cada factura con estado='pendiente', vencimiento = CURRENT_DATE + 3 "
        "y recordatorio_enviado=false → notificación tipo='factura_por_vencer'.",
        "La notificación dispara también un email simulado vía Resend (fire-and-forget; si falla, la notificación "
        "in-app igual se entrega).",
        "Idempotencia: tras enviar, recordatorio_enviado=true; re-ejecutar el job no duplica recordatorios ni emails.",
        "Click en la notificación navega a /residente/facturas/:id.",
        "Test de integración: ejecutar el job dos veces seguidas produce exactamente 1 recordatorio por factura.",
    ],
    "El seed de avance del tiempo mostró 'Tu factura de Agua vence en 3 días' en la campana de Laura; ejecutar el cron "
    "dos veces no lo duplicó."))

B(hucard(
    "PBI-S8-E01", "Descargar comprobante PDF por factura pagada", "Sprint 9 · 2 h", "P2 · 2 h",
    "Como <b>residente</b>, quiero <b>descargar un comprobante PDF de cada factura pagada</b>, para tener un soporte "
    "de mis pagos.",
    [
        "Botón 'Descargar comprobante' visible solo en facturas con estado='pagada' (en la tarjeta y en el detalle).",
        "El PDF se genera en el cliente con pdf-lib: logo Zity, datos del residente, desglose (tipo, periodo, monto), "
        "número legible F-YYYY-MM-NNN, método y fecha de pago, y sello 'PAGADO'.",
        "El número del comprobante coincide con el campo numero ya persistido de la factura (no se recalcula).",
        "Los datos provienen de una fila que pasó por RLS; un residente no puede generar el comprobante de otro.",
        "Nota: corrige la proyección del roadmap (reportlab → pdf-lib) por compatibilidad con el stack Deno/JS; "
        "registrado en /docs/conventions.md y ADR-010.",
    ],
    "Laura descargó el comprobante de su factura de Luz pagada en la Review, con sello 'PAGADO' y número F-2026-05-001."))

B(hucard(
    "PBI-S8-E02", "Tarjeta de totales del periodo en admin", "Sprint 9 · 1.5 h", "P2 · 1.5 h",
    "Como <b>administrador</b>, quiero <b>ver los totales del periodo (emitido, cobrado, pendiente, vencido)</b>, para "
    "saber de un vistazo cómo va la cobranza del mes.",
    [
        "RPC totales_facturacion(periodo) suma en servidor (numeric(10,2)) los montos por estado; nunca se hace "
        "aritmética de montos en JS (regla de conventions.md).",
        "Tarjeta en la cabecera de /admin/facturacion con emitido / cobrado / pendiente / vencido y selector de "
        "periodo (mes).",
        "La tarjeta se recalcula al marcar una factura como pagada (efecto inmediato).",
        "Test del RPC con un set conocido de facturas: cobrado + pendiente + vencido = emitido.",
    ],
    "La tarjeta mostró emitido/cobrado/pendiente/vencido del periodo y recalculó en vivo al registrar un pago durante "
    "la demo."))

B(para(
    "<b>Chore técnico del Sprint:</b> endpoint /health (DB + Auth + Storage) en Vercel que responde JSON con el estado "
    "de cada dependencia y la versión — cierra el último criterio core de DoD v2 — más el tercer E2E de la suite Playwright "
    "(e2e/facturacion-cobros.spec.ts: admin marca pagada → residente ve badge verde + notificación + descarga "
    "comprobante). 1 h, P2. La suite pasa de 2 a 3 E2E sin volverse protagonista."))

B(sub("PBIs emergentes — entran en Sprints futuros"))
B(table(
    ["ID", "Historia", "Prior.", "Horas est.", "Sprint"],
    [
        ["PBI-S9-E01", "Exportar totales de facturación a CSV (feedback Carlos)", dot("P3"), "1.5 h", "13"],
        ["PBI-S9-E02", "Recordatorio también el día del vencimiento (feedback Laura)", dot("P2"), "1 h", "12"],
        ["PBI-S6-E03", "Sesiones activas + cerrar todas al cambiar contraseña", dot("P2"), "2 h", "13"],
        ["PBI-S6-E01", "Indicador de presencia en panel admin (Supabase Presence)", dot("P3"), "2 h", "12"],
        ["PBI-S6-E02", "Sonido + haptic feedback opcional al recibir notificación", dot("P3"), "2 h", "12"],
        ["PBI-S7-E01", "Filtros por categoría en el dashboard de métricas", dot("P2"), "1 h", "13"],
        ["PBI-S6-E04", "Resumen diario por email a técnicos con asignaciones pendientes", dot("P3"), "2 h",
         "Sin asignar"],
    ],
    [1.05, 3.3, 0.7, 0.85, 0.8]))

# --------------------------------------------------------------------------- #
#  6 · ESTADO DEL BACKLOG TRAS SPRINT 9                                        #
# --------------------------------------------------------------------------- #
B(sec(6, "Estado del Backlog tras Sprint 9"))
B(sub("Progreso acumulado"))
B(table(
    ["Sprint", "Horas", "Incremento entregado", "Estado"],
    [
        ["Sprint 0", "12 h", "Setup técnico + CI + ADRs + Supabase configurado",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 1", "15 h", "Módulo Auth: registro 2 pasos + login por rol + recuperación",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 2", "14 h", "Panel admin + gestión de usuarios + bloqueo/desbloqueo",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 3", "13 h", "Mantenimiento v1: crear solicitud con foto + vista admin",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 4", "13 h", "Mantenimiento v2: asignación + vista técnico + cierre + cámara + confirmación",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 5", "13 h", "Trazabilidad: audit log + historial + perfil + foto al rechazar",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 6", "13 h", "Comunicación Realtime: notificaciones + email + foto cierre + alerta admin",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 7", "13 h", "Métricas y Dashboard visual: KPIs + gráficas Recharts + CSV + vista materializada",
         "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 8", "13 h", "Facturación v1: tabla facturas + emisión individual/lote + vista residente + "
         "notificación Realtime", "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 9", "12.5 h", star() + " Facturación v2: marcar pagada + recordatorios + vencida automática + "
         "comprobante PDF + totales + /health", "<font color='#3E7D3A'>" + chk() + " Completado</font>"],
        ["Sprint 10", "13 h (est.)", "Tienda interna v1: BD + catálogo admin + vista residente con filtros + CD",
         "<font color='#C8862A'>→ Próximo</font>"],
        ["Sprints 11–14", "52 h (est.)", "Tienda v2 · Notificaciones avanzadas · Panel integral residente · " +
         star() + " Dashboard ejecutivo + RC", "<font color='#C8862A'>■ Planificado</font>"],
    ],
    [0.95, 0.85, 3.7, 1.2]))
B(para("<b>Total invertido:</b> 131.5 horas en 10 sprints (Sprint 0 → Sprint 9)."))
B(para("<b>Total restante:</b> ~65 horas estimadas en 5 sprints."))
B(para("<b>Velocidad promedio:</b> 13.2 horas/sprint (estable por séptimo sprint consecutivo)."))

B(sub("Roadmap actualizado tras Sprint 9 Review"))
B(table(
    ["Sprint", "Sem.", "Objetivo principal — Entregable funcional"],
    [
        ["S10", "12", "Tienda interna v1: admin gestiona catálogo (alta/baja/stock/precio + foto) + residente navega "
         "con filtros y búsqueda + chore CD (deploy automático en merge a main)"],
        ["S11", "13", "Tienda interna v2: carrito + descuento atómico de stock + pedido se suma a la factura mensual "
         "(primera aplicación de DoD v3)"],
        ["S12", "14", "Notificaciones avanzadas: Web Push + presencia + sonido/haptic + preferencias (absorbe "
         "PBI-S9-E02: recordatorio el día del vencimiento)"],
        ["S13", "15", "Panel integral del residente + sesiones activas + filtros por categoría en métricas (S7-E01) + "
         "export de totales a CSV (S9-E01)"],
        ["S14", "16", star() + " Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) + Release "
         "Candidate + demo final integral"],
    ],
    [0.6, 0.5, 5.6]))
B(note("Nota: los dos emergentes del S9 se reubican — PBI-S9-E01 (export CSV de totales) en S13 y PBI-S9-E02 "
       "(recordatorio el día de vencimiento) en S12, junto a Notificaciones avanzadas. La estructura de facturas "
       "queda cerrada y lista para que la Tienda (S11) sume pedidos como línea de factura."))

B(sub("Vista previa Sprint 10 — Tienda interna v1 (catálogo)"))
B(goal("Sprint 10: abrir la tienda interna del edificio. El admin gestiona el catálogo (alta/baja/stock/precio + foto) "
       "desde /admin/tienda y el residente navega /residente/tienda en grilla con filtros y búsqueda. "
       "Chore: CD a staging (deploy automático en merge a main)."))
B(table(
    ["PBI", "Historia", "Horas est.", "Prior."],
    [
        ["HU-TIENDA-01", "BD productos / pedidos / pedido_items + RLS por rol", "2 h", dot("P1")],
        ["HU-TIENDA-02", "Admin gestiona catálogo: alta/baja/stock/precio + foto del producto", "3 h", dot("P1")],
        ["HU-TIENDA-05", "Vista /residente/tienda con catálogo en grilla de tarjetas", "3 h", dot("P1")],
        ["HU-TIENDA-06", "Filtros del catálogo (categoría, disponibilidad) + búsqueda por nombre", "2 h", dot("P2")],
        ["Mejora", "Indicador visual de stock bajo (≤ 5 unidades) en la tarjeta del producto", "1 h", dot("P3")],
        ["Chore-T", "CD: deploy automático en merge a main (Vercel)", "2 h", dot("P2")],
    ],
    [1.15, 3.85, 0.85, 0.85]))
B(para("<b>Total estimado Sprint 10:</b> 13 horas (2 h de buffer)."))

B(sub("Variables de entorno acumuladas al Sprint 9"))
B(para("No hay variables nuevas en este Sprint. /health reusa SUPABASE_SERVICE_ROLE_KEY y el cron reusa "
       "RESEND_API_KEY / RESEND_FROM_ADDRESS. Las anteriores siguen vigentes:"))
B(table(
    ["Variable", "Descripción", "Dónde se usa", "Desde"],
    [
        ["VITE_SUPABASE_URL", "URL pública del proyecto Supabase", "Frontend (cliente JS) · dummy en CI", "Sprint 0"],
        ["VITE_SUPABASE_ANON_KEY", "Clave anónima de Supabase", "Frontend (cliente JS) · dummy en CI", "Sprint 0"],
        ["SUPABASE_SERVICE_ROLE_KEY", "Clave de servicio (admin) de Supabase", "Edge Functions (servidor) · /health",
         "Sprint 3"],
        ["RESEND_API_KEY", "Clave de API de Resend para emails", "Edge Functions (recordatorio / factura)", "Sprint 2"],
        ["RESEND_FROM_ADDRESS", "Remitente de los emails de notificaciones", "Edge Function recordatorios-facturas",
         "Sprint 6"],
        ["SUPABASE_DB_URL", "URL de conexión directa a la BD", "Migraciones locales · pg_cron", "Sprint 0"],
    ],
    [1.65, 2.0, 2.05, 1.0]))
B(para("Variables proyectadas para futuros Sprints:"))
B(bullets([
    "Sprint 10 (CD): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID para el deploy automático al mergear a main.",
    "Sprint 12 (Web Push): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY para las notificaciones push.",
], marker="•"))
B(note("Ninguna de estas variables debe aparecer en el código fuente ni en commits. Todas van en .env.local (local) "
       "y en Secrets de GitHub/Vercel (CI/CD)."))

B(finalnote("— Zity · Artefactos Sprint 9 · Documento vivo — actualizar en cada Sprint Review —"))

# --------------------------------------------------------------------------- #
OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "sprints", "Zity_Sprint9_Artefactos.pdf"))
build_pdf(BLOCKS, FOOT, OUT)
print("OK ->", OUT)
