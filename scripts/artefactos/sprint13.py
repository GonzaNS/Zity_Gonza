# -*- coding: utf-8 -*-
"""
Artefactos Scrum — Zity · Sprint 13 (Semana 15) · Panel integral del residente.

Contenido derivado de:
  - Zity_Roadmap_Sprints.pdf  (Sprint 13 — Panel integral del residente: solicitudes + facturas + pedidos en una
    sola vista + sesiones activas; chore Lighthouse ≥ 80).
  - Continuidad con Zity_Sprint12_Artefactos (Módulo Comunicación cerrado, DoD v3 segunda aplicación, acciones del
    Retro S12: política de notificaciones, sanitización como patrón, Lighthouse temprano).
  - DoD v3 (tercera aplicación): el chore Lighthouse ≥ 80 cubre el criterio de performance.

Addendum del profesor (debajo de los PBIs normales del Sprint, igual que el Addendum del S10):
  El profesor observó que, en el pago simulado del S10, el residente tiene que reingresar los datos de su tarjeta
  cada vez. Recomendó un apartado para guardar tarjetas del residente y reutilizarlas de forma automática al pagar
  una factura. Se implementa con TOKENIZACIÓN SEGURA: solo se guardan alias, marca, titular, últimos 4 dígitos,
  vencimiento y un token simulado; nunca el número completo (PAN) ni el CVV (coherente con el chore OWASP del S12
  y con el no-PII del S11).

Render:  python sprint13.py   (desde scripts/artefactos/)
"""
import os
from zity_artefactos import (
    cover, sec, meta, goal, note, sub, para, bullets, numlist, table, spacer,
    finalnote, hucard, dot, dotline, chk, xmk, star, build_pdf,
)

FOOT = " · Artefactos Scrum · Sprint 13"

BLOCKS = []
B = BLOCKS.append

