# -*- coding: utf-8 -*-
"""
Artefactos Scrum — Zity · Sprint 14 (Semana 16) · BROCHE DEL CURSO.
Dashboard ejecutivo del dueño + Release Candidate + demo final integral.

Contenido derivado de:
  - Zity_Roadmap_Sprints.pdf  (Sprint 14 — Dashboard ejecutivo del dueño del edificio (Sra. Rosa Díaz):
    consolida Mantenimiento + Finanzas + Tienda en gráficas de alto nivel; Release Candidate v1.0.0-rc;
    demo final integral; chore: smoke tests post-deploy incluidos en el PBI RELEASE).
  - Continuidad con Zity_Sprint13_Artefactos (Panel integral del residente cerrado + Addendum del profesor de
    métodos de pago; acciones del Retro S13: congelar alcance del S14, smoke tests como gate antes del tag RC,
    checklist de datos sensibles en PR).
  - DoD v3 FINAL: este Sprint cierra el release candidate y la demo final, último criterio pendiente de DoD v3.

Render:  python sprint14.py   (desde scripts/artefactos/)
"""
import os
from zity_artefactos import (
    cover, sec, meta, goal, note, sub, para, bullets, numlist, table, spacer,
    finalnote, hucard, dot, dotline, chk, xmk, star, build_pdf,
)

FOOT = " · Artefactos Scrum · Sprint 14"

BLOCKS = []
B = BLOCKS.append

# --------------------------------------------------------------------------- #
#  PORTADA                                                                     #
# --------------------------------------------------------------------------- #
B(cover(
    "Sprint 14",
    "Artefactos Scrum — Sprint 14 · Broche del curso",
    "Dashboard ejecutivo del dueño del edificio (Sra. Rosa Díaz, rol 'observador'): una sola vista que consolida "
    "Mantenimiento + Finanzas + Tienda en gráficas de alto nivel, reusando los KPIs del S7, las facturas del S8/S9 y "
    "los pedidos del S10/S11 · Release Candidate (tag v1.0.0-rc) con smoke tests post-deploy · demo final integral "
    "del producto · DoD v3 FINAL — cierre del curso",
    [
        ("Producto", "Zity"),
        ("Sprint", "Sprint 14 — Semana 16 · " + star() + " BROCHE DEL CURSO"),
        ("Stack", "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                  "Resend · Vercel · GitHub Actions · Vitest · Playwright (E2E, DoD v3) · "
                  "Recharts (S7) · pdf-lib (S9) · pg_cron (S9) · Lighthouse CI (S13)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers", "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "13 horas (2 horas de buffer). Alcance cerrado: sin addendums ni features nuevas "
                            "(Acción 1 del Retro S13)"),
        ("DoD aplicable", "DoD v3 FINAL — se cierra el último criterio pendiente: release candidate etiquetado en "
                          "staging + demo final reproducible. Todos los demás criterios (E2E, regresión, no-PII, "
                          "OWASP, Lighthouse) ya cumplidos en S11–S13"),
        ("Nuevo en este sprint",
         "Rol 'observador' (para la dueña del edificio) + ruta /admin/ejecutivo con guarda de acceso · Dashboard "
         "ejecutivo en una sola página con 3 secciones (Mantenimiento, Finanzas, Tienda) en gráficas Recharts · Tag "
         "v1.0.0-rc en main + deploy final a staging + smoke tests post-deploy · ensayo de demo final integral"),
        ("Chore técnico del Sprint",
         "Smoke tests post-deploy del staging final (login, home del residente, emisión de factura, dashboard "
         "ejecutivo) como gate antes del tag v1.0.0-rc (Acción 2 del Retro S13). Incluido en el PBI RELEASE."),
        ("Sin addendums",
         "El alcance del S14 está cerrado (Acción 1 del Retro S13): no se aceptan nuevos addendums ni features, para "
         "asegurar el release candidate y la demo final del curso."),
        ("Variables nuevas",
         "Ninguna. El dashboard ejecutivo consume datos ya existentes (KPIs S7, facturas S8/S9, pedidos S10/S11) y el "
         "release candidate se apoya en la configuración de CD ya establecida."),
        ("Cierre narrativo",
         "El dashboard del dueño es la pieza de integración final: NO inventa datos, consolida visualmente todo lo "
         "construido en el curso. Se reserva para el S14 para preservar su impacto (recordatorio del roadmap). "
         "Reemplaza a Twilio Verify 2FA, que queda como mejora opcional post-curso por no ser visual."),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ],
))

