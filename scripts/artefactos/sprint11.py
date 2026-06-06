# -*- coding: utf-8 -*-
"""
Artefactos Scrum — Zity · Sprint 11 (Semana 13) · Tienda interna v2 (carrito + integración con factura).

Contenido derivado de:
  - Zity_Roadmap_Sprints.pdf  (Sprint 11 — Tienda interna v2: carrito + pedido se suma a la factura mensual)
  - Continuidad con Zity_Sprint10_Artefactos (catálogo v1, pedidos/pedido_items ya modelados, acciones del Retro S10).
  - DoD v3 (primera aplicación): E2E de módulos críticos en pipeline + no-PII en logs.

Render:  python sprint11.py   (desde scripts/artefactos/)
"""
import os
from zity_artefactos import (
    cover, sec, meta, goal, note, sub, para, bullets, numlist, table, spacer,
    finalnote, hucard, dot, dotline, chk, xmk, star, build_pdf,
)

FOOT = " · Artefactos Scrum · Sprint 11"

BLOCKS = []
B = BLOCKS.append

# --------------------------------------------------------------------------- #
#  PORTADA                                                                     #
# --------------------------------------------------------------------------- #
B(cover(
    "Sprint 11",
    "Artefactos Scrum — Sprint 11",
    "Tienda interna v2 — Cerrar el ciclo de la tienda: el residente arma un carrito y confirma su pedido; al "
    "confirmar, el stock se descuenta de forma atómica (sin sobreventa) y, al cierre de mes, el pedido se suma como "
    "una factura de tipo 'tienda' a sus cargos. El admin ve todas las órdenes con filtros · Chore: privacidad / "
    "no-PII en los logs de tienda y factura · Primera aplicación de DoD v3",
    [
        ("Producto", "Zity"),
        ("Sprint", "Sprint 11 — Semana 13"),
        ("Stack", "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                  "Resend · Vercel · GitHub Actions · Vitest · Playwright (E2E, exigido por DoD v3) · "
                  "Recharts (S7) · pdf-lib (S9) · pg_cron (S9)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers", "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "13 horas (2 horas de buffer)"),
        ("DoD aplicable", "DoD v3 — primera aplicación (E2E de módulos críticos en pipeline, regresión, no-PII en "
                          "logs y, hacia el S14, entrega como release candidate)"),
        ("Nuevo en este sprint",
         "Carrito del residente con confirmación de pedido y descuento atómico de stock (RPC transaccional) · "
         "integración pedido → factura mensual mediante un nuevo tipo de factura 'tienda' · historial de pedidos "
         "(residente y admin) · mini-carrito en la navbar · primer E2E del flujo crítico de tienda y logs sin PII "
         "(arranque de DoD v3)"),
        ("Chore técnico del Sprint",
         "Privacidad / no-PII: revisar y limpiar los logs de los módulos de tienda y factura para que solo guarden "
         "IDs (sin nombres ni correos). Cumple el criterio de no-PII de DoD v3. 2 h, P2."),
        ("Variables nuevas",
         "Ninguna. El Sprint reusa las variables del S10; los Sprints siguientes (tablón de anuncios, panel integral, "
         "dashboard ejecutivo) tampoco añaden secretos nuevos."),
        ("Cierre de Epic",
         "Con la Tienda v2 se cierra el Epic TIENDA-01: catálogo (S10) + carrito e integración con la factura "
         "mensual (S11). La tienda queda completa como dominio funcional del producto."),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ],
))

# --------------------------------------------------------------------------- #
#  1 · ACTA DE SPRINT PLANNING                                                 #
# --------------------------------------------------------------------------- #
B(sec(1, "Acta de Sprint Planning"))
B(meta([
    ("Sprint", "Sprint 11 — Semana 13"),
    ("Fecha", "Lunes — inicio de semana 13"),
    ("Duración del evento", "75 minutos + 30 min de Refinement con validación de breakpoints del carrito "
                            "(Acción 3 del Retro S10)"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Asistentes", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
    ("Stakeholder invitado",
     "Laura Vega (Residente ficticia) — como compradora de la tienda, valida el flujo del carrito y la confirmación "
     "del pedido y qué espera ver reflejado en su factura del mes. Tercera aplicación de la Acción 2 del Retro S8."),
    ("Capacidad", "15 horas disponibles · se usarán 13 h (2 h de buffer)"),
    ("Entrada",
     "Product Backlog tras Sprint 10 Review. La Tienda v1 (catálogo) quedó operativa y la DoD v2 cerrada del todo con "
     "el CD a staging. Entra la Tienda v2 (carrito + integración con la factura) que cierra el Epic TIENDA-01 e "
     "inaugura DoD v3."),
    ("Refinement previo",
     "Séptima aplicación de la práctica. 'Edge cases del dominio' (Acción 3 del Retro S9, consolidada): «¿qué pasa si "
     "dos residentes compran la última unidad a la vez?», «¿el carrito persiste si recargo la página?», «¿se puede "
     "cancelar un pedido confirmado antes del cierre?». Se validan los breakpoints del carrito (360 / 768 / 1024 px) "
     "en el spike, no al final (Acción 3 del Retro S10)."),
]))
B(goal(
    "Cerrar el ciclo de la tienda: el residente arma un carrito y confirma su pedido; al confirmar, el stock se "
    "descuenta de forma atómica (sin sobreventa) y, al cierre de mes, el pedido se consolida como una factura de "
    "tipo 'tienda' en sus cargos del mes. El admin ve todas las órdenes con filtros. Primera aplicación de DoD v3.",
    prefix="Sprint Goal:"))
B(note(
    "Nota: Primera aplicación de DoD v3. En este Sprint se cumplen los criterios de E2E del flujo crítico de tienda y "
    "de no-PII en logs; los criterios de OWASP, Lighthouse y release candidate se cumplen como chores del S12, S13 y "
    "S14. La Tienda v2 cierra el Epic TIENDA-01. El descuento de stock es atómico (transacción con SELECT ... FOR "
    "UPDATE) y la integración con la factura reusa la estructura del S9 agregando el tipo 'tienda'."))

B(sub("PBIs seleccionados — Sprint 11"))
B(table(
    ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"],
    [
        ["HU-TIENDA-03", "Carrito del residente + confirmación de pedido con descuento atómico de stock "
         "(RPC transaccional)", "Historia", dot("P1"), "3 h", "Santiago / Gonza"],
        ["HU-TIENDA-04", "El pedido confirmado se suma como factura de tipo 'tienda' a la factura mensual del "
         "residente", "Historia", dot("P1"), "3 h", "Gonza Morales"],
        ["HU-TIENDA-07", "Historial de pedidos del residente (/residente/tienda/historial)",
         "Historia", dot("P2"), "2 h", "Santiago Flores"],
        ["HU-TIENDA-08", "Vista admin de pedidos (todas las órdenes, filtros por residente/fecha/estado)",
         "Historia", dot("P2"), "2 h", "Santiago Flores"],
        ["Mejora", "Mini-carrito en la navbar con badge de unidades agregadas y subtotal",
         "Mejora", dot("P3"), "1 h", "Santiago Flores"],
        ["Chore-T", "Privacidad / no-PII: logs de tienda y factura solo con IDs (criterio DoD v3)",
         "Chore", dot("P2"), "2 h", "Cortez Zamora"],
        ["Buffer", "Reservado para imprevistos de la transacción de stock o del E2E con tiempo simulado",
         "—", dot("P2", "—"), "2 h", "—"],
    ],
    [0.95, 2.75, 0.75, 0.7, 0.55, 1.0]))
B(para("<b>Total estimado:</b> 13 horas comprometidas + 2 h de buffer (techo de 15 h)."))

B(sub("Decisiones técnicas del Sprint"))
B(para("Antes de empezar el desarrollo, el equipo cierra las siguientes decisiones técnicas:"))
B(table(
    ["Decisión", "Detalle", "Registrado en"],
    [
        ["Descuento atómico de stock",
         "RPC confirmar_pedido (SECURITY DEFINER) dentro de una transacción: SELECT ... FOR UPDATE sobre los "
         "productos del carrito, valida stock ≥ cantidad y descuenta; si algún ítem no alcanza, revierte toda la "
         "operación (nadie sobrevende). Test de concurrencia obligatorio: dos confirmaciones simultáneas por la "
         "última unidad, solo una gana.",
         "Migración 012 + ADR-013"],
        ["Ciclo de vida del pedido",
         "borrador (carrito activo, uno por residente) → confirmado (stock descontado) → facturado (sumado a la "
         "factura del mes). El carrito se persiste como pedido 'borrador' en BD y sobrevive a recargar la página.",
         "ADR-013 + conventions.md"],
        ["Integración pedido → factura",
         "Se añade 'tienda' al enum de tipos de factura (luz/agua/pensión/multas/tienda). Al cierre de mes, "
         "facturar_pedidos_periodo consolida los pedidos 'confirmado' del periodo en una factura de tipo 'tienda' "
         "(idempotente) y los marca 'facturado'; la factura enlaza a sus pedidos (pedidos.factura_id) para el "
         "desglose. Reusa la estructura y la notificación de facturas del S9.",
         "Migración 012 + ADR-014"],
        ["precio_unitario snapshot",
         "El pedido_item guarda el precio al momento de pedir (modelado en S10); un cambio de precio posterior no "
         "altera el total de pedidos ya hechos.",
         "Migración 011 (S10) + ADR-013"],
        ["no-PII en logs (DoD v3)",
         "Los logs de los módulos de tienda y factura guardan solo IDs (pedido_id, residente_id, factura_id); nunca "
         "nombres ni correos. Revisión en PR. Primer criterio nuevo de DoD v3.",
         "Chore-T + /docs/privacidad/no-pii.md"],
        ["E2E del flujo crítico (DoD v3)",
         "Playwright cubre carrito → confirmar → (cierre de mes) → factura de tienda, con un fixture de tiempo "
         "determinista. Corre como gate en CI. Inaugura los E2E de módulos críticos exigidos por DoD v3.",
         "ADR-014 + /docs/testing/e2e.md"],
    ],
    [1.45, 4.05, 1.2]))

B(sub("Desglose de tareas — ¿Cómo?"))

B(para("<b>Gonza Morales Yoel — HU-TIENDA-03 (RPC atómica) + HU-TIENDA-04 (5 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Migración 012: RPC confirmar_pedido (SECURITY DEFINER) con SELECT ... FOR UPDATE y descuento de stock en "
         "transacción; valida stock y que el pedido 'borrador' sea del propio residente. Test de concurrencia (dos "
         "confirmaciones por la última unidad).", "2 h"],
        ["Tipo 'tienda' en el enum de facturas + función facturar_pedidos_periodo (idempotente) que consolida los "
         "pedidos 'confirmado' del periodo en una factura de tipo 'tienda' y los marca 'facturado'; enlace "
         "factura ↔ pedidos.", "2 h"],
        ["Notificación de factura de tienda al residente (reusa el flujo de emisión del S8) + reflejo en los totales "
         "del periodo del panel admin.", "1 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Santiago Flores Carlos — HU-TIENDA-03 (UI) + HU-07 + HU-08 + Mejora (6 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Carrito en /residente/tienda: agregar/quitar productos, cambiar cantidad (tope = stock), subtotal por ítem "
         "y total; persiste como pedido 'borrador'. Pantalla de confirmación que invoca confirmar_pedido y vacía el "
         "carrito.", "2 h"],
        ["Historial de pedidos del residente (/residente/tienda/historial): lista con fecha, total y estado; detalle "
         "con ítems y precio_unitario; enlace a la factura si el pedido ya fue facturado.", "2 h"],
        ["Vista admin de pedidos (/admin/pedidos): todas las órdenes con filtros (residente, rango de fecha, estado) "
         "+ total del periodo. RLS: solo admin.", "1.5 h"],
        ["Mini-carrito en la navbar: ícono con badge de unidades del pedido 'borrador' y popover con subtotal; estado "
         "compartido que se actualiza al instante al agregar/quitar.", "0.5 h"],
    ],
    [5.9, 0.8]))