# --------------------------------------------------------------------------- #
#  PORTADA                                                                     #
# --------------------------------------------------------------------------- #
B(cover(
    "Sprint 13",
    "Artefactos Scrum — Sprint 13",
    "Panel integral del residente: una sola vista (su 'home') con 3 tarjetas —solicitudes activas, facturas "
    "pendientes y pedidos del mes— que reemplaza el dashboard simple, más sesiones activas · Addendum del profesor: "
    "métodos de pago — el residente guarda sus tarjetas (con tokenización segura) y las reutiliza al pagar una "
    "factura, sin reescribirlas cada vez · Chore: auditoría Lighthouse ≥ 80 · DoD v3 (tercera aplicación)",
    [
        ("Producto", "Zity"),
        ("Sprint", "Sprint 13 — Semana 15"),
        ("Stack", "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                  "Resend · Vercel · GitHub Actions · Vitest · Playwright (E2E, DoD v3) · "
                  "Recharts (S7) · pdf-lib (S9) · pg_cron (S9) · Lighthouse CI (S13)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers", "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "13 horas comprometidas (2 h de buffer) + 7 horas del Addendum del profesor = 20 h"),
        ("DoD aplicable", "DoD v3 — tercera aplicación (suma Lighthouse ≥ 80 como criterio de performance, además de "
                          "E2E, regresión, no-PII y OWASP ya vigentes desde el S11–S12)"),
        ("Nuevo en este sprint",
         "Panel integral del residente: la ruta /residente pasa a ser un dashboard con 3 tarjetas (solicitudes "
         "activas, facturas pendientes, pedidos del mes) calculadas con vistas Postgres ligeras · pestaña 'Sesiones' "
         "en /perfil con 'cerrar todas las demás' (PBI-S6-E03) · Addendum del profesor: tabla metodos_pago con "
         "tokenización + RLS, vista 'Mis tarjetas' (CRUD + predeterminada) y pago de factura que precarga la tarjeta "
         "guardada"),
        ("Chore técnico del Sprint",
         "Auditoría Lighthouse ≥ 80 en /residente (corrida desde el día 1, Acción 3 del Retro S12) + revisión global "
         "de cobertura de tests. Cumple el criterio de performance de DoD v3. 1 h, P2."),
        ("Addendum del profesor",
         "Métodos de pago — tarjetas guardadas. El profesor observó que en el pago simulado (Addendum del S10) el "
         "residente reingresa su tarjeta cada vez; recomendó guardarlas y reutilizarlas automáticamente. Se "
         "implementa con tokenización segura (solo marca + últimos 4 + token; nunca PAN ni CVV). 3 HUs, ~7 h, debajo "
         "de los PBIs normales del Sprint (mismo formato que el Addendum del Sprint 10)."),
        ("Variables nuevas",
         "Ninguna. El panel reusa datos ya disponibles vía vistas Postgres; el Addendum reusa el pago simulado del "
         "S10 con un token simulado generado en servidor (sin pasarela de pago real)."),
        ("Emergentes diferidos",
         "El Addendum del profesor consume el buffer del Sprint, por lo que los emergentes priorizados del S12 "
         "(quick view S10-E01, desglose del pedido S11-E01, export de pedidos S11-E03, anuncios por email S12-E01, "
         "indicador de lectura S12-E02) se reubican a post-curso o compiten por el cierre del S14 según el PO."),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ],
))

# --------------------------------------------------------------------------- #
#  1 · ACTA DE SPRINT PLANNING                                                 #
# --------------------------------------------------------------------------- #
B(sec(1, "Acta de Sprint Planning"))
B(meta([
    ("Sprint", "Sprint 13 — Semana 15"),
    ("Fecha", "Lunes — inicio de semana 15"),
    ("Duración del evento", "75 minutos + 30 min de Refinement con spike de tokenización de tarjetas (qué datos "
                            "guardar y cuáles nunca) y validación del feed en móvil"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Asistentes", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
    ("Stakeholder invitado",
     "Laura Vega (Residente ficticia) — como usuaria diaria del 'home', valida qué información necesita ver de un "
     "vistazo y cómo quiere pagar sus facturas sin reescribir la tarjeta cada vez. Sexta aplicación de la Acción 2 "
     "del Retro S8."),
    ("Capacidad", "15 horas disponibles · se comprometen 13 h (2 h de buffer) + 7 h del Addendum del profesor = 20 h "
                  "(Sprint excepcional, igual que el S10 con su Addendum)"),
    ("Entrada",
     "Product Backlog tras Sprint 12 Review. El Módulo Comunicación quedó cerrado (tablón de anuncios en vivo) y la "
     "DoD v3 va por su segunda aplicación (E2E + no-PII + OWASP). El roadmap fija el S13 como el panel integral del "
     "residente y el chore Lighthouse. Sobre esa base, el profesor pidió añadir —debajo de los PBIs normales— un "
     "apartado para guardar tarjetas del residente y reutilizarlas al pagar facturas; se acepta como Addendum del "
     "Sprint (mismo tratamiento que el Addendum del S10)."),
    ("Refinement previo",
     "Novena aplicación de la práctica. 'Edge cases del dominio': «¿qué datos de la tarjeta se pueden guardar y "
     "cuáles no se deben persistir nunca?», «¿el CVV se guarda?» (no), «¿una sola tarjeta predeterminada por "
     "residente?», «¿el panel recalcula totales en cliente o en BD?». Spike de tokenización: se decide guardar solo "
     "marca + titular + últimos 4 dígitos + vencimiento + token simulado, nunca el PAN completo ni el CVV. Se reusa "
     "el patrón no-PII del S11 y la sanitización como patrón (Acción 2 del Retro S12)."),
]))
B(goal(
    "Dar al residente una vista única (su 'home') con 3 tarjetas —solicitudes activas, facturas pendientes y pedidos "
    "del mes— que reemplaza el dashboard simple, e incluir las sesiones activas. En paralelo, atender la sugerencia "
    "del profesor: que el residente guarde sus tarjetas (con tokenización segura) y las reutilice al pagar una "
    "factura sin reescribirlas. El chore Lighthouse ≥ 80 cubre el criterio de performance de DoD v3.",
    prefix="Sprint Goal:"))
B(note(
    "Nota: Tercera aplicación de DoD v3. El chore Lighthouse ≥ 80 cubre el criterio de performance (corrido desde el "
    "día 1, Acción 3 del Retro S12). El Addendum del profesor reusa el pago simulado del S10 y aplica tokenización "
    "(sin PAN ni CVV), reforzando el no-PII del S11 y el criterio de datos sensibles del OWASP del S12. Solo queda el "
    "release candidate (S14) para completar la DoD v3."))

B(sub("PBIs seleccionados — Sprint 13 (comprometidos)"))
B(table(
    ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"],
    [
        ["HU-HOME-01", "Vista /residente como dashboard integral con 3 tarjetas (layout grid responsive)",
         "Historia", dot("P1"), "4 h", "Santiago Flores"],
        ["HU-HOME-02", "Tarjeta 'Solicitudes activas' con badge de estado + últimos 3 cambios",
         "Historia", dot("P1"), "2 h", "Cortez Zamora"],
        ["HU-HOME-03", "Tarjeta 'Facturas pendientes' con total a pagar y próximo vencimiento",
         "Historia", dot("P1"), "2 h", "Gonza Morales"],
        ["HU-HOME-04", "Tarjeta 'Pedidos del mes' con resumen de unidades y total acumulado",
         "Historia", dot("P1"), "2 h", "Santiago Flores"],
        ["PBI-S6-E03", "Sesiones activas + cerrar todas las demás al cambiar contraseña",
         "Historia", dot("P2"), "2 h", "Cortez Zamora"],
        ["Chore-T", "Lighthouse ≥ 80 en /residente (desde el día 1) + revisión de cobertura de tests",
         "Chore", dot("P2"), "1 h", "Cortez Zamora"],
        ["Buffer", "Imprevistos del panel / vistas Postgres + ajustes de responsive",
         "—", dot("P2", "—"), "2 h", "—"],
    ],
    [0.95, 2.75, 0.75, 0.7, 0.55, 1.0]))
B(para("<b>Total comprometido:</b> 13 horas + 2 h de buffer."))

B(sub("Addendum del profesor — Métodos de pago (tarjetas guardadas)"))
B(para(
    "Debajo de los PBIs normales del Sprint, el equipo incorpora la sugerencia del profesor como Addendum (mismo "
    "tratamiento que el Addendum del Sprint 10). <b>Observación del profesor:</b> en el pago simulado (Addendum del "
    "S10) el residente debe reingresar los datos de su tarjeta cada vez que paga una factura. <b>Recomendación:</b> "
    "un apartado donde el residente guarde sus tarjetas y estas se usen de forma automática al pagar. Se implementa "
    "con <b>tokenización segura</b>: solo se persiste alias, marca, titular, últimos 4 dígitos, vencimiento y un "
    "token simulado; <b>nunca el número completo (PAN) ni el CVV</b>."))
B(table(
    ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"],
    [
        ["HU-PAGO-01", "Modelado BD: tabla metodos_pago (tokenización, sin PAN ni CVV) + RLS (cada residente solo "
         "las suyas)", "Addendum", dot("P1"), "2 h", "Gonza Morales"],
        ["HU-PAGO-02", "Vista 'Mis tarjetas' (/residente/perfil): guardar, listar, marcar predeterminada y eliminar",
         "Addendum", dot("P1"), "2.5 h", "Gonza Morales"],
        ["HU-PAGO-03", "Pago de factura precarga la tarjeta guardada (selección + predeterminada) y permite guardar "
         "una nueva al pagar; el CVV se pide pero no se persiste", "Addendum", dot("P1"), "2.5 h", "Santiago Flores"],
    ],
    [0.95, 2.75, 0.75, 0.7, 0.55, 1.0]))
B(para("<b>Total Addendum del profesor:</b> 7 horas (suma a las 13 h comprometidas → Sprint de 20 h, excepcional "
       "como el S10). Se demuestra en la misma Sprint Review."))

B(sub("Decisiones técnicas del Sprint"))
B(para("Antes de empezar el desarrollo, el equipo cierra las siguientes decisiones técnicas:"))
B(table(
    ["Decisión", "Detalle", "Registrado en"],
    [
        ["Datos del panel integral",
         "Las 3 tarjetas reusan datos ya disponibles (no se inventan endpoints). Los totales se calculan con vistas "
         "Postgres ligeras (vw_home_solicitudes, vw_home_facturas, vw_home_pedidos) para no recalcular en cliente y "
         "mantener Lighthouse alto.",
         "ADR-018"],
        ["Modelo de métodos de pago (tokenización)",
         "Tabla metodos_pago (id, residente_id, alias, marca [visa/mastercard/otra], titular, ultimos4 char(4), "
         "exp_mes, exp_anio, token_simulado, predeterminada boolean, created_at). NO se guarda el PAN completo ni el "
         "CVV. La baja es física para una tarjeta (el residente la borra), pero el pago ya realizado conserva su "
         "token.",
         "Migración 014 + ADR-017"],
        ["CVV efímero (nunca se persiste)",
         "El CVV se solicita en cada pago, se valida en memoria y se descarta; nunca se guarda ni se escribe en logs "
         "(no-PII). Un test verifica que la tabla y los logs no contienen CVV ni PAN.",
         "ADR-017 + Chore no-PII (S11)"],
        ["Tarjeta predeterminada única",
         "Cada residente tiene como máximo una tarjeta predeterminada (índice único parcial). El modal de pago la "
         "precarga; el residente puede elegir otra guardada o ingresar una nueva.",
         "Migración 014 + ADR-017"],
        ["RLS de métodos de pago",
         "metodos_pago: cada residente solo ve / gestiona las suyas (SELECT/INSERT/UPDATE/DELETE de filas propias); "
         "el admin no accede a las tarjetas de los residentes. Cada política se cubre con un test de los 3 roles.",
         "Migración 014 (RLS)"],
        ["Pago simulado reusado (S10)",
         "El flujo del ModalPagoSimulado (Addendum S10) ahora precarga la tarjeta guardada y valida el pago con el "
         "token simulado, sin pasarela de pago real. Sin variables nuevas.",
         "ADR-017 + reusa S10"],
    ],
    [1.45, 4.05, 1.2]))

B(sub("Desglose de tareas — ¿Cómo?"))

B(para("<b>Santiago Flores Carlos — HU-HOME-01 + HU-HOME-04 + HU-PAGO-03 (8.5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Vista /residente como dashboard integral: layout grid responsive (3 tarjetas en desktop, apiladas en "
         "móvil) que reemplaza el dashboard simple actual. Cada tarjeta navega a su detalle con un clic.", "4 h"],
        ["Tarjeta 'Pedidos del mes': resumen de unidades y total acumulado del mes desde vw_home_pedidos, con enlace "
         "al historial de pedidos.", "2 h"],
        ["Addendum HU-PAGO-03: el modal de pago de factura precarga la tarjeta predeterminada del residente (o "
         "permite elegir otra guardada / ingresar una nueva con opción de guardarla); el CVV se pide pero no se "
         "persiste. Reusa el ModalPagoSimulado del S10.", "2.5 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Gonza Morales Yoel — HU-HOME-03 + HU-PAGO-01 + HU-PAGO-02 (6.5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Tarjeta 'Facturas pendientes': total a pagar y próximo vencimiento desde vw_home_facturas, con badge si hay "
         "vencidas y enlace al detalle de facturación.", "2 h"],
        ["Addendum HU-PAGO-01: Migración 014 con la tabla metodos_pago (tokenización, sin PAN ni CVV) + índice único "
         "parcial de predeterminada + RLS (cada residente solo las suyas) + tests de integración con los 3 roles.",
         "2 h"],
        ["Addendum HU-PAGO-02: vista 'Mis tarjetas' en /residente/perfil — guardar (con detección de marca y "
         "máscara), listar (mostrando solo •••• 1234), marcar predeterminada y eliminar. Registro en audit_log.",
         "2.5 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Cortez Zamora Leonardo — HU-HOME-02 + PBI-S6-E03 + Chore Lighthouse (5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Tarjeta 'Solicitudes activas': badge del estado actual + últimos 3 cambios desde vw_home_solicitudes, con "
         "enlace al detalle de la solicitud.", "2 h"],
        ["PBI-S6-E03: pestaña 'Sesiones' en /perfil con el listado de sesiones activas y acción 'Cerrar todas las "
         "demás' (preserva la sesión en curso); se cierran al cambiar la contraseña.", "2 h"],
        ["Chore-T: auditoría Lighthouse ≥ 80 en /residente corrida desde el día 1 (Acción 3 del Retro S12) + "
         "revisión global de cobertura de tests. Documentar el reporte.", "1 h"],
    ],
    [5.9, 0.8]))