# --------------------------------------------------------------------------- #
#  1 · ACTA DE SPRINT PLANNING                                                 #
# --------------------------------------------------------------------------- #
B(sec(1, "Acta de Sprint Planning"))
B(meta([
    ("Sprint", "Sprint 14 — Semana 16 · Broche del curso"),
    ("Fecha", "Lunes — inicio de semana 16"),
    ("Duración del evento", "75 minutos + 30 min de Refinement con cierre de alcance del curso y guión de la demo "
                            "final integral"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Asistentes", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
    ("Stakeholder invitado",
     "Sra. Rosa Díaz (Dueña del edificio, ficticia) — stakeholder del PRD que aún no tuvo su feature. Como futura "
     "usuaria del dashboard ejecutivo, valida qué indicadores de alto nivel necesita ver para tomar decisiones. "
     "Séptima aplicación de la Acción 2 del Retro S8."),
    ("Capacidad", "15 horas disponibles · se comprometen 13 h (2 h de buffer). Alcance cerrado, sin addendums "
                  "(Acción 1 del Retro S13)"),
    ("Entrada",
     "Product Backlog tras Sprint 13 Review. El residente quedó con su panel integral y pagos con tarjetas guardadas "
     "(Addendum del profesor). La DoD v3 tiene cumplidos E2E, regresión, no-PII, OWASP y Lighthouse; solo resta el "
     "release candidate + demo final. El roadmap reserva el S14 como broche: el dashboard ejecutivo del dueño, que "
     "consolida en gráficas todos los módulos del curso, más el tag v1.0.0-rc y la demo final."),
    ("Refinement previo",
     "Décima y última aplicación de la práctica. 'Edge cases del dominio': «¿el rol observador puede ver pero no "
     "modificar nada?», «¿el dashboard recalcula o reusa los KPIs y vistas existentes?» (reusa), «¿qué pasa si un "
     "módulo no tiene datos reales suficientes para el broche?» (se usa el seed de 3 años del Addendum S10). Se cierra "
     "el alcance del curso: sin nuevos addendums (Acción 1 del Retro S13)."),
]))
B(goal(
    "Cerrar el curso con el broche visual: un dashboard ejecutivo para la dueña del edificio (Sra. Rosa Díaz, rol "
    "'observador') que consolida en una sola vista Mantenimiento + Finanzas + Tienda con gráficas de alto nivel; "
    "etiquetar el Release Candidate (v1.0.0-rc) con smoke tests post-deploy y ensayar la demo final integral del "
    "producto. Con esto se completa el último criterio pendiente de DoD v3.",
    prefix="Sprint Goal:"))
B(note(
    "Nota: DoD v3 FINAL. El dashboard NO inventa datos: consume los KPIs del S7, las facturas del S8/S9 y los pedidos "
    "del S10/S11; es la consolidación visual de todo el producto. El release candidate (tag v1.0.0-rc) con smoke "
    "tests post-deploy cierra el último criterio de DoD v3. Alcance cerrado, sin addendums (Acción 1 del Retro S13). "
    "El dashboard se reserva para el S14 para preservar su impacto como pieza de integración final (recordatorio del "
    "roadmap)."))

B(sub("PBIs seleccionados — Sprint 14"))
B(table(
    ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"],
    [
        ["HU-EJEC-01", "Rol 'observador' del dueño + ruta /admin/ejecutivo con guarda de acceso",
         "Historia", dot("P1"), "2 h", "Cortez Zamora"],
        ["HU-EJEC-02", "Sección 'Mantenimiento': gráfica de volumen + tiempos de resolución + top categorías",
         "Historia", dot("P1"), "3 h", "Santiago Flores"],
        ["HU-EJEC-03", "Sección 'Finanzas': ingresos por tipo (luz/agua/pensión) + ratio cobrado/pendiente",
         "Historia", dot("P1"), "3 h", "Gonza Morales"],
        ["HU-EJEC-04", "Sección 'Tienda': ingresos del mes + top 5 productos + tendencia",
         "Historia", dot("P1"), "2 h", "Santiago Flores"],
        ["RELEASE", "Tag v1.0.0-rc en main + deploy final a staging + smoke tests post-deploy (gate)",
         "Release", dot("P1"), "1 h", "Cortez Zamora"],
        ["Demo", "Ensayo de demo final integral + grabación de evidencia académica + retro del curso",
         "Demo", dot("P1"), "2 h", "Todo el equipo"],
        ["Buffer", "Imprevistos del dashboard / ajustes de gráficas + ensayo de la demo final",
         "—", dot("P2", "—"), "2 h", "—"],
    ],
    [0.95, 2.75, 0.75, 0.7, 0.55, 1.0]))
B(para("<b>Total comprometido:</b> 13 horas + 2 h de buffer. Sin addendums (alcance cerrado del curso)."))

B(sub("Decisiones técnicas del Sprint"))
B(para("Antes de empezar el desarrollo, el equipo cierra las siguientes decisiones técnicas:"))
B(table(
    ["Decisión", "Detalle", "Registrado en"],
    [
        ["Rol 'observador'",
         "Nuevo rol de solo lectura para la dueña del edificio. Migración 015 añade el rol y la guarda de acceso: "
         "/admin/ejecutivo es accesible solo para 'dueño' y 'admin'; el observador no puede modificar nada.",
         "Migración 015 + ADR-019"],
        ["El dashboard NO inventa datos",
         "Las 3 secciones reusan los KPIs y vistas existentes: vista materializada del S7 (mantenimiento), facturas "
         "del S8/S9 (finanzas) y pedidos del S10/S11 (tienda). Es consolidación visual, no nuevos cálculos.",
         "ADR-019 + reusa S7/S8/S9/S10/S11"],
        ["Gráficas y code splitting",
         "Gráficas con Recharts (S7). /admin/ejecutivo se carga con lazy load por ruta para no inflar el bundle "
         "(riesgo R-RM4 del roadmap); se valida con Lighthouse (chore del S13 ya consolidado).",
         "ADR-006 (Recharts) + ADR-019"],
        ["Seed de respaldo para el broche",
         "Si los datos reales no alcanzan para una demo contundente, se usa el seed de 3 años del Addendum S10 "
         "(riesgo R-RM2 del roadmap). El dashboard se ve igual de completo.",
         "Addendum S10 (seed)"],
        ["Release candidate + smoke tests",
         "Tag v1.0.0-rc en main + deploy final a staging. Antes del tag, smoke tests post-deploy (login, home del "
         "residente, emisión de factura, dashboard ejecutivo) actúan como gate (Acción 2 del Retro S13). Si fallan, "
         "no hay tag.",
         "RELEASE + Acción 2 Retro S13"],
        ["Checklist de datos sensibles en PR",
         "Cada PR del Sprint verifica que no se persisten ni filtran datos sensibles (PAN, CVV, contraseñas) — "
         "Acción 3 del Retro S13, ya incorporada al DoD.",
         "conventions.md + Acción 3 Retro S13"],
    ],
    [1.45, 4.05, 1.2]))

B(sub("Desglose de tareas — ¿Cómo?"))

B(para("<b>Santiago Flores Carlos — HU-EJEC-02 + HU-EJEC-04 (5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Sección 'Mantenimiento' del dashboard: gráfica de barras del volumen mensual de solicitudes resueltas "
         "(último trimestre), tendencia de tiempos de resolución y top categorías. Reusa la vista materializada del "
         "S7.", "3 h"],
        ["Sección 'Tienda' del dashboard: ingresos del mes, top 5 productos y tendencia de ventas. Reusa los datos "
         "de pedidos del S10/S11.", "2 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Gonza Morales Yoel — HU-EJEC-03 (3 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Sección 'Finanzas' del dashboard: gráfica circular de ingresos por tipo (luz / agua / pensión separados) y "
         "ratio cobrado / pendiente. Reusa las facturas del S8/S9; el ratio refleja la mejora de cobranza tras las "
         "tarjetas guardadas del S13.", "3 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Cortez Zamora Leonardo — HU-EJEC-01 + RELEASE (3 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["HU-EJEC-01: rol 'observador' (Migración 015) + ruta /admin/ejecutivo con guarda de acceso (solo dueño / "
         "admin; el observador es de solo lectura). Test del rol.", "2 h"],
        ["RELEASE: tag v1.0.0-rc en main + deploy final a staging + smoke tests post-deploy como gate (Acción 2 del "
         "Retro S13). Documentar la evidencia del release.", "1 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Todo el equipo (PO + SM + Devs) — Demo final (2 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Ensayo de la demo final integral de todos los módulos del curso (Auth → Mantenimiento → Trazabilidad → "
         "Realtime → Métricas → Facturación → Tienda → Comunicación → Panel integral + tarjetas → Dashboard "
         "ejecutivo) + grabación de evidencia académica + retrospectiva del curso.", "2 h"],
    ],
    [5.9, 0.8]))