B(para("<b>Cortez Zamora Leonardo — Chore técnico: privacidad / no-PII (2 h)</b>"))
B(table(
    ["Tarea", "Horas"],
    [
        ["Auditar y limpiar los logs de los módulos de tienda y factura para que solo registren IDs (pedido_id, "
         "residente_id, factura_id), sin nombres ni correos. Documentar en /docs/privacidad/no-pii.md. Cumple el "
         "criterio de no-PII de DoD v3.", "1.5 h"],
        ["Aplicar la checklist de revisión de workflows (Acción 1 del Retro S10) al workflow que corre el E2E del "
         "flujo crítico en CI.", "0.5 h"],
    ],
    [5.9, 0.8]))

B(sub("Riesgos del Sprint 11"))
B(table(
    ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"],
    [
        ["R1", "Concurrencia en el descuento de stock: dos residentes compran la última unidad y se produce "
         "sobreventa.",
         dotline("Media"), dotline("Alto"),
         "RPC confirmar_pedido en transacción con SELECT ... FOR UPDATE; si el stock no alcanza, se revierte todo. "
         "Test de concurrencia explícito en CI."],
        ["R2", "Un pedido confirmado podría facturarse dos veces (doble cargo en la factura).",
         dotline("Media"), dotline("Alto"),
         "facturar_pedidos_periodo es idempotente y solo factura pedidos en estado 'confirmado'; al facturarlos pasan "
         "a 'facturado'. Test de doble ejecución del cierre."],
        ["R3", "El residente pierde el carrito al recargar o cambiar de dispositivo.",
         dotline("Baja"), dotline("Bajo"),
         "El carrito se persiste como pedido 'borrador' en BD (uno activo por residente), no en memoria; se recupera "
         "al volver."],
        ["R4", "El periodo del pedido y el de la factura no coinciden por timezone y un pedido cae en el mes "
         "equivocado.",
         dotline("Media"), dotline("Medio"),
         "Toda la lógica de fechas usa America/Lima (como el S9). Test del cierre en el borde de fin de mes."],
        ["R5", "Fuga de PII en los logs de los nuevos flujos (nombres / correos del residente).",
         dotline("Baja"), dotline("Alto"),
         "Chore no-PII: los logs guardan solo IDs; revisión obligatoria en PR. Cumple el criterio de DoD v3."],
        ["R6", "El E2E con avance de tiempo simulado resulta frágil (depende de la hora de ejecución).",
         dotline("Media"), dotline("Bajo"),
         "Fixture de tiempo determinista (no la hora real). Reusa seed:tiempo del S9. Se vuelve Acción 2 del Retro de "
         "este Sprint."],
        ["R7", "El residente confirma un pedido por error y no puede deshacerlo.",
         dotline("Media"), dotline("Bajo"),
         "Antes de confirmar, la pantalla muestra el resumen y pide confirmación explícita. Cancelar un pedido "
         "confirmado entra como PBI-S11-E02; se gestiona la expectativa en la Review."],
    ],
    [0.4, 1.85, 0.7, 0.7, 3.05]))