B(sub("Riesgos del Sprint 13"))
B(table(
    ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"],
    [
        ["R1", "Guardar datos de tarjeta podría exponer información sensible (PAN / CVV) y romper el no-PII.",
         dotline("Media"), dotline("Alto"),
         "Tokenización: solo marca + titular + últimos 4 + vencimiento + token simulado; nunca PAN ni CVV. Refuerza "
         "el criterio de datos sensibles del OWASP (S12) y el no-PII (S11). Test que verifica que la tabla y los logs "
         "no contienen PAN ni CVV."],
        ["R2", "El CVV podría persistirse o quedar en logs por error.",
         dotline("Baja"), dotline("Alto"),
         "El CVV se valida en memoria y se descarta; nunca se guarda ni se loguea. Test de no-PII explícito sobre el "
         "flujo de pago."],
        ["R3", "Un residente podría ver o usar las tarjetas guardadas de otro si la RLS falla.",
         dotline("Baja"), dotline("Alto"),
         "RLS: cada residente solo SELECT/INSERT/UPDATE/DELETE de sus propias tarjetas; el admin no accede. Test de "
         "los 3 roles."],
        ["R4", "El panel integral hace muchas consultas al cargar y baja el puntaje de Lighthouse.",
         dotline("Media"), dotline("Medio"),
         "Totales calculados con vistas Postgres ligeras (no en cliente) + lazy load; el chore Lighthouse corre "
         "desde el día 1 (Acción 3 del Retro S12) para llegar a ≥ 80 sin sustos."],
        ["R5", "Las 3 tarjetas del home muestran datos desactualizados respecto al detalle.",
         dotline("Baja"), dotline("Bajo"),
         "Las vistas se consultan en vivo y se invalida la caché al cambiar de estado (solicitud, factura, pedido)."],
        ["R6", "'Cerrar todas las sesiones' podría cerrar también la sesión actual del residente.",
         dotline("Baja"), dotline("Bajo"),
         "La acción es 'cerrar todas las demás': preserva explícitamente la sesión en curso (PBI-S6-E03)."],
        ["R7", "El formulario de tarjeta acepta números inválidos y confunde al residente.",
         dotline("Media"), dotline("Bajo"),
         "Validación con algoritmo de Luhn + máscara de entrada + detección de marca antes de tokenizar."],
        ["R8", "El Addendum (+7 h) comprime el buffer y los emergentes del S12 no entran.",
         dotline("Alta"), dotline("Bajo"),
         "Se asume de forma consciente: el Addendum del profesor tiene prioridad sobre los emergentes, que se "
         "reubican a post-curso o al cierre del S14 según el PO. Decisión registrada en el Planning."],
    ],
    [0.4, 1.85, 0.7, 0.7, 3.05]))

# --------------------------------------------------------------------------- #
#  2 · REGISTRO DE DAILY SCRUMS                                                #
# --------------------------------------------------------------------------- #
B(sec(2, "Registro de Daily Scrums"))
B(note("Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y adapta el Sprint Backlog. "
       "Duración máxima: 15 minutos."))
B(goal("Panel integral del residente (3 tarjetas) + sesiones activas. Addendum del profesor: tarjetas guardadas "
       "(tokenización) reutilizables al pagar una factura. Chore: Lighthouse ≥ 80 en /residente desde el día 1.",
       prefix="Sprint Goal:"))