B(sub("Riesgos del Sprint 14"))
B(table(
    ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"],
    [
        ["R1", "El dashboard ejecutivo depende de datos reales de todos los módulos; si alguno escasea, el broche "
         "pierde fuerza.",
         dotline("Media"), dotline("Alto"),
         "Seed de 3 años del Addendum S10 como respaldo (riesgo R-RM2 del roadmap): el dashboard se ve completo "
         "aunque los datos reales no alcancen."],
        ["R2", "Las gráficas con Recharts inflan el bundle y bajan la performance.",
         dotline("Media"), dotline("Medio"),
         "Code splitting / lazy load por ruta de /admin/ejecutivo (riesgo R-RM4 del roadmap); validado con Lighthouse "
         "(chore consolidado del S13)."],
        ["R3", "El rol 'observador' podría modificar datos si la guarda falla.",
         dotline("Baja"), dotline("Alto"),
         "Rol de solo lectura + RLS + guarda de ruta (solo dueño / admin); test del rol que verifica que el "
         "observador no puede escribir."],
        ["R4", "Se etiqueta el release candidate con un bug que rompe un flujo crítico.",
         dotline("Baja"), dotline("Alto"),
         "Smoke tests post-deploy como gate antes del tag (Acción 2 del Retro S13): si fallan, no hay v1.0.0-rc."],
        ["R5", "Adelantar la demo del dashboard en una Review previa le resta impacto como broche.",
         dotline("Baja"), dotline("Bajo"),
         "Se reserva su presentación para el S14 (recordatorio del roadmap): no se adelanta en Reviews anteriores."],
        ["R6", "La demo final integral se hace larga y pierde el hilo entre tantos módulos.",
         dotline("Media"), dotline("Bajo"),
         "Guión ensayado con tiempos por módulo; el dashboard ejecutivo sirve de hilo conductor del recorrido."],
    ],
    [0.4, 1.85, 0.7, 0.7, 3.05]))

# --------------------------------------------------------------------------- #
#  2 · REGISTRO DE DAILY SCRUMS                                                #
# --------------------------------------------------------------------------- #
B(sec(2, "Registro de Daily Scrums"))
B(note("Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y adapta el Sprint Backlog. "
       "Duración máxima: 15 minutos."))