# --------------------------------------------------------------------------- #
#  2 · REGISTRO DE DAILY SCRUMS                                                #
# --------------------------------------------------------------------------- #
B(sec(2, "Registro de Daily Scrums"))
B(note("Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y adapta el Sprint Backlog. "
       "Duración máxima: 15 minutos."))
B(goal("Tienda v2: el residente arma un carrito y confirma su pedido (descuento atómico de stock), el pedido se suma "
       "a su factura del mes y el admin ve todas las órdenes. Chore: no-PII en los logs de tienda y factura.",
       prefix="Sprint Goal:"))

B(sub("Daily Scrum — Día 1 (Lunes)"))
B(meta([
    ("DÍA", "Lunes — Día 1"),
    ("Progreso hacia el objetivo",
     "Migración 012 lista: RPC confirmar_pedido con descuento atómico (SELECT ... FOR UPDATE en transacción) y el "
     "ciclo de estados del pedido (borrador → confirmado → facturado). Test de concurrencia escrito: dos "
     "confirmaciones de la última unidad, solo una gana. Carrito UI básico (agregar / quitar / cantidad) sobre el "
     "pedido 'borrador' persistido. Las tablas pedidos / pedido_items del S10 se reusan sin nueva migración de "
     "esquema."),
    ("Plan siguiente 24h",
     "Gonza: integración pedido → factura (tipo 'tienda' + facturar_pedidos_periodo). Santiago: pantalla de "
     "confirmación + vaciar carrito + historial del residente. Cortez: arranca el chore no-PII (auditar logs de "
     "tienda y factura)."),
    ("Impedimentos",
     "Discutimos si el carrito persiste entre sesiones. Decisión: sí, como pedido 'borrador' en BD (uno activo por "
     "residente), para no perderlo al recargar. Capturado como edge case en el Refinement."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

B(sub("Daily Scrum — Día 2 (Martes)"))
B(meta([
    ("DÍA", "Martes — Día 2"),
    ("Progreso hacia el objetivo",
     "Confirmación de pedido operativa: Laura arma un carrito y confirma; el stock baja atómicamente y el pedido pasa "
     "a 'confirmado'. Historial de pedidos del residente mostrando estado y desglose. Vista admin de pedidos con "
     "filtros (residente / fecha / estado). Comenzó la integración pedido → factura: tipo 'tienda' agregado al enum y "
     "función facturar_pedidos_periodo en pruebas."),
    ("Plan siguiente 24h",
     "Gonza: cerrar facturar_pedidos_periodo (idempotente) + notificación de factura de tienda (reusa S8). Santiago: "
     "mini-carrito en la navbar + pulir el detalle del pedido. Cortez: terminar la limpieza de logs (solo IDs) + E2E "
     "del flujo carrito → pedido → factura."),
    ("Impedimentos",
     "El periodo del pedido y el de la factura no coincidían por timezone; se unificó a America/Lima (como el S9). "
     "Corregido en el día."),
    ("Ajuste Sprint Backlog",
     "Sin cambios. Se usan ~20 min del buffer para enlazar la factura de tienda con sus pedidos (desglose)."),
]))

B(sub("Daily Scrum — Día 3 (Miércoles)"))
B(meta([
    ("DÍA", "Miércoles — Día 3"),
    ("Progreso hacia el objetivo",
     "Flujo completo demostrable: Laura confirma un pedido, baja el stock y aparece en su historial; avance de tiempo "
     "simulado (seed:tiempo del S9) hasta el cierre → su factura mensual incluye una factura de tipo 'tienda' con el "
     "total; Carlos ve la orden en /admin/pedidos. El E2E carrito → pedido → factura quedó en verde en CI (primer E2E "
     "de DoD v3 del módulo tienda). Los logs de tienda y factura quedaron sin PII (solo IDs) — chore cerrado."),
    ("Plan siguiente 24h",
     "Santiago: validar el carrito en móvil (360 px) con los breakpoints del spike. Gonza: guión de la Sprint Review "
     "(carrito → factura). Cortez: ensayar el E2E en pantalla compartida + checklist de workflows aplicada (Acción 1 "
     "del Retro S10)."),
    ("Impedimentos",
     "Ninguno técnico. Se confirma que el descuento de stock es atómico (test de concurrencia en verde). Laura "
     "preguntó si podrá cancelar un pedido confirmado; se registra como PBI-S11-E02 para un Sprint futuro."),
    ("Ajuste Sprint Backlog", "Sin cambios."),
]))

# --------------------------------------------------------------------------- #
#  3 · ACTA DE SPRINT REVIEW                                                   #
# --------------------------------------------------------------------------- #
B(sec(3, "Acta de Sprint Review"))
B(note("Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina adaptaciones futuras. "
       "Es una sesión de trabajo, no una presentación."))
B(meta([
    ("Sprint", "Sprint 11 — Semana 13"),
    ("Fecha", "Viernes — cierre de semana 13"),
    ("Duración", "55 minutos"),
    ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
    ("Scrum Team", "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                   "Gonza Morales Yoel, Santiago Flores Carlos"),
    ("Stakeholders",
     "Laura Vega (Residente — compra en la tienda), Carlos Fuentes (Admin — supervisa las órdenes), Sra. Rosa Díaz "
     "(Dueña — observadora; le interesan los ingresos de la tienda para el dashboard ejecutivo del S14), Profesor "
     "del curso"),
    ("Modalidad de demo",
     "Dos navegadores (residente + admin) + avance de tiempo simulado (seed:tiempo) para mostrar el cierre de mes y "
     "la factura de tienda. Se muestra el run de CI con el E2E del flujo crítico en verde."),
]))
B(sub("Guión de demostración"))
B(numlist([
    "Laura (residente) abre /residente/tienda y arma un carrito: 2 'Agua sin gas 625 ml' + 1 'Papel higiénico'. El "
    "mini-carrito de la navbar muestra el badge '3' y el subtotal.",
    "Laura abre el carrito, ajusta cantidades y pulsa 'Confirmar pedido'. La RPC confirmar_pedido descuenta el stock "
    "de forma atómica; el pedido pasa a 'confirmado' y el carrito queda vacío.",
    "Se muestra el test de concurrencia: dos confirmaciones simultáneas por la última unidad de un producto; solo una "
    "gana y la otra recibe 'sin stock suficiente'. No hay sobreventa.",
    "Laura abre /residente/tienda/historial y ve su pedido confirmado con el desglose (productos, cantidades, "
    "precio_unitario, total).",
    "Carlos (admin) abre /admin/pedidos y ve todas las órdenes; filtra por estado 'confirmado' y por residente; ve el "
    "total del periodo de la tienda.",
    "Avance de tiempo simulado hasta el cierre de mes: facturar_pedidos_periodo consolida los pedidos confirmados de "
    "Laura en una factura de tipo 'tienda'; Laura recibe la notificación y la ve en /residente/facturas junto a luz, "
    "agua y pensión.",
    "Laura abre la factura de tienda y, desde el detalle, llega al pedido que la originó (enlace factura ↔ pedidos). "
    "Su pedido figura ahora como 'facturado'.",
    "Se muestra el run de CI con el E2E carrito → pedido → factura en verde y la evidencia de logs sin PII (solo IDs). "
    "Con esto arranca DoD v3.",
]))
B(goal(
    chk() + " CUMPLIDO: Tienda interna v2 operativa — carrito con descuento atómico de stock, integración pedido → "
    "factura mensual (tipo 'tienda'), historial de pedidos para residente y admin, y logs sin PII. Epic TIENDA-01 "
    "cerrado. Primera aplicación de DoD v3 (E2E del flujo crítico + no-PII en logs). Sprint cerrado usando ~20 min "
    "del buffer; séptimo Sprint consecutivo sin hotfixes."))

B(sub("Feedback de stakeholders"))
B(para("<b>Laura Vega (Residente)</b>"))
B(bullets([
    "«Armar el carrito y ver el total antes de confirmar es clarísimo; y que aparezca en mi factura del mes me ahorra "
    "pasos.» → Validación.",
    "«Me gustaría ver el detalle del pedido directamente desde la factura, no solo desde el historial.» → "
    "PBI-S11-E01: 'Enlace al desglose del pedido desde el detalle de la factura'. P3, 1 h. Candidato para Sprint 13.",
    "«¿Puedo cancelar un pedido confirmado si me arrepiento antes del cierre?» → PBI-S11-E02: 'Cancelar pedido "
    "confirmado y devolver el stock (antes de facturar)'. P2, 2 h. Sin asignar.",
], marker="•"))
B(para("<b>Carlos Fuentes (Administrador)</b>"))
B(bullets([
    "«Ver todas las órdenes con filtros y el total del periodo me da control de las ventas de la tienda.» → "
    "Validación.",
    "«Necesitaría exportar los pedidos del mes a CSV para mi cierre contable.» → PBI-S11-E03: 'Exportar pedidos a CSV "
    "por rango' (reusa el patrón del S7). P3, 1.5 h. Candidato para Sprint 13.",
], marker="•"))
B(para("<b>Sra. Rosa Díaz (Dueña — observadora)</b>"))
B(bullets([
    "«Que cada pedido se vuelva un ingreso en la factura y quede listo para el dashboard ejecutivo (S14) me muestra "
    "el cierre del producto.» → Validación + insumo del S14.",
], marker="•"))
B(para("<b>Profesor del curso</b>"))
B(bullets([
    "«Arrancar DoD v3 con un E2E real del flujo carrito → pedido → factura, y con los logs sin PII, es el nivel de "
    "rigor que esperaba para la recta final del curso.» → Validación de DoD v3.",
    "«El descuento atómico con test de concurrencia es justo el tipo de robustez que distingue a un producto serio.» "
    "→ Validación técnica.",
], marker="•"))

B(sub("Decisiones de adaptación del Product Backlog"))
B(table(
    ["Decisión", "Detalle"],
    [
        ["DoD v3 en marcha", "Primera aplicación. Los criterios de E2E del flujo crítico de tienda y de no-PII en "
                             "logs quedaron cumplidos. OWASP (S12), Lighthouse (S13) y release candidate (S14) se "
                             "cumplen en sus chores."],
        ["Epic TIENDA-01 cerrado", "Catálogo (S10) + carrito e integración con la factura (S11). La tienda queda "
                                   "completa como dominio funcional."],
        ["Cero hotfixes", "Séptimo Sprint consecutivo sin hotfixes — práctica consolidada."],
        ["Descuento atómico validado", "El test de concurrencia confirma que no hay sobreventa ante compras "
                                       "simultáneas de la última unidad."],
        ["PBI-S11-E01 (NUEVA)", "Enlace al desglose del pedido desde el detalle de la factura (feedback Laura). P3, "
                                "1 h. Candidato S13."],
        ["PBI-S11-E02 (NUEVA)", "Cancelar pedido confirmado y devolver el stock antes de facturar (feedback Laura). "
                                "P2, 2 h. Sin asignar."],
        ["PBI-S11-E03 (NUEVA)", "Exportar pedidos a CSV por rango (feedback Carlos). P3, 1.5 h. Candidato S13."],
        ["Sprint 12 confirmado", "Comunicación — Tablón de anuncios del edificio (DoD v3): el admin publica "
                                 "comunicados (categoría, prioridad, imagen, fijar) y el residente los recibe en "
                                 "vivo, con badge de no leído y marcar como leído. Chore: checklist OWASP top 10 "
                                 "(control de acceso + sanitización / XSS) en los endpoints de anuncios. Absorbe "
                                 "PBI-S9-E02. El Web Push avanzado pasa a mejora opcional post-curso (las "
                                 "notificaciones Realtime + email del S6 ya cubren el aviso)."],
    ],
    [1.7, 5.0]))

# --------------------------------------------------------------------------- #
#  4 · ACTA DE SPRINT RETROSPECTIVE                                            #
# --------------------------------------------------------------------------- #
B(sec(4, "Acta de Sprint Retrospective"))
B(note("Referencia Scrum: la Retrospective planifica formas de aumentar calidad y efectividad. Los cambios más "
       "impactantes pueden entrar al Sprint Backlog del próximo Sprint."))
B(meta([
    ("Sprint", "Sprint 11 — Semana 13"),
    ("Fecha", "Viernes — después de la Sprint Review"),
    ("Duración", "30 minutos"),
    ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
    ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
]))
B(sub(chk() + " ¿Qué salió bien?"))
B(bullets([
    "Las tres acciones del Retro S10 se aplicaron: la checklist de workflows de CI/CD (Acción 1) se usó en el "
    "workflow del E2E; las constantes de UI quedaron en conventions.md (Acción 2); y los breakpoints del carrito se "
    "validaron en el spike del Refinement, no al final (Acción 3).",
    "Modelar pedidos / pedido_items en el S10 con anticipación evitó una migración de esquema en el S11: solo se "
    "añadió la RPC confirmar_pedido y la función de facturación.",
    "El descuento atómico con SELECT ... FOR UPDATE pasó el test de concurrencia a la primera; modelarlo como "
    "transacción evitó la sobreventa desde el diseño.",
    "Reusar la estructura de facturas del S9 (tipo + notificación + totales) hizo que integrar la tienda fuera "
    "agregar un tipo 'tienda', sin tocar el modelo existente.",
    "Persistir el carrito como pedido 'borrador' en BD evitó perderlo al recargar y dejó el historial coherente.",
    "Primer DoD v3 cumplido sin fricción: el E2E del flujo crítico y la limpieza de logs entraron dentro del Sprint.",
    "Séptimo Sprint consecutivo sin hotfixes.",
], marker="•"))
B(sub(xmk() + " ¿Qué salió mal?"))
B(bullets([
    "El periodo del pedido y el de la factura no coincidían por timezone; se unificó a America/Lima, pero pudo "
    "preverse al reusar la lógica de fechas del S9.",
    "El E2E con avance de tiempo simulado fue frágil al inicio (dependía de la hora de ejecución); se estabilizó con "
    "un fixture de tiempo determinista.",
    "El debate sobre persistir el carrito entre sesiones se resolvió el Día 1, pero debió cerrarse en el Refinement.",
], marker="•"))

B(sub("Acciones de mejora (máx. 3)"))
B(para("<b>Acción 1 — Tests de concurrencia para toda RPC que modifique stock o saldo</b>"))
B(meta([
    ("Descripción", "Cualquier RPC que descuente stock o modifique saldos lleva un test de concurrencia explícito "
                    "(dos operaciones simultáneas sobre el mismo recurso). Se incorpora al checklist de revisión."),
    ("Dueño", "Gonza Morales Yoel"),
    ("Evidencia", "/docs/conventions.md con la regla + test de concurrencia aplicado donde corresponda en el S12"),
    ("Fecha", "Sprint 12"),
]))
B(para("<b>Acción 2 — Fixtures de tiempo deterministas para E2E con fechas</b>"))
B(meta([
    ("Descripción", "Los E2E que dependan de fechas (cierres, vencimientos, recordatorios) usan un fixture de tiempo "
                    "determinista (no la hora real de ejecución) para no ser frágiles."),
    ("Dueño", "Cortez Zamora Leonardo"),
    ("Evidencia", "El E2E con fechas del S12 usa el fixture; documentado en /docs/testing/e2e-tiempo.md"),
    ("Fecha", "Sprint 12"),
]))
B(para("<b>Acción 3 — Documentar los ciclos de vida de estado en conventions.md</b>"))
B(meta([
    ("Descripción", "Documentar las máquinas de estado del dominio (pedido: borrador → confirmado → facturado; "
                    "factura: pendiente → pagada / vencida) en conventions.md para alinear UI y backend."),
    ("Dueño", "Santiago Flores Carlos"),
    ("Evidencia", "conventions.md con la sección 'Ciclos de vida de estado' (≥ 2 entradas)"),
    ("Fecha", "Sprint 12"),
]))

B(sub("Verificación DoD v3 — primera aplicación"))
B(table(
    ["Criterio", "Estado"],
    [
        ["Todo lo de DoD v2 (lint, unit + integration, cobertura ≥ 60%, /health, Secrets, tsc, CD con verificación, "
         "1 E2E)", chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["E2E mínimo del flujo crítico de tienda (carrito → pedido → factura) en pipeline",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — primer E2E de DoD v3</b></font>"],
        ["Regresión: tocar el flujo de factura dispara unit + integration + E2E",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO</b></font>"],
        ["Evidencia de no-PII en logs (tienda y factura solo con IDs)",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — chore del Sprint</b></font>"],
        ["Checklist OWASP top 10 aplicada",
         "<font color='#C8862A'><b>PROGRAMADO — chore del S12</b></font>"],
        ["Performance: Lighthouse ≥ 80 en rutas principales",
         "<font color='#C8862A'><b>PROGRAMADO — chore del S13</b></font>"],
        ["Release candidate etiquetado + demo final reproducible",
         "<font color='#C8862A'><b>PROGRAMADO — S14</b></font>"],
        ["ADR-013 (carrito + descuento atómico) + ADR-014 (integración pedido → factura) documentados",
         chk() + " <font color='#3E7D3A'><b>CUMPLIDO — adicional a DoD v3</b></font>"],
    ],
    [4.4, 2.3]))
B(goal(
    "DoD v3 inaugurada con sus criterios de este Sprint cumplidos (E2E del flujo crítico + no-PII en logs). Los "
    "criterios restantes (OWASP, Lighthouse, release candidate) tienen Sprint y dueño asignados (S12–S14). Sprint 11 "
    "cerrado usando ~20 min del buffer; séptimo Sprint consecutivo sin hotfixes."))

# --------------------------------------------------------------------------- #
#  5 · HISTORIAS DE USUARIO — SPRINT 11                                        #
# --------------------------------------------------------------------------- #
B(sec(5, "Historias de Usuario — Sprint 11"))
B(sub("Módulo TIENDA INTERNA — Sprint 11 (v2)"))

B(hucard(
    "HU-TIENDA-03", "Carrito + confirmación de pedido · Descuento atómico de stock", "Sprint 11 · 3 h", "P1 · 3 h",
    "Como <b>residente</b>, quiero <b>armar un carrito con productos del catálogo y confirmar el pedido</b>, para "
    "comprar en la tienda del edificio; al confirmar, el stock se descuenta de forma atómica y sin sobreventa.",
    [
        "En /residente/tienda agrego productos al carrito (con cantidad, tope = stock), veo subtotal por ítem y "
        "total; puedo quitar ítems y cambiar cantidades.",
        "El carrito se persiste como un pedido en estado 'borrador' (uno activo por residente) y sobrevive a recargar "
        "la página.",
        "Al 'Confirmar pedido', la RPC confirmar_pedido descuenta el stock de cada producto de forma atómica "
        "(SELECT ... FOR UPDATE en transacción) y marca el pedido como 'confirmado'.",
        "Si algún producto no tiene stock suficiente al confirmar, toda la operación se revierte (no se descuenta "
        "nada) y se avisa qué producto falló; nadie sobrevende.",
        "No se pueden agregar productos inactivos o agotados ni más unidades que el stock disponible.",
        "Tras confirmar, el carrito queda vacío y el pedido aparece en el historial con su total.",
    ],
    "Laura confirmó un pedido (2 aguas + 1 papel higiénico) en la Review; el stock bajó y un test de concurrencia "
    "mostró que, ante dos confirmaciones de la última unidad, solo una gana."))

B(hucard(
    "HU-TIENDA-04", "Pedido → línea en la factura mensual · Tipo 'tienda'", "Sprint 11 · 3 h", "P1 · 3 h",
    "Como <b>residente</b>, quiero <b>que mis pedidos confirmados del mes se sumen automáticamente a mi factura "
    "mensual</b>, para pagar la tienda junto con mis demás cargos.",
    [
        "Se añade 'tienda' al enum de tipos de factura (luz / agua / pensión / multas / tienda).",
        "Al cierre de mes, la función facturar_pedidos_periodo consolida los pedidos 'confirmado' del periodo del "
        "residente en una factura de tipo 'tienda' con el total acumulado y marca esos pedidos como 'facturado'.",
        "La factura de tienda enlaza a sus pedidos (pedidos.factura_id) para ver el desglose desde el detalle.",
        "Es idempotente: re-ejecutar el cierre no duplica la factura ni re-factura pedidos ya 'facturado'.",
        "Reusa la notificación de factura emitida del S8: el residente recibe el aviso de su factura de tienda.",
        "El admin ve la factura de tienda en su panel y en los totales del periodo, igual que los demás tipos.",
    ],
    "Avanzando el tiempo simulado hasta el cierre, la factura del mes de Laura incluyó una factura de tipo 'tienda' "
    "con el total de su pedido del 15, con su notificación correspondiente."))

B(hucard(
    "HU-TIENDA-07", "Historial de pedidos del residente", "Sprint 11 · 2 h", "P2 · 2 h",
    "Como <b>residente</b>, quiero <b>ver el historial de mis pedidos</b>, para hacer seguimiento de lo que compré y "
    "de su estado.",
    [
        "Lista en /residente/tienda/historial con fecha, total, estado (confirmado / facturado) y número de ítems.",
        "Detalle de cada pedido: productos, cantidades, precio_unitario (snapshot) y total.",
        "Si el pedido ya fue facturado, enlace a la factura de tienda correspondiente.",
        "RLS: el residente solo ve sus propios pedidos; ordenados por fecha descendente.",
    ],
    "Laura abrió su historial y vio su pedido confirmado con el desglose y, tras el cierre, su estado en 'facturado' "
    "con enlace a la factura."))

B(hucard(
    "HU-TIENDA-08", "Vista admin de pedidos · Filtros", "Sprint 11 · 2 h", "P2 · 2 h",
    "Como <b>administrador</b>, quiero <b>ver todas las órdenes de la tienda con filtros</b>, para supervisar las "
    "ventas del edificio.",
    [
        "Vista /admin/pedidos con todas las órdenes (todos los residentes) y filtros por residente, rango de fecha y "
        "estado (borrador / confirmado / facturado).",
        "Cada fila muestra residente, fecha, total, estado y nº de ítems; el detalle abre los ítems del pedido.",
        "Totales del periodo (suma de pedidos confirmados / facturados) visibles en la cabecera.",
        "RLS: solo el admin accede; el técnico no tiene acceso a pedidos.",
    ],
    "Carlos filtró los pedidos por estado 'confirmado' y por residente en la Review, y vio el total del periodo de la "
    "tienda."))

B(hucard(
    "Mejora", "Mini-carrito en la navbar", "Sprint 11 · 1 h", "P3 · 1 h",
    "Como <b>residente</b>, quiero <b>ver un mini-carrito en la barra de navegación con las unidades y el "
    "subtotal</b>, para saber qué llevo sin entrar al carrito.",
    [
        "Ícono de carrito en la navbar con badge del nº de unidades del pedido 'borrador' activo.",
        "Al hacer clic, un popover muestra los ítems y el subtotal y un botón 'Ver carrito'.",
        "Se actualiza al instante al agregar o quitar (estado compartido con la vista del catálogo).",
    ],
    "El badge del mini-carrito reflejó 3 unidades tras agregar 2 aguas y 1 papel higiénico durante la Review."))

B(para(
    "<b>Chore técnico del Sprint:</b> Privacidad / no-PII. Se auditan y limpian los logs de los módulos de tienda y "
    "factura para que solo registren IDs (pedido_id, residente_id, factura_id), sin nombres ni correos. Cumple el "
    "criterio de no-PII de DoD v3 y se documenta en /docs/privacidad/no-pii.md. 2 h, P2."))

B(sub("PBIs emergentes — entran en Sprints futuros"))
B(table(
    ["ID", "Historia", "Prior.", "Horas est.", "Sprint"],
    [
        ["PBI-S11-E01", "Enlace al desglose del pedido desde el detalle de la factura (feedback Laura)",
         dot("P3"), "1 h", "13"],
        ["PBI-S11-E02", "Cancelar pedido confirmado y devolver el stock antes de facturar (feedback Laura)",
         dot("P2"), "2 h", "Sin asignar"],
        ["PBI-S11-E03", "Exportar pedidos a CSV por rango (feedback Carlos)", dot("P3"), "1.5 h", "13"],
        ["PBI-S10-E01", "Vista rápida (quick view) del producto", dot("P3"), "1.5 h", "13"],
        ["PBI-S10-E02", "Edición de stock en lote en /admin/tienda", dot("P3"), "2 h", "Sin asignar"],
        ["PBI-S9-E02", "Recordatorio también el día del vencimiento", dot("P2"), "1 h", "12"],
        ["PBI-S6-E01", "Indicador de presencia en panel admin (Supabase Presence)", dot("P3"), "2 h", "Post-curso"],
        ["PBI-S6-E02", "Sonido + haptic feedback opcional al recibir notificación", dot("P3"), "2 h", "Post-curso"],
        ["PBI-S6-E03", "Sesiones activas + cerrar todas al cambiar contraseña", dot("P2"), "2 h", "13"],
        ["PBI-S7-E01", "Filtros por categoría en el dashboard de métricas", dot("P2"), "1 h", "13"],
    ],
    [1.05, 3.3, 0.7, 0.85, 0.8]))

# --------------------------------------------------------------------------- #
#  6 · ESTADO DEL BACKLOG TRAS SPRINT 11                                       #
# --------------------------------------------------------------------------- #
B(sec(6, "Estado del Backlog tras Sprint 11"))
B(sub("Progreso acumulado"))
done = "<font color='#3E7D3A'>" + chk() + " Completado</font>"
B(table(
    ["Sprint", "Horas", "Incremento entregado", "Estado"],
    [
        ["Sprint 0–6", "93 h", "Setup + Auth + Panel admin + Mantenimiento v1/v2 + Trazabilidad + Realtime", done],
        ["Sprint 7", "13 h", "Métricas y Dashboard visual: KPIs + gráficas Recharts + CSV + vista materializada", done],
        ["Sprint 8", "13 h", "Facturación v1: tabla facturas + emisión individual/lote + vista residente + "
         "notificación Realtime", done],
        ["Sprint 9", "12.5 h", "Facturación v2: marcar pagada + recordatorios + vencida + comprobante PDF + totales + "
         "/health", done],
        ["Sprint 10", "13 + 8 h", "Tienda interna v1: catálogo admin (CRUD + foto) + grilla residente + CD a staging "
         "· Addendum del profesor (seed 3 años + pago simulado + encuesta SUS)", done],
        ["Sprint 11", "13 h", star() + " Tienda interna v2: carrito + descuento atómico de stock + pedido → factura "
         "mensual (tipo 'tienda') + historial + vista admin de pedidos · primer DoD v3 (E2E + no-PII)", done],
        ["Sprint 12", "13 h (est.)", "Comunicación: tablón de anuncios del edificio (admin publica + residente "
         "recibe en vivo)", "<font color='#C8862A'>→ Próximo</font>"],
        ["Sprints 13–14", "26 h (est.)", "Panel integral del residente · " + star() +
         " Dashboard ejecutivo + Release Candidate", "<font color='#C8862A'>■ Planificado</font>"],
    ],
    [0.95, 0.85, 3.7, 1.2]))
B(para("<b>Total invertido:</b> 157.5 horas en 12 sprints (Sprint 0 → Sprint 11), más 8 h del addendum de mejoras del "
       "profesor incorporado al Sprint 10 (165.5 h en total)."))
B(para("<b>Total restante:</b> ~39 horas estimadas en 3 sprints (S12–S14)."))
B(para("<b>Velocidad promedio:</b> 13.1 horas/sprint (estable por noveno sprint consecutivo)."))

B(sub("Roadmap actualizado tras Sprint 11 Review"))
B(table(
    ["Sprint", "Sem.", "Objetivo principal — Entregable funcional"],
    [
        ["S12", "14", "Comunicación: tablón de anuncios del edificio (el admin publica comunicados con imagen + el "
         "residente los recibe en vivo y marca leído). Absorbe PBI-S9-E02 (recordatorio el día del vencimiento). "
         "Chore: OWASP top 10 (acceso + sanitización)"],
        ["S13", "15", "Panel integral del residente (3 tarjetas) + sesiones activas + emergentes: quick view de "
         "producto (S10-E01), desglose del pedido desde la factura (S11-E01), export de pedidos (S11-E03), filtros en "
         "métricas (S7-E01)"],
        ["S14", "16", star() + " Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) + Release "
         "Candidate + demo final integral"],
    ],
    [0.6, 0.5, 5.6]))
B(note("Nota: los emergentes del S11 se ubican — PBI-S11-E01 (desglose desde la factura) y PBI-S11-E03 (export de "
       "pedidos) en S13; PBI-S11-E02 (cancelar pedido) sin asignar. La tienda queda cerrada como dominio (catálogo "
       "S10 + carrito e integración con factura S11). El S12 abre el canal de comunicación oficial con el tablón de "
       "anuncios del edificio (el Web Push avanzado pasa a mejora opcional post-curso)."))

B(sub("Vista previa Sprint 12 — Comunicación: tablón de anuncios del edificio"))
B(goal("Sprint 12: abrir el canal de comunicación oficial del edificio. El admin publica comunicados (categoría, "
       "prioridad, imagen, con la opción de fijarlos y darles vigencia) y el residente los ve al instante en un "
       "tablón, con indicador de no leído y marcar como leído. Chore: checklist OWASP top 10 (control de acceso + "
       "sanitización / XSS) en los endpoints de anuncios. DoD v3."))
B(table(
    ["PBI", "Historia", "Horas est.", "Prior."],
    [
        ["HU-ANUNCIO-01", "Modelado BD: anuncios + anuncio_lecturas + RLS (solo admin publica) + bucket adjuntos",
         "2 h", dot("P1")],
        ["HU-ANUNCIO-02", "Vista /admin/anuncios: CRUD de comunicados (categoría, prioridad, imagen, fijar, vigencia)",
         "3 h", dot("P1")],
        ["HU-ANUNCIO-03", "Vista /residente/anuncios: feed con badge de no leído y marcar como leído", "3 h",
         dot("P1")],
        ["HU-ANUNCIO-04", "Aviso Realtime + badge de no leídos en la navbar al publicar (reusa S6)", "2 h", dot("P2")],
        ["Mejora", "Filtro por categoría + anuncios fijados (destacados arriba)", "1 h", dot("P3")],
        ["Chore-T", "Checklist OWASP top 10 en anuncios (A01 acceso, A03 XSS/sanitización, A05 config)", "2 h",
         dot("P2")],
    ],
    [1.15, 3.85, 0.85, 0.85]))
B(para("<b>Total estimado Sprint 12:</b> 13 horas + 2 h de buffer (absorbe PBI-S9-E02, recordatorio el día del "
       "vencimiento, 1 h). El Web Push avanzado se mantiene como mejora opcional post-curso."))

B(sub("Variables de entorno acumuladas al Sprint 11"))
B(para("Este Sprint no añade variables nuevas; reusa las del S10:"))
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
    "S12 (Tablón de anuncios), S13 (Panel integral) y S14 (Dashboard ejecutivo + RC): no requieren secretos nuevos; "
    "reusan Storage, Realtime, Resend y la configuración existente.",
], marker="•"))
B(note("Ninguna de estas variables debe aparecer en el código fuente ni en commits. Todas van en .env.local (local) "
       "y en Secrets de GitHub/Vercel (CI/CD)."))

B(finalnote("— Zity · Artefactos Sprint 11 · Documento vivo — actualizar en cada Sprint Review —"))

# --------------------------------------------------------------------------- #
OUT = os.path.normpath(os.path.join(
    os.path.dirname(__file__), "..", "..", "docs", "sprints", "Zity_Sprint11_Artefactos.pdf"))
build_pdf(BLOCKS, FOOT, OUT)
print("OK ->", OUT)