B(sub("Daily Scrum — Día 1 (Lunes)"))
B(meta([
    ("DÍA", "Lunes — Día 1"),
    ("Progreso hacia el objetivo",
     "Layout del nuevo /residente con las 3 tarjetas maquetado (grid responsive). Vistas Postgres ligeras "
     "(vw_home_solicitudes / facturas / pedidos) creadas. Migración 014 (metodos_pago) lista con RLS y tests de los "
     "3 roles en verde. El spike de tokenización dejó claro el enfoque: guardar solo marca + últimos 4 + token, "
     "nunca PAN ni CVV. Cortez corrió Lighthouse el primer día (Acción 3 del Retro S12): base en 86."),
    ("Plan siguiente 24h",
     "Santiago: cablear las tarjetas a las vistas + tarjeta 'Pedidos del mes'. Gonza: tarjeta 'Facturas pendientes' "
     "+ vista 'Mis tarjetas'. Cortez: tarjeta 'Solicitudes activas' + arranca PBI-S6-E03 (sesiones)."),
    ("Impedimentos",
     "Debatimos si el CVV se guarda para 'agilizar' pagos. Decisión firme: el CVV nunca se persiste (PCI-DSS / "
     "no-PII); se pide en cada pago. Capturado como edge case en el Refinement."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

B(sub("Daily Scrum — Día 2 (Martes)"))
B(meta([
    ("DÍA", "Martes — Día 2"),
    ("Progreso hacia el objetivo",
     "Las 3 tarjetas del home muestran datos reales: solicitudes activas con badge de estado, facturas pendientes "
     "con total y próximo vencimiento, pedidos del mes con total acumulado. Vista 'Mis tarjetas' permite guardar una "
     "tarjeta (se ve solo •••• 1234) y marcarla predeterminada. Sesiones activas listando los dispositivos. "
     "Lighthouse en 84 tras cablear las vistas."),
    ("Plan siguiente 24h",
     "Santiago: Addendum HU-PAGO-03 (el pago precarga la tarjeta guardada). Gonza: pulir 'Mis tarjetas' (eliminar, "
     "validación Luhn) + audit_log. Cortez: cerrar 'cerrar todas las demás' + recuperar Lighthouse a ≥ 88 con lazy "
     "load."),
    ("Impedimentos",
     "El modal de pago intentaba guardar el CVV junto a la tarjeta; se corrigió para no persistirlo. El test de "
     "no-PII quedó cubriendo este caso."),
    ("Ajuste Sprint Backlog", "Sin cambios. El Addendum avanza dentro de su estimación."),
]))

B(sub("Daily Scrum — Día 3 (Miércoles)"))
B(meta([
    ("DÍA", "Miércoles — Día 3"),
    ("Progreso hacia el objetivo",
     "Flujo completo y demostrable: Laura entra y ve su home con las 3 tarjetas; paga una factura pendiente y el "
     "modal precarga su tarjeta predeterminada (solo ingresa el CVV, que no se guarda); la factura pasa a 'pagada'. "
     "'Mis tarjetas' con predeterminada y eliminar operativos. Sesiones activas con 'cerrar todas las demás'. "
     "Lighthouse en 91 en /residente. E2E 'home carga + pago con tarjeta guardada' en verde."),
    ("Plan siguiente 24h",
     "Santiago: pulir el home en móvil (360 px). Gonza: guión de la Sprint Review (panel + Addendum). Cortez: "
     "ensayar la demo del control de acceso (un residente no ve las tarjetas de otro) y de que la BD no guarda PAN "
     "ni CVV."),
    ("Impedimentos",
     "La tarjeta predeterminada permitía marcar dos a la vez; se corrigió con el índice único parcial. Sin "
     "impedimento mayor."),
    ("Ajuste Sprint Backlog", "Sin cambios. Buffer consumido por el Addendum, como se previó en el Planning."),
]))

# --------------------------------------------------------------------------- #
#  3 · ACTA DE SPRINT REVIEW                                                   #
# --------------------------------------------------------------------------- #
B(sec(3, "Acta de Sprint Review"))
B(note("Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina adaptaciones futuras. "
       "Es una sesión de trabajo, no una presentación."))
B(meta([
    ("Sprint", "Sprint 13 — Semana 15"),
    ("Fecha", "Viernes — cierre de semana 15"),
    ("Duración", "55 minutos"),
    ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
    ("Scrum Team", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos"),
    ("Stakeholders",
     "Laura Vega (Residente — usa el home y paga con su tarjeta guardada), Carlos Fuentes (Admin — observa el panel), "
     "Sra. Rosa Díaz (Dueña — observadora; le interesan los pagos fluidos de cara al dashboard ejecutivo del S14), "
     "Profesor del curso (autor de la sugerencia del Addendum)"),
    ("Modalidad de demo",
     "Dos navegadores. Se demuestra el panel integral, el pago de una factura con la tarjeta guardada, y los "
     "criterios de seguridad: un residente no ve las tarjetas de otro (RLS) y la BD no contiene el PAN ni el CVV."),
]))
B(sub("Guión de demostración"))
B(numlist([
    "Laura entra a Zity y, sin navegar, ve su nuevo home con 3 tarjetas: 'Mis solicitudes activas' (badge del estado "
    "+ últimos cambios), 'Mis facturas pendientes' (total a pagar + próximo vencimiento) y 'Mis pedidos del mes' "
    "(unidades + total acumulado). Hace clic en cada una y va al detalle.",
    "Laura abre 'Mis tarjetas' (Addendum del profesor) y guarda una Visa: el sistema solo conserva la marca, el "
    "titular, los últimos 4 dígitos (•••• 4242), el vencimiento y un token; la marca como predeterminada.",
    "Laura paga una factura pendiente: el modal de pago precarga su tarjeta predeterminada y solo le pide el CVV "
    "(que no se guarda). Confirma y la factura pasa a 'pagada' (pago simulado del S10).",
    "Se muestra la seguridad: en la BD, la tarjeta guardada NO tiene el número completo ni el CVV (solo •••• 4242 + "
    "token) — criterio de datos sensibles (OWASP A02) y no-PII.",
    "Laura guarda una segunda tarjeta y la marca como predeterminada; el siguiente pago la usa automáticamente.",
    "Se muestra el control de acceso: un segundo residente no ve las tarjetas de Laura (RLS); el admin tampoco "
    "accede a ellas.",
    "Laura cambia su contraseña y abre la pestaña 'Sesiones': ve sus dispositivos y pulsa 'Cerrar todas las demás', "
    "que preserva la sesión en curso (PBI-S6-E03).",
    "Cortez muestra el reporte Lighthouse de /residente: 91 en performance, corrido desde el día 1 del Sprint "
    "(Acción 3 del Retro S12).",
]))
B(goal(
    chk() + " CUMPLIDO: Panel integral del residente operativo —las 3 tarjetas reemplazan el dashboard simple— más "
    "sesiones activas. Addendum del profesor entregado: el residente guarda sus tarjetas (con tokenización: sin PAN "
    "ni CVV) y las reutiliza al pagar una factura sin reescribirlas. El criterio de performance (Lighthouse ≥ 80) "
    "quedó cubierto. Sprint cerrado con 20 h (13 comprometidas + 7 del Addendum); noveno Sprint consecutivo sin "
    "hotfixes."))

B(sub("Feedback de stakeholders"))
B(para("<b>Laura Vega (Residente)</b>"))
B(bullets([
    "«Ver todo en una sola pantalla y pagar sin reescribir mi tarjeta cada vez me ahorra muchísimo tiempo.» → "
    "Validación del panel y del Addendum.",
    "«Me daría más confianza recibir un correo cuando se guarda o se usa una tarjeta nueva.» → PBI-S13-E01: "
    "'Aviso por email al guardar / usar una tarjeta (reusa Resend)'. P3, 1.5 h. Candidato post-curso.",
], marker="•"))
B(para("<b>Carlos Fuentes (Administrador)</b>"))
B(bullets([
    "«Que el residente tenga su panel propio descarga consultas que antes me llegaban a mí.» → Validación.",
    "«Me gustaría ver, como admin, qué facturas se pagaron con tarjeta guardada para el cierre del mes.» → "
    "PBI-S13-E02: 'Indicador de pagos por método en /admin/facturacion'. P3, 1.5 h. Candidato post-curso.",
], marker="•"))
B(para("<b>Sra. Rosa Díaz (Dueña — observadora)</b>"))
B(bullets([
    "«Que pagar sea más fácil debería mejorar el ratio de cobranza; verlo reflejado en el dashboard del cierre (S14) "
    "sería el broche.» → Validación + insumo del S14.",
], marker="•"))
B(para("<b>Profesor del curso</b>"))
B(bullets([
    "«La sugerencia quedó muy bien resuelta: las tarjetas se reutilizan, pero sobre todo se guardan con tokenización "
    "—sin el número completo ni el CVV—, que es exactamente el criterio de seguridad correcto.» → Validación del "
    "Addendum y de DoD v3 (datos sensibles).",
    "«Arrancar Lighthouse desde el primer día, en vez de al cierre, evitó la típica carrera final de performance.» → "
    "Validación de la Acción 3 del Retro S12.",
], marker="•"))

B(sub("Decisiones de adaptación del Product Backlog"))
B(table(
    ["Decisión", "Detalle"],
    [
        ["DoD v3 — performance cubierta", "El chore Lighthouse ≥ 80 cumple el criterio de performance. Solo queda el "
                                          "release candidate + demo final (S14)."],
        ["Cero hotfixes", "Noveno Sprint consecutivo sin hotfixes — práctica consolidada."],
        ["Addendum del profesor entregado", "Métodos de pago con tokenización (sin PAN ni CVV): tarjetas guardadas "
                                            "reutilizables al pagar. Mismo tratamiento que el Addendum del S10."],
        ["Panel integral en producción", "La ruta /residente pasa a ser el dashboard de 3 tarjetas; el dashboard "
                                          "simple anterior queda retirado."],
        ["Emergentes del S12 diferidos", "Quick view (S10-E01), desglose del pedido (S11-E01), export de pedidos "
                                         "(S11-E03), anuncios por email (S12-E01) e indicador de lectura (S12-E02) no "
                                         "entraron: el Addendum consumió el buffer. Se reubican a post-curso."],
        ["PBI-S13-E01 (NUEVA)", "Aviso por email al guardar / usar una tarjeta (feedback Laura). P3, 1.5 h. "
                                "Candidato post-curso."],
        ["PBI-S13-E02 (NUEVA)", "Indicador de pagos por método en /admin/facturacion (feedback Carlos). P3, 1.5 h. "
                                "Candidato post-curso."],
        ["Sprint 14 confirmado", "Broche del curso: Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) "
                                 "+ Release Candidate (tag v1.0.0-rc) + demo final integral. Chore: smoke tests "
                                 "post-deploy."],
    ],
    [1.7, 5.0]))

# --------------------------------------------------------------------------- #
#  4 · ACTA DE SPRINT RETROSPECTIVE                                            #
# --------------------------------------------------------------------------- #
B(sec(4, "Acta de Sprint Retrospective"))
B(note("Referencia Scrum: la Retrospective planifica formas de aumentar calidad y efectividad. Los cambios más "
       "impactantes pueden entrar al Sprint Backlog del próximo Sprint."))
B(meta([
    ("Sprint", "Sprint 13 — Semana 15"),
    ("Fecha", "Viernes — después de la Sprint Review"),
    ("Duración", "30 minutos"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
]))
B(sub(chk() + " ¿Qué salió bien?"))
B(bullets([
    "Las tres acciones del Retro S12 se aplicaron: la 'Política de notificaciones' quedó en conventions.md (Acción "
    "1); la sanitización como patrón se reusó en la validación de las tarjetas (Acción 2); y Lighthouse corrió desde "
    "el día 1, no al cierre (Acción 3).",
    "Tokenizar las tarjetas —guardar solo marca + últimos 4 + token, nunca PAN ni CVV— resolvió la sugerencia del "
    "profesor con buen criterio de seguridad, reusando el patrón no-PII del S11.",
    "Calcular los totales del home con vistas Postgres ligeras (no en cliente) mantuvo Lighthouse alto sin esfuerzo "
    "extra.",
    "Reusar el pago simulado del S10 hizo que precargar la tarjeta guardada fuera casi gratis: mismo modal, mismo "
    "flujo.",
    "Asumir conscientemente en el Planning que el Addendum consumiría el buffer evitó falsas expectativas sobre los "
    "emergentes.",
    "Noveno Sprint consecutivo sin hotfixes.",
], marker="•"))
B(sub(xmk() + " ¿Qué salió mal?"))
B(bullets([
    "El modal de pago intentaba guardar el CVV al inicio; se corrigió para no persistirlo, pero el caso debió "
    "definirse explícitamente en el Refinement.",
    "El Addendum (+7 h) comprimió el buffer y dejó fuera varios emergentes priorizados del S12 (quick view, export "
    "de pedidos, anuncios por email).",
    "La tarjeta predeterminada permitía marcar dos a la vez; se corrigió con el índice único parcial.",
], marker="•"))

B(sub("Acciones de mejora (máx. 3)"))
B(para("<b>Acción 1 — Congelar el alcance del último Sprint (S14)</b>"))
B(meta([
    ("Descripción", "El S14 es el broche del curso (dashboard ejecutivo + RC + demo final). No se aceptan nuevos "
                    "addendums ni features: alcance cerrado en el Planning para asegurar el release candidate y la "
                    "demo final."),
    ("Dueño", "Meza Pelaez Carlos (SM)"),
    ("Evidencia", "El acta de Planning del S14 declara el alcance cerrado y sin addendums"),
    ("Fecha", "Sprint 14"),
]))
B(para("<b>Acción 2 — Smoke tests post-deploy como gate antes del tag RC</b>"))
B(meta([
    ("Descripción", "Antes de etiquetar v1.0.0-rc, el deploy final a staging debe pasar smoke tests automáticos "
                    "(login, home del residente, emisión de factura, dashboard ejecutivo). Si fallan, no hay tag."),
    ("Dueño", "Cortez Zamora Leonardo"),
    ("Evidencia", "Workflow de CD con smoke tests post-deploy ejecutándose en el S14 antes del tag"),
    ("Fecha", "Sprint 14"),
]))
B(para("<b>Acción 3 — Checklist de datos sensibles en la revisión de PR</b>"))
B(meta([
    ("Descripción", "Toda revisión de PR verifica explícitamente que no se persisten datos sensibles (PAN, CVV, "
                    "contraseñas) ni se filtran a logs. Se vuelve parte del checklist de DoD."),
    ("Dueño", "Gonza Morales Yoel"),
    ("Evidencia", "/docs/conventions.md con el checklist de datos sensibles aplicado en el S14"),
    ("Fecha", "Sprint 14"),
]))

B(sub("Verificación DoD v3 — tercera aplicación"))
B(table(
    ["Criterio", "Estado"],
    [
        ["Todo lo de DoD v2 (lint, unit + integration, cobertura ≥ 60%, /health, Secrets, tsc, CD con verificación)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["E2E mínimos de módulos críticos (home integral carga + pago con tarjeta guardada) en pipeline",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Regresión: tocar un flujo crítico dispara unit + integration + E2E",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Evidencia de no-PII en logs (las tarjetas no guardan PAN ni CVV; solo últimos 4 + token)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — reforzado</b></font>"],
        ["Checklist OWASP top 10 (vigente del S12; tokenización cubre A02 datos sensibles en métodos de pago)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Performance: Lighthouse ≥ 80 en rutas principales (91 en /residente, desde el día 1)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — chore del Sprint</b></font>"],
        ["Release candidate etiquetado + demo final reproducible",
         "<font color='#C8862A'><b>PROGRAMADO — S14</b></font>"],
        ["ADR-017 (tokenización de métodos de pago) + ADR-018 (vistas del home) documentados",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — adicional a DoD v3</b></font>"],
    ],
    [4.4, 2.3]))
B(goal(
    "DoD v3 con el criterio de performance (Lighthouse ≥ 80) cumplido en este Sprint; solo queda el release "
    "candidate + demo final (S14). El residente cuenta con su panel integral y puede pagar con tarjetas guardadas de "
    "forma segura (sin PAN ni CVV). Sprint 13 cerrado con 20 h (13 + 7 del Addendum del profesor); noveno Sprint "
    "consecutivo sin hotfixes."))

# --------------------------------------------------------------------------- #
#  5 · HISTORIAS DE USUARIO — SPRINT 13                                        #
# --------------------------------------------------------------------------- #
B(sec(5, "Historias de Usuario — Sprint 13"))
B(sub("Módulo EXPERIENCIA DEL RESIDENTE — Panel integral — Sprint 13"))

B(hucard(
    "HU-HOME-01", "Dashboard integral del residente · 3 tarjetas", "Sprint 13 · 4 h", "P1 · 4 h",
    "Como <b>residente</b>, quiero <b>una sola vista (mi 'home') con mis solicitudes, mis facturas y mis pedidos</b>, "
    "para ver mi estado de un vistazo sin navegar por varias pantallas.",
    [
        "La ruta /residente pasa a ser un dashboard con 3 tarjetas (grid responsive) que reemplaza el dashboard "
        "simple actual.",
        "En desktop se muestran 3 columnas; en móvil (<= 640 px) las tarjetas se apilan en vertical.",
        "Cada tarjeta navega a su detalle correspondiente con un clic.",
        "Los datos de cada tarjeta provienen de vistas Postgres ligeras (no se recalcula en cliente).",
        "Lighthouse ≥ 80 en performance en la nueva /residente.",
    ],
    "Laura entró a Zity y vio las 3 tarjetas sin navegar; cada una la llevó a su detalle. Lighthouse 91."))

B(hucard(
    "HU-HOME-02", "Tarjeta 'Solicitudes activas'", "Sprint 13 · 2 h", "P1 · 2 h",
    "Como <b>residente</b>, quiero <b>ver mis solicitudes activas con su estado</b>, para saber de un vistazo en qué "
    "va cada una.",
    [
        "La tarjeta muestra las solicitudes activas del residente con el badge del estado actual.",
        "Incluye los últimos 3 cambios de estado de cada solicitud (o de la más reciente).",
        "Enlaza al detalle de la solicitud con un clic.",
        "Los datos provienen de vw_home_solicitudes.",
    ],
    "La tarjeta mostró las solicitudes activas con su badge; al hacer clic, Laura llegó al detalle."))

B(hucard(
    "HU-HOME-03", "Tarjeta 'Facturas pendientes'", "Sprint 13 · 2 h", "P1 · 2 h",
    "Como <b>residente</b>, quiero <b>ver mis facturas pendientes con el total a pagar y el próximo vencimiento</b>, "
    "para no perder un pago.",
    [
        "La tarjeta muestra el total a pagar (suma de pendientes) y la fecha del próximo vencimiento.",
        "Si hay facturas vencidas, se muestra un badge de alerta.",
        "Enlaza al detalle de facturación; desde allí el residente puede pagar (ver Addendum HU-PAGO-03).",
        "Los datos provienen de vw_home_facturas.",
    ],
    "La tarjeta mostró el total pendiente y el próximo vencimiento; con facturas vencidas apareció el badge de "
    "alerta."))

B(hucard(
    "HU-HOME-04", "Tarjeta 'Pedidos del mes'", "Sprint 13 · 2 h", "P1 · 2 h",
    "Como <b>residente</b>, quiero <b>ver el resumen de mis pedidos del mes</b>, para saber cuánto llevo gastado en "
    "la tienda.",
    [
        "La tarjeta muestra las unidades pedidas en el mes y el total acumulado.",
        "Enlaza al historial de pedidos del residente.",
        "Los datos provienen de vw_home_pedidos.",
    ],
    "La tarjeta mostró las unidades y el total del mes; al hacer clic, Laura llegó a su historial de pedidos."))

B(hucard(
    "PBI-S6-E03", "Sesiones activas · Cerrar todas las demás", "Sprint 13 · 2 h", "P2 · 2 h",
    "Como <b>residente</b>, quiero <b>ver mis sesiones activas y poder cerrar todas las demás</b>, para proteger mi "
    "cuenta si entré desde un dispositivo que ya no uso.",
    [
        "Pestaña 'Sesiones' en /perfil con el listado de sesiones activas (dispositivo / fecha de inicio).",
        "Acción 'Cerrar todas las demás' que preserva la sesión en curso.",
        "Al cambiar la contraseña se cierran automáticamente las demás sesiones.",
    ],
    "Laura vio sus sesiones, pulsó 'Cerrar todas las demás' y su sesión actual siguió activa; al cambiar la "
    "contraseña, las otras se cerraron."))

B(spacer(4))
B(sub("Addendum del profesor — Módulo MÉTODOS DE PAGO (tarjetas guardadas)"))
B(para(
    "<b>Sugerencia del profesor:</b> en el pago simulado (Addendum del S10) el residente reingresa su tarjeta cada "
    "vez. Se añade —debajo de los PBIs normales— un apartado para guardar tarjetas y reutilizarlas al pagar, con "
    "<b>tokenización segura</b>: solo marca + titular + últimos 4 dígitos + vencimiento + token simulado; nunca el "
    "número completo (PAN) ni el CVV."))

B(hucard(
    "HU-PAGO-01", "Modelado BD de métodos de pago · Tokenización + RLS", "Sprint 13 · 2 h", "Addendum · P1 · 2 h",
    "Como <b>sistema</b>, quiero <b>una tabla metodos_pago que guarde las tarjetas tokenizadas con RLS por "
    "residente</b>, para soportar pagos sin reingresar datos y sin almacenar información sensible.",
    [
        "Migración 014 crea metodos_pago (id, residente_id, alias, marca, titular, ultimos4, exp_mes, exp_anio, "
        "token_simulado, predeterminada, created_at). NO se guarda el PAN completo ni el CVV.",
        "Índice único parcial: como máximo una tarjeta predeterminada por residente.",
        "RLS: cada residente solo ve / gestiona sus propias tarjetas; el admin no accede a ellas.",
        "El CVV nunca se persiste ni se escribe en logs (no-PII).",
        "Tests de integración con los 3 roles validan la RLS, y un test verifica que la tabla no contiene PAN ni CVV.",
    ],
    "Migración 014 aplicada en staging; RLS verificada (un residente no ve las tarjetas de otro); el test confirma "
    "que no se guarda PAN ni CVV. ADR-017 documenta la tokenización."))

B(hucard(
    "HU-PAGO-02", "Vista 'Mis tarjetas' · CRUD + predeterminada", "Sprint 13 · 2.5 h", "Addendum · P1 · 2.5 h",
    "Como <b>residente</b>, quiero <b>guardar y administrar mis tarjetas</b>, para no tener que escribirlas cada vez "
    "que pago.",
    [
        "Apartado 'Mis tarjetas' en /residente/perfil: guardar (con detección de marca y máscara de entrada), listar "
        "(mostrando solo •••• 1234 + marca + vencimiento), marcar predeterminada y eliminar.",
        "Validación del número con el algoritmo de Luhn antes de tokenizar; el CVV se pide pero no se guarda aquí.",
        "Solo se persiste la información tokenizada (sin PAN ni CVV).",
        "Toda alta / cambio de predeterminada / eliminación registra en audit_log (sin datos sensibles).",
    ],
    "Laura guardó una Visa (se ve •••• 4242), la marcó predeterminada y eliminó otra; las acciones quedaron en el "
    "audit_log sin exponer datos sensibles."))

B(hucard(
    "HU-PAGO-03", "Pago de factura con tarjeta guardada", "Sprint 13 · 2.5 h", "Addendum · P1 · 2.5 h",
    "Como <b>residente</b>, quiero <b>pagar una factura con una tarjeta guardada</b>, para completar el pago en un "
    "par de clics sin reescribir mis datos.",
    [
        "El modal de pago (reusa el ModalPagoSimulado del S10) precarga la tarjeta predeterminada del residente.",
        "El residente puede elegir otra tarjeta guardada o ingresar una nueva, con opción de guardarla.",
        "El CVV se solicita en cada pago, se valida en memoria y NO se persiste.",
        "Al confirmar, el pago simulado se registra con el token y la factura pasa a 'pagada' (efecto Realtime del "
        "S8/S9).",
        "Si el residente no tiene tarjetas guardadas, el flujo cae al ingreso manual del S10 (compatibilidad).",
    ],
    "Laura pagó una factura pendiente: el modal precargó su tarjeta predeterminada, solo pidió el CVV (no guardado) y "
    "la factura pasó a 'pagada'."))

B(para(
    "<b>Chore técnico del Sprint:</b> auditoría Lighthouse ≥ 80 en /residente, corrida desde el día 1 (Acción 3 del "
    "Retro S12) y no al cierre, + revisión global de cobertura de tests. Resultado: 91 en performance. Cumple el "
    "criterio de performance de DoD v3. 1 h, P2."))

B(sub("PBIs emergentes — entran en Sprints futuros / post-curso"))
B(table(
    ["ID", "Historia", "Prior.", "Horas est.", "Sprint"],
    [
        ["PBI-S13-E01", "Aviso por email al guardar / usar una tarjeta (reusa Resend) (feedback Laura)", dot("P3"),
         "1.5 h", "Post-curso"],
        ["PBI-S13-E02", "Indicador de pagos por método en /admin/facturacion (feedback Carlos)", dot("P3"), "1.5 h",
         "Post-curso"],
        ["PBI-S12-E01", "Anuncios urgentes también por email (reusa Resend)", dot("P3"), "1.5 h", "Post-curso"],
        ["PBI-S12-E02", "Indicador de lectura para el admin (cuántos residentes leyeron)", dot("P2"), "2 h",
         "Post-curso"],
        ["PBI-S11-E01", "Enlace al desglose del pedido desde el detalle de la factura", dot("P3"), "1 h", "Post-curso"],
        ["PBI-S11-E03", "Exportar pedidos a CSV por rango", dot("P3"), "1.5 h", "Post-curso"],
        ["PBI-S10-E01", "Vista rápida (quick view) del producto", dot("P3"), "1.5 h", "Post-curso"],
        ["PBI-S11-E02", "Cancelar pedido confirmado y devolver stock", dot("P2"), "2 h", "Post-curso"],
    ],
    [1.05, 3.3, 0.7, 0.85, 0.8]))
B(note("Nota: el Addendum del profesor (métodos de pago, 7 h) consumió el buffer del Sprint, por lo que los "
       "emergentes acumulados se reubican a post-curso. El S14 está reservado para el broche (dashboard ejecutivo + "
       "release candidate + demo final) con alcance cerrado (Acción 1 del Retro S13)."))

# --------------------------------------------------------------------------- #
#  6 · ESTADO DEL BACKLOG TRAS SPRINT 13                                       #
# --------------------------------------------------------------------------- #
B(sec(6, "Estado del Backlog tras Sprint 13"))
B(sub("Progreso acumulado"))
done = "<font color='#3E7D3A'>" + chk() + " Completado</font>"
B(table(
    ["Sprint", "Horas", "Incremento entregado", "Estado"],
    [
        ["Sprint 0–6", "93 h", "Setup + Auth + Panel admin + Mantenimiento v1/v2 + Trazabilidad + Realtime", done],
        ["Sprint 7", "13 h", "Métricas y Dashboard visual: KPIs + gráficas Recharts + CSV + vista materializada", done],
        ["Sprint 8", "13 h", "Facturación v1: emisión individual/lote + vista residente + notificación Realtime", done],
        ["Sprint 9", "12.5 h", "Facturación v2: marcar pagada + recordatorios + vencida + comprobante PDF + /health",
         done],
        ["Sprint 10", "13 + 8 h", "Tienda interna v1: catálogo + CD a staging · Addendum del profesor (seed 3 años + "
         "pago simulado + encuesta SUS)", done],
        ["Sprint 11", "13 h", "Tienda interna v2: carrito + descuento atómico + pedido → factura mensual + vista "
         "admin de pedidos · primer DoD v3", done],
        ["Sprint 12", "13 h", "Comunicación: tablón de anuncios del edificio + OWASP · absorbe PBI-S9-E02", done],
        ["Sprint 13", "13 + 7 h", star() + " Panel integral del residente (3 tarjetas) + sesiones activas + "
         "Lighthouse · Addendum del profesor (métodos de pago: tarjetas guardadas con tokenización)", done],
        ["Sprint 14", "13 h (est.)", star() + " Dashboard ejecutivo del dueño + Release Candidate + demo final "
         "integral", "<font color='#C8862A'>→ Próximo</font>"],
    ],
    [0.95, 0.85, 3.7, 1.2]))
B(para("<b>Total invertido:</b> 198.5 horas en 14 sprints (Sprint 0 → Sprint 13), incluidas las 8 h del Addendum del "
       "S10 y las 7 h del Addendum del S13 a pedido del profesor."))
B(para("<b>Total restante:</b> ~13 horas estimadas en 1 sprint (S14 — broche del curso)."))
B(para("<b>Velocidad promedio:</b> 13.1 horas/sprint de trabajo comprometido (estable); el S13 sumó además 7 h del "
       "Addendum del profesor, como ocurrió en el S10."))

B(sub("Roadmap actualizado tras Sprint 13 Review"))
B(table(
    ["Sprint", "Sem.", "Objetivo principal — Entregable funcional"],
    [
        ["S14", "16", star() + " Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) en una sola vista "
         "con gráficas de alto nivel + rol 'observador' + Release Candidate (tag v1.0.0-rc) con smoke tests "
         "post-deploy + demo final integral del producto. Alcance cerrado, sin nuevos addendums (Acción 1 del Retro "
         "S13)"],
    ],
    [0.6, 0.5, 5.6]))
B(note("Nota: los emergentes acumulados (S10-E01, S11-E01/E03, S12-E01/E02, S13-E01/E02) quedan como backlog "
       "post-curso, ya que el Addendum del profesor tuvo prioridad sobre ellos. El residente queda con su panel "
       "integral y pagos con tarjetas guardadas; el S14 cierra el curso con el dashboard ejecutivo del dueño, el "
       "release candidate y la demo final."))

B(sub("Vista previa Sprint 14 — Dashboard ejecutivo del dueño + RC"))
B(goal("Sprint 14 (broche del curso): un dashboard ejecutivo para la dueña del edificio (Sra. Rosa Díaz, rol "
       "'observador') que consolida Mantenimiento + Finanzas + Tienda en gráficas de alto nivel; etiquetar el "
       "Release Candidate (v1.0.0-rc) con smoke tests post-deploy y ensayar la demo final integral. DoD v3 final."))
B(table(
    ["PBI", "Historia", "Horas est.", "Prior."],
    [
        ["HU-EJEC-01", "Rol 'observador' del dueño + ruta /admin/ejecutivo con guarda de acceso", "2 h", dot("P1")],
        ["HU-EJEC-02", "Sección 'Mantenimiento': gráfica de volumen + tiempos + top categorías", "3 h", dot("P1")],
        ["HU-EJEC-03", "Sección 'Finanzas': ingresos por tipo + ratio cobrado/pendiente", "3 h", dot("P1")],
        ["HU-EJEC-04", "Sección 'Tienda': ingresos del mes + top 5 productos + tendencia", "2 h", dot("P1")],
        ["RELEASE", "Tag v1.0.0-rc + deploy final a staging + smoke tests post-deploy", "1 h", dot("P1")],
        ["Demo", "Ensayo de demo final + grabación de evidencia académica + retro del curso", "2 h", dot("P1")],
    ],
    [1.15, 3.85, 0.85, 0.85]))
B(para("<b>Total estimado Sprint 14:</b> 13 horas. Alcance cerrado: no se aceptan nuevos addendums ni features "
       "(Acción 1 del Retro S13), para asegurar el release candidate y la demo final."))

B(sub("Variables de entorno acumuladas al Sprint 13"))
B(para("Este Sprint no añade variables nuevas: el panel integral reusa datos vía vistas Postgres y el Addendum de "
       "métodos de pago usa un token simulado generado en servidor (sin pasarela de pago real). La tabla acumulada "
       "se mantiene desde el S10:"))
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
        ["VERCEL_TOKEN", "Token de despliegue de Vercel", "GitHub Actions (CD a staging)", "Sprint 10"],
        ["VERCEL_ORG_ID", "ID de la organización en Vercel", "GitHub Actions (CD a staging)", "Sprint 10"],
        ["VERCEL_PROJECT_ID", "ID del proyecto en Vercel", "GitHub Actions (CD a staging)", "Sprint 10"],
    ],
    [1.65, 2.0, 2.05, 1.0]))
B(para("Variables proyectadas para futuros Sprints:"))
B(bullets([
    "S14 (Dashboard ejecutivo + RC): no requiere secretos nuevos; el dashboard consume los KPIs del S7, las facturas "
    "del S8/S9 y los pedidos del S10/S11, y el release candidate se apoya en la configuración existente.",
], marker="•"))
B(note("Ninguna de estas variables debe aparecer en el código fuente ni en commits. Todas van en .env.local (local) "
       "y en Secrets de GitHub/Vercel (CI/CD). Los datos de tarjeta nunca se guardan completos: solo se tokenizan "
       "(marca + últimos 4 + token), sin PAN ni CVV."))

B(finalnote("— Zity · Artefactos Sprint 13 · Documento vivo — actualizar en cada Sprint Review —"))

# --------------------------------------------------------------------------- #
OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "sprints", "Zity_Sprint13_Artefactos.pdf"))
build_pdf(BLOCKS, FOOT, OUT)
print("OK ->", OUT)