B(goal("Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) en una sola vista + rol observador. "
       "Release candidate v1.0.0-rc con smoke tests post-deploy. Ensayo de la demo final integral del curso.",
       prefix="Sprint Goal:"))

B(sub("Daily Scrum — Día 1 (Lunes)"))
B(meta([
    ("DÍA", "Lunes — Día 1"),
    ("Progreso hacia el objetivo",
     "Migración 015 con el rol 'observador' lista y la ruta /admin/ejecutivo con guarda de acceso (solo dueño / "
     "admin). Esqueleto del dashboard en una sola página con las 3 secciones maquetadas. Sección 'Mantenimiento' "
     "cableada a la vista materializada del S7. Decidido el seed de 3 años del Addendum S10 como respaldo del broche."),
    ("Plan siguiente 24h",
     "Santiago: completar 'Mantenimiento' (tiempos + top categorías) + arrancar 'Tienda'. Gonza: sección 'Finanzas' "
     "(ingresos por tipo + ratio cobrado/pendiente). Cortez: cerrar la guarda del rol + preparar el workflow de "
     "smoke tests."),
    ("Impedimentos",
     "Discutimos si el dashboard debía recalcular KPIs o reusar las vistas existentes. Decisión: reusar (no inventa "
     "datos), coherente con el cierre narrativo del roadmap."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

B(sub("Daily Scrum — Día 2 (Martes)"))
B(meta([
    ("DÍA", "Martes — Día 2"),
    ("Progreso hacia el objetivo",
     "Dashboard con las 3 secciones mostrando gráficas reales (Recharts): volumen y tiempos de mantenimiento, "
     "ingresos por tipo con circular y ratio cobrado/pendiente, ingresos de tienda con top 5. Lazy load de la ruta "
     "para no inflar el bundle. Smoke tests post-deploy escritos (login, home, factura, dashboard)."),
    ("Plan siguiente 24h",
     "Santiago: pulir 'Tienda' (tendencia) + responsive del dashboard. Gonza: rematar 'Finanzas' + verificar que el "
     "observador no puede escribir. Cortez: integrar los smoke tests como gate y ensayar el deploy final."),
    ("Impedimentos",
     "El bundle de /admin/ejecutivo creció por las gráficas; se aplicó lazy load por ruta (riesgo R-RM4) y volvió a "
     "rango. Sin impedimento mayor."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

B(sub("Daily Scrum — Día 3 (Miércoles)"))
B(meta([
    ("DÍA", "Miércoles — Día 3"),
    ("Progreso hacia el objetivo",
     "Dashboard ejecutivo completo y demostrable: la Sra. Rosa Díaz (rol observador) abre /admin/ejecutivo y ve las "
     "3 secciones consolidadas en una sola página. Smoke tests post-deploy en verde como gate; tag v1.0.0-rc "
     "etiquetado tras pasar el gate. Guión de la demo final integral ensayado de punta a punta."),
    ("Plan siguiente 24h",
     "Todo el equipo: ensayo final de la demo integral con tiempos por módulo + grabación de evidencia académica. "
     "SM: preparar la retro del curso. PO: cerrar la presentación del broche."),
    ("Impedimentos",
     "Ninguno relevante. El seed de 3 años del Addendum S10 hizo que las gráficas se vieran completas sin depender "
     "de datos reales escasos."),
    ("Ajuste Sprint Backlog", "Sin cambios. Alcance cerrado respetado (Acción 1 del Retro S13)."),
]))

# --------------------------------------------------------------------------- #
#  3 · ACTA DE SPRINT REVIEW                                                   #
# --------------------------------------------------------------------------- #
B(sec(3, "Acta de Sprint Review"))
B(note("Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina adaptaciones futuras. "
       "En el Sprint final, además, sirve de demo final integral del producto ante todos los stakeholders."))
B(meta([
    ("Sprint", "Sprint 14 — Semana 16 · Broche del curso"),
    ("Fecha", "Viernes — cierre de semana 16 · Demo final del curso"),
    ("Duración", "70 minutos (incluye la demo final integral)"),
    ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
    ("Scrum Team", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos"),
    ("Stakeholders",
     "Sra. Rosa Díaz (Dueña — estrena su dashboard ejecutivo), Carlos Fuentes (Admin), Laura Vega (Residente), "
     "Profesor del curso (evaluación final)"),
    ("Modalidad de demo",
     "Demo final integral del producto: recorrido por todos los módulos del curso, con el dashboard ejecutivo del "
     "dueño como hilo conductor y cierre. Se muestra el tag v1.0.0-rc desplegado en staging."),
]))
B(sub("Guión de demostración — Demo final integral"))
B(numlist([
    "Recorrido rápido por los módulos del curso: Auth (login por rol), Mantenimiento (solicitud → asignación → "
    "cierre → confirmación), Trazabilidad (audit log + historial), Métricas (KPIs + gráficas), Facturación (emisión "
    "+ cobro + recordatorios + comprobante), Tienda (carrito → pedido → factura) y Comunicación (tablón de anuncios "
    "en vivo).",
    "Panel integral del residente (S13): Laura ve su home con las 3 tarjetas y paga una factura con su tarjeta "
    "guardada (tokenizada, sin PAN ni CVV) — Addendum del profesor.",
    "Broche: la Sra. Rosa Díaz inicia sesión con rol 'observador' y abre /admin/ejecutivo.",
    "Sección 'Mantenimiento': gráfica de volumen mensual de solicitudes resueltas (último trimestre), tendencia de "
    "tiempos de resolución y top categorías.",
    "Sección 'Finanzas': gráfica circular de ingresos por tipo (luz / agua / pensión) y ratio cobrado / pendiente; "
    "se comenta que el ratio mejoró tras las tarjetas guardadas del S13.",
    "Sección 'Tienda': ingresos del mes, top 5 productos y tendencia de ventas.",
    "Se muestra que el rol 'observador' es de solo lectura: la Sra. Díaz no puede modificar nada (guarda + RLS).",
    "Cierre técnico: se exhibe el tag v1.0.0-rc desplegado en staging y el reporte de smoke tests post-deploy en "
    "verde (gate del release).",
]))
B(goal(
    chk() + " CUMPLIDO: Dashboard ejecutivo del dueño operativo — la Sra. Rosa Díaz ve, en una sola página, "
    "Mantenimiento + Finanzas + Tienda consolidados en gráficas de alto nivel, con rol 'observador' de solo lectura. "
    "Release Candidate v1.0.0-rc etiquetado en staging tras pasar los smoke tests post-deploy. Demo final integral "
    "ensayada y grabada. DoD v3 completada en todos sus criterios. Décimo Sprint consecutivo sin hotfixes — curso "
    "cerrado."))

B(sub("Feedback de stakeholders"))
B(para("<b>Sra. Rosa Díaz (Dueña del edificio)</b>"))
B(bullets([
    "«Por fin veo el edificio de un vistazo: cuánto se resuelve, cuánto se cobra y cuánto se vende, sin pedirle "
    "reportes a nadie.» → Validación del broche.",
    "«Que pagar sea más fácil para los residentes se nota en el ratio de cobranza.» → Validación de la cadena "
    "tarjetas guardadas (S13) → finanzas (S14).",
], marker="•"))
B(para("<b>Carlos Fuentes (Administrador)</b>"))
B(bullets([
    "«El dashboard de la dueña me sirve también a mí para el cierre de mes; no tengo que armar el resumen a mano.» → "
    "Validación.",
], marker="•"))
B(para("<b>Laura Vega (Residente)</b>"))
B(bullets([
    "«En estas semanas pasé de pedir todo por WhatsApp a tener solicitudes, facturas, tienda y avisos en un solo "
    "lugar, y pagar con un par de clics.» → Validación del producto completo.",
], marker="•"))
B(para("<b>Profesor del curso</b>"))
B(bullets([
    "«El dashboard ejecutivo es el cierre correcto: no inventa datos, consolida todo lo construido y le da por fin su "
    "feature a la dueña, que era el stakeholder pendiente del PRD.» → Validación del broche.",
    "«El equipo mantuvo el enfoque funcional las 16 semanas, repartió la calidad como chores y entregó un release "
    "candidate con smoke tests. La sugerencia de las tarjetas guardadas quedó resuelta con tokenización.» → "
    "Validación final de DoD v3 y del curso.",
], marker="•"))

B(sub("Decisiones de adaptación del Product Backlog"))
B(table(
    ["Decisión", "Detalle"],
    [
        ["DoD v3 — completa", "El release candidate v1.0.0-rc + demo final reproducible cierran el último criterio "
                              "pendiente. Todos los criterios de DoD v3 quedan cumplidos."],
        ["Cero hotfixes", "Décimo Sprint consecutivo sin hotfixes — práctica consolidada durante todo el curso."],
        ["Broche entregado", "La dueña del edificio (Sra. Rosa Díaz) estrenó su dashboard ejecutivo; el stakeholder "
                             "pendiente del PRD ya tiene su feature."],
        ["Producto en release candidate", "El producto queda etiquetado v1.0.0-rc en staging, con smoke tests "
                                          "post-deploy como gate; listo para evaluación final."],
        ["Backlog post-curso", "Quedan como mejoras opcionales post-curso: Web Push avanzado (Service Worker + "
                               "VAPID), Twilio Verify 2FA, y los emergentes no entregados (S10-E01, S11-E01/E02/E03, "
                               "S12-E01/E02, S13-E01/E02)."],
        ["Curso cerrado", "No hay Sprint 15: el S14 es el broche del cronograma de 16 semanas. El roadmap queda como "
                          "documento histórico del proyecto."],
    ],
    [1.7, 5.0]))

# --------------------------------------------------------------------------- #
#  4 · ACTA DE SPRINT RETROSPECTIVE — RETRO DEL CURSO                          #
# --------------------------------------------------------------------------- #
B(sec(4, "Acta de Sprint Retrospective — Retro del curso"))
B(note("Referencia Scrum: la Retrospective del Sprint final sirve además de retrospectiva del proyecto completo: "
       "inspecciona las 16 semanas y consolida los aprendizajes para futuros proyectos."))
B(meta([
    ("Sprint", "Sprint 14 — Semana 16 · Retro del curso"),
    ("Fecha", "Viernes — después de la demo final"),
    ("Duración", "45 minutos (retro ampliada del curso)"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
]))
B(sub(chk() + " ¿Qué salió bien? (Sprint 14 y curso completo)"))
B(bullets([
    "Las tres acciones del Retro S13 se aplicaron: el alcance del S14 se congeló sin addendums (Acción 1); los smoke "
    "tests post-deploy actuaron como gate antes del tag v1.0.0-rc (Acción 2); y el checklist de datos sensibles "
    "quedó en la revisión de PR (Acción 3).",
    "El dashboard ejecutivo reusó todo lo construido (KPIs S7, facturas S8/S9, pedidos S10/S11) sin inventar datos: "
    "el broche fue casi 'ensamblar', no 'construir desde cero'.",
    "El enfoque funcional del roadmap se sostuvo las 16 semanas: cada Sprint cerró con un entregable demostrable y la "
    "parte técnica entró como chore, sin sprints dedicados a calidad.",
    "La DoD escalonada (v1 → v2 → v3) acompañó el aumento de exigencia sin frenar la entrega; cada criterio técnico "
    "tuvo dueño y Sprint asignado.",
    "Diez Sprints consecutivos sin hotfixes — calidad sostenida de punta a punta.",
    "Las dos sugerencias del profesor (Addendum S10: seed + pago simulado + SUS; Addendum S13: tarjetas guardadas "
    "con tokenización) se integraron sin descarrilar el roadmap.",
], marker="•"))
B(sub(xmk() + " ¿Qué salió mal / qué mejorar a futuro?"))
B(bullets([
    "Acumular emergentes para 'cuando haya buffer' hizo que varios (quick view, export de pedidos, anuncios por "
    "email) nunca entraran; a futuro, priorizarlos explícitamente o descartarlos en la Review, no dejarlos en "
    "limbo.",
    "Los addendums del profesor, aunque valiosos, comprimieron el buffer; conviene reservar capacidad explícita para "
    "lo emergente cuando se sabe que el stakeholder propondrá mejoras.",
    "Algunas decisiones técnicas (markdown vs texto en S12, guardar o no el CVV en S13) se resolvieron en Daily; "
    "haberlas cerrado en el Refinement habría ahorrado tiempo.",
], marker="•"))

B(sub("Aprendizajes del curso (para futuros proyectos)"))
B(para("<b>Aprendizaje 1 — El enfoque funcional sostiene la motivación</b>"))
B(meta([
    ("Descripción", "Cerrar cada Sprint con algo visible y demostrable mantuvo el ritmo y el feedback de "
                    "stakeholders, mejor que dedicar sprints completos a tareas técnicas invisibles."),
    ("Evidencia", "16 semanas con un entregable demostrable por Sprint; cero sprints 'técnicos' sin demo"),
]))
B(para("<b>Aprendizaje 2 — La calidad como chore funciona si tiene dueño y fecha</b>"))
B(meta([
    ("Descripción", "Repartir E2E, CD, no-PII, OWASP y Lighthouse como chores con dueño y Sprint asignado evitó que "
                    "la calidad se postergara, sin convertirla en protagonista."),
    ("Evidencia", "Todos los criterios de DoD v3 cumplidos vía chores intercalados (S7 a S14)"),
]))
B(para("<b>Aprendizaje 3 — Reusar lo construido acelera el cierre</b>"))
B(meta([
    ("Descripción", "El sistema Realtime del S6, el patrón de Storage del S3/S10 y las vistas del S7 se reusaron una "
                    "y otra vez; el broche del S14 fue mayormente ensamblaje. Diseñar pensando en reuso pagó."),
    ("Evidencia", "Dashboard ejecutivo, tablón de anuncios y panel integral construidos sobre infraestructura previa"),
]))

B(sub("Verificación DoD v3 — aplicación FINAL"))
B(table(
    ["Criterio", "Estado"],
    [
        ["Todo lo de DoD v2 (lint, unit + integration, cobertura ≥ 60%, /health, Secrets, tsc, CD con verificación)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["E2E mínimos de módulos críticos (mantenimiento + facturación + tienda + demo final integral) en pipeline",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Regresión: tocar un flujo crítico dispara unit + integration + E2E",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Evidencia de no-PII en logs (cumplido desde el S11; reforzado con tokenización de tarjetas en el S13)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Checklist OWASP top 10 aplicada (cumplido como chore del S12)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Performance: Lighthouse ≥ 80 en rutas principales (cumplido como chore del S13)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Release candidate etiquetado (v1.0.0-rc) + smoke tests post-deploy + demo final reproducible",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — chore del Sprint</b></font>"],
        ["ADR-019 (rol observador + consolidación del dashboard ejecutivo) documentado",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — adicional a DoD v3</b></font>"],
    ],
    [4.4, 2.3]))
B(goal(
    "DoD v3 completada en todos sus criterios: el release candidate v1.0.0-rc + demo final reproducible cierran el "
    "último pendiente. El producto Zity queda íntegro, demostrable y etiquetado para evaluación. Sprint 14 cerrado "
    "como broche del curso; décimo Sprint consecutivo sin hotfixes."))

# --------------------------------------------------------------------------- #
#  5 · HISTORIAS DE USUARIO — SPRINT 14                                        #
# --------------------------------------------------------------------------- #
B(sec(5, "Historias de Usuario — Sprint 14"))
B(sub("Módulo DASHBOARD EJECUTIVO — Broche del curso — Sprint 14"))

B(hucard(
    "HU-EJEC-01", "Rol 'observador' + ruta /admin/ejecutivo", "Sprint 14 · 2 h", "P1 · 2 h",
    "Como <b>dueña del edificio</b>, quiero <b>un acceso de solo lectura a un panel ejecutivo</b>, para ver el estado "
    "del edificio sin poder modificar nada operativo.",
    [
        "Migración 015 añade el rol 'observador' (solo lectura) al sistema.",
        "La ruta /admin/ejecutivo tiene guarda de acceso: solo 'dueño' / 'admin'; el observador no puede escribir.",
        "El rol observador queda cubierto por RLS (solo SELECT en las vistas que consume el dashboard).",
        "Un test del rol verifica que el observador no puede modificar datos.",
    ],
    "La Sra. Rosa Díaz entró con rol observador, vio /admin/ejecutivo y no pudo modificar nada; un residente o "
    "técnico no accede a la ruta. ADR-019 documenta el rol."))

B(hucard(
    "HU-EJEC-02", "Sección 'Mantenimiento' del dashboard", "Sprint 14 · 3 h", "P1 · 3 h",
    "Como <b>dueña del edificio</b>, quiero <b>ver el desempeño de mantenimiento en gráficas</b>, para saber cuánto "
    "se resuelve y en qué tiempos.",
    [
        "Gráfica de barras del volumen mensual de solicitudes resueltas (último trimestre).",
        "Tendencia de los tiempos promedio de resolución.",
        "Top categorías de solicitudes.",
        "Reusa la vista materializada vw_metricas_solicitudes del S7 (no inventa datos).",
    ],
    "La sección mostró el volumen del trimestre, la tendencia de tiempos y las categorías top, con datos del seed de "
    "3 años."))

B(hucard(
    "HU-EJEC-03", "Sección 'Finanzas' del dashboard", "Sprint 14 · 3 h", "P1 · 3 h",
    "Como <b>dueña del edificio</b>, quiero <b>ver los ingresos por facturación y el ratio de cobranza</b>, para "
    "entender la salud financiera del edificio.",
    [
        "Gráfica circular de ingresos por tipo (luz / agua / pensión separados).",
        "Ratio cobrado / pendiente del periodo.",
        "Reusa las facturas del S8/S9; el ratio refleja la mejora de cobranza tras las tarjetas guardadas del S13.",
        "No inventa datos: consolida lo emitido y lo pagado.",
    ],
    "La sección mostró los ingresos por tipo en circular y el ratio cobrado/pendiente, con la mejora atribuible al "
    "pago con tarjetas guardadas."))

B(hucard(
    "HU-EJEC-04", "Sección 'Tienda' del dashboard", "Sprint 14 · 2 h", "P1 · 2 h",
    "Como <b>dueña del edificio</b>, quiero <b>ver los ingresos y los productos más vendidos de la tienda</b>, para "
    "conocer el aporte de la tienda interna.",
    [
        "Ingresos de la tienda del mes.",
        "Top 5 productos más vendidos.",
        "Tendencia de ventas.",
        "Reusa los datos de pedidos del S10/S11.",
    ],
    "La sección mostró los ingresos del mes, el top 5 de productos y la tendencia de ventas con datos del seed."))

B(hucard(
    "RELEASE", "Release Candidate v1.0.0-rc + smoke tests", "Sprint 14 · 1 h", "P1 · 1 h",
    "Como <b>equipo</b>, quiero <b>etiquetar el producto como release candidate con un gate de smoke tests</b>, para "
    "entregar una versión estable y verificada para la evaluación final.",
    [
        "Deploy final a staging desde main.",
        "Smoke tests post-deploy (login, home del residente, emisión de factura, dashboard ejecutivo) como gate "
        "(Acción 2 del Retro S13).",
        "Si los smoke tests pasan, se etiqueta v1.0.0-rc en main; si fallan, no hay tag.",
        "Se documenta la evidencia del release.",
    ],
    "Los smoke tests post-deploy pasaron en verde y se etiquetó v1.0.0-rc en staging; la evidencia quedó registrada."))

B(hucard(
    "Demo", "Demo final integral + retro del curso", "Sprint 14 · 2 h", "P1 · 2 h",
    "Como <b>equipo</b>, quiero <b>ensayar y grabar la demo final integral</b>, para cerrar el curso con una "
    "presentación completa del producto.",
    [
        "Guión de demo de todos los módulos del curso, con el dashboard ejecutivo como hilo conductor y cierre.",
        "Tiempos por módulo ensayados para no perder el hilo.",
        "Grabación de la evidencia académica.",
        "Retrospectiva del curso completo con los aprendizajes consolidados.",
    ],
    "El equipo ensayó la demo final integral, la grabó como evidencia y cerró con la retro del curso."))

B(para(
    "<b>Chore técnico del Sprint:</b> smoke tests post-deploy del staging final como gate antes del tag v1.0.0-rc "
    "(Acción 2 del Retro S13), incluido en el PBI RELEASE. Cierra el ciclo de calidad del curso. P1."))

B(sub("Backlog post-curso (mejoras opcionales)"))
B(table(
    ["ID", "Historia", "Prior.", "Horas est.", "Estado"],
    [
        ["HU-PUSH-01", "Web Push avanzado (Service Worker + VAPID) — Realtime + email ya cubren el aviso", dot("P3"),
         "9 h", "Post-curso"],
        ["HU-AUTH-07", "Twilio Verify 2FA (descartado del roadmap por no ser visual)", dot("P3"), "5 h", "Post-curso"],
        ["PBI-S13-E01", "Aviso por email al guardar / usar una tarjeta (reusa Resend)", dot("P3"), "1.5 h",
         "Post-curso"],
        ["PBI-S13-E02", "Indicador de pagos por método en /admin/facturacion", dot("P3"), "1.5 h", "Post-curso"],
        ["PBI-S12-E01/E02", "Anuncios urgentes por email + indicador de lectura para el admin", dot("P2"), "3.5 h",
         "Post-curso"],
        ["PBI-S10/S11-Exx", "Quick view, desglose del pedido, export de pedidos, cancelar pedido", dot("P3"), "6 h",
         "Post-curso"],
    ],
    [1.05, 3.3, 0.7, 0.85, 0.8]))
B(note("Nota: el producto queda como release candidate (v1.0.0-rc) con todos los módulos del curso entregados. Estas "
       "mejoras son opcionales y no condicionan la entrega académica."))

# --------------------------------------------------------------------------- #
#  6 · ESTADO DEL BACKLOG TRAS SPRINT 14 — CIERRE DEL CURSO                    #
# --------------------------------------------------------------------------- #
B(sec(6, "Estado del Backlog tras Sprint 14 — Cierre del curso"))
B(sub("Progreso acumulado — Curso completo"))
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
        ["Sprint 11", "13 h", "Tienda interna v2: carrito + descuento atómico + pedido → factura + vista admin · "
         "primer DoD v3", done],
        ["Sprint 12", "13 h", "Comunicación: tablón de anuncios del edificio + OWASP · absorbe PBI-S9-E02", done],
        ["Sprint 13", "13 + 7 h", "Panel integral del residente (3 tarjetas) + sesiones + Lighthouse · Addendum del "
         "profesor (métodos de pago: tarjetas guardadas tokenizadas)", done],
        ["Sprint 14", "13 h", star() + " Dashboard ejecutivo del dueño + Release Candidate (v1.0.0-rc) + demo final "
         "integral", done],
    ],
    [0.95, 0.85, 3.7, 1.2]))
B(para("<b>Total invertido:</b> 211.5 horas en 15 sprints (Sprint 0 → Sprint 14), incluidas las 8 h del Addendum del "
       "S10 y las 7 h del Addendum del S13 a pedido del profesor."))
B(para("<b>Velocidad promedio:</b> 13.1 horas/sprint de trabajo comprometido, estable durante todo el curso "
       "(referencia inicial: 13.2 h/sprint)."))
B(para("<b>Resultado:</b> producto Zity completo y etiquetado como release candidate v1.0.0-rc; los 15 incrementos "
       "del curso entregados y demostrados."))

B(sub("Producto entregado — Módulos del curso"))
B(table(
    ["Módulo", "Qué incluye", "Sprints"],
    [
        ["Autenticación", "Registro en 2 pasos, login por rol, recuperación de contraseña, sesiones activas",
         "S1 · S13"],
        ["Gestión de usuarios", "Panel admin, invitaciones, bloqueo / desbloqueo", "S2"],
        ["Mantenimiento", "Solicitudes con foto, asignación, vista técnico, cierre, confirmación del residente",
         "S3 · S4"],
        ["Trazabilidad", "Audit log visible, historial de estados, perfil editable", "S5"],
        ["Comunicación Realtime", "Notificaciones en vivo + email + alertas; tablón de anuncios del edificio",
         "S6 · S12"],
        ["Métricas", "Dashboard de KPIs con gráficas Recharts + exportación CSV + vista materializada", "S7"],
        ["Facturación", "Emisión individual / lote, cobros, recordatorios, vencida, comprobante PDF", "S8 · S9"],
        ["Tienda interna", "Catálogo, carrito, descuento atómico, pedido → factura mensual, vista admin de pedidos",
         "S10 · S11"],
        ["Experiencia del residente", "Panel integral (3 tarjetas) + métodos de pago (tarjetas guardadas "
         "tokenizadas)", "S13"],
        ["Dashboard ejecutivo", "Consolidación de Mantenimiento + Finanzas + Tienda para la dueña (rol observador)",
         "S14"],
    ],
    [1.55, 4.0, 1.15]))

B(sub("Variables de entorno acumuladas al cierre del curso"))
B(para("El producto cierra sin variables nuevas en el S14. La tabla acumulada se mantiene desde el S10:"))
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
B(note("Ninguna de estas variables debe aparecer en el código fuente ni en commits. Todas van en .env.local (local) "
       "y en Secrets de GitHub/Vercel (CI/CD). El producto no almacena datos sensibles de tarjeta (solo tokenizados: "
       "marca + últimos 4 + token), sin PAN ni CVV."))

B(finalnote("— Zity · Artefactos Sprint 14 · Broche del curso · v1.0.0-rc · Documento de cierre del proyecto —"))

# --------------------------------------------------------------------------- #
OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "sprints", "Zity_Sprint14_Artefactos.pdf"))
build_pdf(BLOCKS, FOOT, OUT)
print("OK ->", OUT)
