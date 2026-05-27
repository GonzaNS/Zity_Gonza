"""
Genera el PDF de artefactos Scrum del Sprint 8 (Zity).
Tema: Facturación v1 — el admin emite facturas mensuales (manual o por lote)
y el residente las ve con desglose por tipo. Notificación Realtime al
emitir. E2E del flujo + deploy del módulo entran como chore técnico
intercalado.

Estilo visual: cabecera azul con título centrado, tablas tipo zebra,
secciones numeradas con banda de color, footer con número de página.

Uso:
    python scripts/generate_sprint8_pdf.py

Salida:
    docs/sprints/Zity_Sprint8_Artefactos.pdf
"""

from __future__ import annotations

import os
from typing import Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)


# ─── Paleta y constantes de estilo ────────────────────────────────────────────

ZITY_BLUE = colors.HexColor("#1d3a5f")
ZITY_BLUE_DARK = colors.HexColor("#142948")
ZITY_BLUE_LIGHT = colors.HexColor("#e5edf5")
ZITY_LABEL_BG = colors.HexColor("#eef1f4")
ZITY_BG_SOFT = colors.HexColor("#f7f8fa")
ZITY_BG_QUOTE = colors.HexColor("#f0f4f9")
ZITY_BORDER = colors.HexColor("#d8dde3")
ZITY_BORDER_LIGHT = colors.HexColor("#e8ebef")
ZITY_TEXT = colors.HexColor("#1c2330")
ZITY_TEXT_MUTED = colors.HexColor("#5b6878")
ZITY_OK = colors.HexColor("#1e7e34")
ZITY_WARN = colors.HexColor("#a87800")
ZITY_FAIL = colors.HexColor("#a83232")

PAGE_W, PAGE_H = LETTER
LEFT_MARGIN = RIGHT_MARGIN = 0.75 * inch
TOP_MARGIN = 0.85 * inch
BOTTOM_MARGIN = 0.75 * inch


# ─── Stylesheet ───────────────────────────────────────────────────────────────


def build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()
    styles: dict[str, ParagraphStyle] = {}
    styles["TitleCover"] = ParagraphStyle("TitleCover", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=46, leading=52, alignment=TA_CENTER, textColor=ZITY_BLUE_DARK, spaceAfter=4)
    styles["SubtitleCover"] = ParagraphStyle("SubtitleCover", parent=base["Heading2"], fontName="Helvetica", fontSize=18, leading=24, alignment=TA_CENTER, textColor=ZITY_BLUE, spaceAfter=6)
    styles["TaglineCover"] = ParagraphStyle("TaglineCover", parent=base["Italic"], fontName="Helvetica-Oblique", fontSize=11, leading=16, alignment=TA_CENTER, textColor=ZITY_TEXT_MUTED, spaceAfter=26)
    styles["SectionBanner"] = ParagraphStyle("SectionBanner", fontName="Helvetica-Bold", fontSize=13.5, leading=18, textColor=colors.white, spaceBefore=0, spaceAfter=0, leftIndent=4, letterSpace=0.5)
    styles["H2"] = ParagraphStyle("H2", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13, leading=18, textColor=ZITY_BLUE_DARK, spaceBefore=16, spaceAfter=8)
    styles["H3"] = ParagraphStyle("H3", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=ZITY_BLUE, spaceBefore=12, spaceAfter=4)
    styles["Body"] = ParagraphStyle("Body", parent=base["BodyText"], fontName="Helvetica", fontSize=10, leading=15, textColor=ZITY_TEXT, spaceAfter=6, alignment=TA_JUSTIFY)
    styles["BodyLeft"] = ParagraphStyle("BodyLeft", parent=styles["Body"], alignment=TA_LEFT, spaceAfter=6)
    styles["Cell"] = ParagraphStyle("Cell", fontName="Helvetica", fontSize=9, leading=13, textColor=ZITY_TEXT, alignment=TA_LEFT)
    styles["CellBold"] = ParagraphStyle("CellBold", parent=styles["Cell"], fontName="Helvetica-Bold", textColor=ZITY_BLUE_DARK)
    styles["CellHeader"] = ParagraphStyle("CellHeader", fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=colors.white, alignment=TA_LEFT, letterSpace=0.3)
    styles["CellLabel"] = ParagraphStyle("CellLabel", fontName="Helvetica-Bold", fontSize=9, leading=13, textColor=ZITY_BLUE_DARK, alignment=TA_LEFT, letterSpace=0.2)
    styles["Quote"] = ParagraphStyle("Quote", parent=styles["Body"], fontName="Helvetica-BoldOblique", fontSize=10.5, leading=16, alignment=TA_CENTER, textColor=ZITY_BLUE_DARK, spaceBefore=0, spaceAfter=0)
    styles["Note"] = ParagraphStyle("Note", parent=base["Italic"], fontName="Helvetica-Oblique", fontSize=9, leading=13, textColor=ZITY_TEXT_MUTED, spaceBefore=2, spaceAfter=10)
    styles["Footer"] = ParagraphStyle("Footer", fontName="Helvetica-Oblique", fontSize=8.5, leading=11, textColor=ZITY_TEXT_MUTED, alignment=TA_CENTER)
    styles["OkLabel"] = ParagraphStyle("OkLabel", parent=styles["Cell"], fontName="Helvetica-Bold", textColor=ZITY_OK)
    styles["WarnLabel"] = ParagraphStyle("WarnLabel", parent=styles["Cell"], fontName="Helvetica-Bold", textColor=ZITY_WARN)
    styles["FailLabel"] = ParagraphStyle("FailLabel", parent=styles["Cell"], fontName="Helvetica-Bold", textColor=ZITY_FAIL)
    return styles


def info_table(rows, styles):
    data = [[Paragraph(label, styles["CellLabel"]), Paragraph(value, styles["Cell"])] for label, value in rows]
    t = Table(data, colWidths=[1.7 * inch, 5.05 * inch], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), ZITY_LABEL_BG),
        ("BACKGROUND", (1, 0), (1, -1), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, ZITY_BORDER_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BORDER),
        ("LINEAFTER", (0, 0), (0, -1), 0.4, ZITY_BORDER),
    ]))
    return t


def grid_table(header, rows, col_widths, styles):
    header_row = [Paragraph(h, styles["CellHeader"]) for h in header]
    data: list[list[object]] = [header_row]
    for r in rows:
        data.append([_to_cell(c, styles) for c in r])
    t = Table(data, colWidths=list(col_widths), hAlign="LEFT", repeatRows=1)
    style_cmds: list[tuple] = [
        ("BACKGROUND", (0, 0), (-1, 0), ZITY_BLUE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold", 9),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (0, 0), (-1, 0), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 7),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, ZITY_BORDER_LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BORDER),
    ]
    for i, _ in enumerate(rows, start=1):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), ZITY_BG_SOFT))
        else:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), colors.white))
    t.setStyle(TableStyle(style_cmds))
    return t


def _to_cell(cell, styles):
    if isinstance(cell, Paragraph):
        return cell
    if isinstance(cell, str):
        return Paragraph(cell, styles["Cell"])
    return Paragraph(str(cell), styles["Cell"])


def quote_box(text, styles):
    p = Paragraph(text, styles["Quote"])
    t = Table([[p]], colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ZITY_BG_QUOTE),
        ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BLUE_LIGHT),
        ("LEFTPADDING", (0, 0), (-1, -1), 20),
        ("RIGHTPADDING", (0, 0), (-1, -1), 20),
        ("TOPPADDING", (0, 0), (-1, -1), 14),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ("LINEBEFORE", (0, 0), (0, -1), 3, ZITY_BLUE),
    ]))
    return t


def _separador_decorativo():
    t = Table([[""]], colWidths=[1.2 * inch], rowHeights=[0.04 * inch], hAlign="CENTER")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ZITY_BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def section_banner(label, styles):
    p = Paragraph(label, styles["SectionBanner"])
    t = Table([[p]], colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ZITY_BLUE_DARK),
        ("LEFTPADDING", (0, 0), (-1, -1), 16),
        ("RIGHTPADDING", (0, 0), (-1, -1), 16),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LINEBEFORE", (0, 0), (0, -1), 4, ZITY_BLUE),
    ]))
    return t


def hu_card(code, title, estimacion, prioridad, historia, criterios, evidencia, styles, star=False):
    header_left = f"<b>{code}</b> · {title}{'  ★' if star else ''}"
    header_table = Table(
        [[Paragraph(header_left, styles["CellBold"]),
          Paragraph(estimacion, styles["Cell"]),
          Paragraph(prioridad, styles["Cell"])]],
        colWidths=[4.1 * inch, 1.25 * inch, 1.4 * inch], hAlign="LEFT",
    )
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), ZITY_LABEL_BG),
        ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#dde7f0")),
        ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#f0dada")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("ALIGN", (1, 0), (-1, 0), "CENTER"),
        ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BORDER),
    ]))
    items: list = [
        header_table, Spacer(1, 8),
        Paragraph(historia, styles["Body"]), Spacer(1, 4),
        Paragraph("<b>Criterios de aceptación</b>", styles["H3"]),
    ]
    for c in criterios:
        items.append(Paragraph(f"☐ &nbsp; {c}", styles["BodyLeft"]))
    if evidencia:
        items.append(Spacer(1, 4))
        items.append(Paragraph(f"<b>Evidencia:</b> <i>{evidencia}</i>", styles["Note"]))
    if star:
        items.append(Paragraph("★ <i>Continúa el feedback de stakeholders o emergente del Sprint anterior.</i>", styles["Note"]))
    items.append(Spacer(1, 14))
    return KeepTogether(items)


def make_doc(path):
    doc = BaseDocTemplate(
        path, pagesize=LETTER,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Zity · Artefactos Sprint 8",
        author="Equipo Zity",
        subject="Facturación v1: admin emite facturas (manual + lote), residente las ve con desglose, notificación Realtime",
        keywords="scrum, sprint 8, zity, facturacion, facturas, lote, realtime",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main", showBoundary=0)

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setStrokeColor(ZITY_BORDER)
        canvas.setLineWidth(0.4)
        canvas.line(LEFT_MARGIN, 0.6 * inch, PAGE_W - RIGHT_MARGIN, 0.6 * inch)
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(ZITY_BLUE_DARK)
        canvas.drawString(LEFT_MARGIN, 0.4 * inch, "Zity")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawString(LEFT_MARGIN + 0.32 * inch, 0.4 * inch, "· Artefactos Scrum · Sprint 8")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.4 * inch, f"pág. {doc_.page}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=on_page)])
    return doc


# ─── Contenido del Sprint 8 ───────────────────────────────────────────────────


def build_story(styles):
    s: list = []

    # ── Portada ────────────────────────────────────────────────────────────
    s.append(Spacer(1, 20))
    s.append(Paragraph("Zity", styles["TitleCover"]))
    s.append(Spacer(1, 4))
    s.append(_separador_decorativo())
    s.append(Spacer(1, 12))
    s.append(Paragraph("Artefactos Scrum — Sprint 8", styles["SubtitleCover"]))
    s.append(Paragraph(
        "Facturación v1 — Admin emite facturas mensuales (manual o por lote 'emitir a todos') · "
        "Residente las ve con desglose por tipo (luz · agua · pensión · multas) · Notificación "
        "Realtime al emitir · E2E del módulo + deploy como chore técnico",
        styles["TaglineCover"],
    ))
    s.append(Spacer(1, 16))
    s.append(info_table([
        ("Producto", "Zity"),
        ("Sprint", "Sprint 8 — Semana 10"),
        ("Stack",
            "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
            "Resend · Vercel · GitHub Actions · Vitest · Recharts (desde S7) · Playwright (desde S7)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers",
            "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "13 horas (2 horas de buffer)"),
        ("DoD aplicable", "DoD v2 — quinta aplicación"),
        ("Nuevo en este sprint",
            "Módulo Facturación v1: tabla facturas (luz/agua/pensión/multas con monto, "
            "vencimiento, estado) + RLS · Vista /admin/facturacion con emisión individual y "
            "acción 'Emitir a todos' (lote) · Vista /residente/facturas con desglose por tipo · "
            "Notificación Realtime al residente cuando se emite su factura (reusa Realtime del S6)"),
        ("Chore técnico del Sprint",
            "E2E del flujo 'admin emite → residente ve' con Playwright (continuando la semilla del S7) "
            "+ documentar deploy manual del módulo a staging. 1.5 h, P2."),
        ("Variables nuevas",
            "Ninguna en código fuente · se reusan Realtime + Resend ya configurados desde el Sprint 6"),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ], styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Documento vivo — se actualiza en cada Sprint Review", styles["Footer"]))
    s.append(PageBreak())

    # ── 1. SPRINT PLANNING ─────────────────────────────────────────────────
    s.append(section_banner("1   ACTA DE SPRINT PLANNING", styles))
    s.append(Spacer(1, 14))
    s.append(info_table([
        ("Sprint", "Sprint 8 — Semana 10"),
        ("Fecha", "Lunes — inicio de semana 10"),
        ("Duración del evento", "75 minutos"),
        ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
        ("Asistentes",
            "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), "
            "Cortez Zamora Leonardo, Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
        ("Stakeholder invitado",
            "Laura Vega (Residente ficticia) — el módulo de facturación afecta directamente al "
            "residente: recibirá cada mes una factura por luz/agua/pensión/multas. Se prioriza su "
            "mirada en el Planning para validar el desglose y la notificación."),
        ("Capacidad", "15 horas disponibles · se usarán 13 h (2 h de buffer)"),
        ("Entrada",
            "Product Backlog actualizado tras Sprint 7 Review: el dashboard de métricas validó el "
            "nuevo enfoque funcional. PBI emergente PBI-S7-E01 (filtros por categoría) NO entra "
            "(va a S13). Acciones del Retro S7: (1) seed representativo del módulo, (2) pausar "
            "refresh en background, (3) documentar setup de extensiones."),
        ("Refinement previo",
            "Práctica institucionalizada: el viernes anterior el PO presentó los criterios completos "
            "de los 5 PBIs en 30 min. Cuarto Sprint consecutivo aplicando la práctica — objetivo: cero hotfixes."),
    ], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        '"Lanzar el módulo de facturación: el admin emite facturas mensuales por tipo (luz, agua, '
        "pensión, multas) — manualmente o en lote para todos los residentes — y cada residente "
        "las ve en su panel con desglose y estado. Al emitir una factura, el residente recibe "
        'una notificación Realtime en su campana del Sprint 6."',
        styles,
    ))
    s.append(Paragraph(
        "Nota: Quinta aplicación de DoD v2. El módulo Facturación abre un nuevo dominio del producto "
        "(finanzas) que el Sprint 9 cierra con cobros y recordatorios. El chore técnico de este "
        "Sprint añade el segundo E2E a la suite Playwright (continúa la semilla del S7) y documenta "
        "el deploy manual del módulo a staging — preparando el camino para el chore de CD del Sprint 10.",
        styles["Note"],
    ))
    s.append(Spacer(1, 10))

    s.append(Paragraph("PBIs seleccionados — Sprint 8", styles["H2"]))
    pbi_header = ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"]
    pbi_rows = [
        ["HU-FACT-01",
         "Modelado BD: tabla facturas (tipo, monto, vencimiento, estado, residente_id) + RLS + índices",
         "Historia", Paragraph("● P1", styles["FailLabel"]), "2 h", "Gonza Morales"],
        ["HU-FACT-02",
         "Vista /admin/facturacion: formulario individual + acción 'Emitir a todos' (lote transaccional)",
         "Historia", Paragraph("● P1", styles["FailLabel"]), "3 h", "Gonza Morales"],
        ["HU-FACT-03",
         "Vista /residente/facturas: lista con desglose por tipo, estado y vencimiento",
         "Historia", Paragraph("● P1", styles["FailLabel"]), "3 h", "Santiago Flores"],
        ["HU-FACT-05",
         "Notificación Realtime al residente cuando se emite su factura (reusa sistema del Sprint 6)",
         "Historia", Paragraph("● P2", styles["WarnLabel"]), "2 h", "Santiago Flores"],
        ["Chore-T",
         "E2E 'admin emite → residente ve' (segundo E2E de la suite) + documentar deploy manual del módulo",
         "Chore", Paragraph("● P2", styles["WarnLabel"]), "1.5 h", "Cortez Zamora"],
        ["Buffer",
         "Reservado para imprevistos del modelado BD (decimal, fechas) o de la integración Realtime",
         "—", Paragraph("● —", styles["WarnLabel"]), "1.5 h", "—"],
    ]
    s.append(grid_table(
        pbi_header, pbi_rows,
        [0.85 * inch, 2.65 * inch, 0.65 * inch, 0.55 * inch, 0.55 * inch, 1.05 * inch],
        styles,
    ))
    s.append(Paragraph(
        "Total estimado: 13 horas (incluye 1.5 h de buffer; otras 0.5 h libres del techo de 15).",
        styles["Body"],
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Decisiones técnicas del Sprint", styles["H2"]))
    s.append(Paragraph(
        "Antes de empezar el desarrollo, el equipo cierra las siguientes decisiones técnicas:",
        styles["Body"],
    ))
    dec_header = ["Decisión", "Detalle", "Registrado en"]
    dec_rows = [
        ["Modelo de la tabla facturas",
         "Columnas: id (uuid), residente_id (FK profiles), tipo (enum: luz/agua/pension/multa), "
         "monto (numeric(10,2) ≥ 0), periodo (text, ej. '2026-05'), fecha_emision (date), "
         "vencimiento (date), estado (enum: pendiente/pagada/vencida), descripcion (text opcional), "
         "created_at, updated_at. UNIQUE(residente_id, tipo, periodo) impide duplicar emisión.",
         "Migración 009 + ADR-007"],
        ["RLS y permisos",
         "Residente: SELECT solo donde residente_id = auth.uid(). Admin: SELECT/INSERT/UPDATE en "
         "toda la tabla. Técnico: sin acceso. Cada política se cubre con un test de integración "
         "con los 3 roles.",
         "Migración 009 (políticas RLS)"],
        ["Acción 'Emitir a todos' (lote)",
         "RPC emitir_facturas_lote(tipo, monto, periodo, vencimiento) que itera por todos los "
         "residentes con estado_cuenta='activo' en una única transacción Postgres. Si una "
         "inserción falla (ej. UNIQUE constraint), toda la transacción se revierte para no "
         "dejar el lote a medias.",
         "Criterio HU-FACT-02"],
        ["Fecha de vencimiento por defecto",
         "Día 30 del mes de emisión. Si el periodo es '2026-05', vencimiento = 2026-05-30. Si "
         "el mes no tiene día 30 (febrero), se ajusta al último día del mes. Edge case detectable "
         "en tests.",
         "Criterio HU-FACT-02 + tests"],
        ["Notificación Realtime de factura",
         "Trigger after_factura_inserted que inserta 1 fila en notificaciones (tipo='factura_nueva', "
         "mensaje con monto y tipo). La campana del residente (S6) recibe el evento por canal "
         "'notificaciones:{usuario_id}' sin cambios en el frontend. Fire-and-forget: si el trigger "
         "falla, la factura igual queda creada.",
         "Migración 009 (trigger)"],
        ["Vista del residente",
         "Tarjeta por factura con: tipo (icono + etiqueta), monto en grande, vencimiento, badge de "
         "estado (verde 'Pagada' / ámbar 'Pendiente' / rojo 'Vencida'). Ordenadas por vencimiento "
         "ascendente (más urgente primero). Filtro por estado en la cabecera.",
         "Criterio HU-FACT-03"],
        ["E2E del módulo como chore",
         "Segundo E2E de la suite (después del 'crear solicitud' del S7): admin emite factura "
         "individual → residente ve la factura + notificación. 1.5 h incluye actualizar el "
         "workflow y documentar el deploy manual del módulo en /docs/ops/.",
         "Chore-T + /docs/testing/e2e.md"],
    ]
    s.append(grid_table(dec_header, dec_rows, [1.4 * inch, 4.2 * inch, 1.3 * inch], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Desglose de tareas — ¿Cómo?", styles["H2"]))

    s.append(Paragraph("Gonza Morales Yoel — HU-FACT-01 + HU-FACT-02 (5 h)", styles["H3"]))
    tarea_header = ["Tarea", "Horas"]
    s.append(grid_table(tarea_header, [
        ["Migración 009: crear tabla facturas con todas las columnas + enums (tipo/estado) + constraint UNIQUE(residente_id, tipo, periodo) + índices por (residente_id, vencimiento) y (estado).", "1 h"],
        ["Políticas RLS para facturas: residente SELECT propias, admin todo, técnico bloqueado. Trigger after_factura_inserted que crea notificación. Tests de integración con los 3 roles.", "1 h"],
        ["Vista /admin/facturacion con formulario individual: residente (dropdown filtrado por activos), tipo, monto, periodo, fecha de vencimiento (sugerencia automática del 30). Validaciones cliente + servidor.", "1.5 h"],
        ["RPC emitir_facturas_lote() + UI del botón 'Emitir a todos' con confirmación modal (muestra cuántos residentes se afectarán). Manejo de errores: si una falla por UNIQUE, se revierte y se notifica con detalle.", "1.5 h"],
    ], [5.5 * inch, 1.0 * inch], styles))

    s.append(Paragraph("Santiago Flores Carlos — HU-FACT-03 + HU-FACT-05 (5 h)", styles["H3"]))
    s.append(grid_table(tarea_header, [
        ["Vista /residente/facturas: layout de tarjetas con tipo (icono), monto, vencimiento, badge de estado. Filtro por estado en la cabecera (pendientes / pagadas / vencidas / todas). Responsiva (en móvil las tarjetas apilan vertical).", "2.5 h"],
        ["Total acumulado pendiente en la cabecera ('Tienes $XXX por pagar este mes') — se calcula como suma de monto donde estado='pendiente'.", "0.5 h"],
        ["Vista de detalle de factura (al hacer clic en una tarjeta): desglose completo, descripción si la hay, número de factura legible (F-2026-05-001), botón 'Volver'.", "1 h"],
        ["Notificación Realtime: extender NotificacionesContext del S6 para reconocer tipo='factura_nueva' con icono y mensaje específicos. Click en la notificación abre el detalle de la factura directamente.", "1 h"],
    ], [5.5 * inch, 1.0 * inch], styles))

    s.append(Paragraph("Cortez Zamora Leonardo — Chore técnico (1.5 h)", styles["H3"]))
    s.append(grid_table(tarea_header, [
        ["Segundo E2E de la suite Playwright: e2e/facturacion.spec.ts. Flujo: admin login → /admin/facturacion → emitir factura individual a residente de prueba → residente login → /residente/facturas → ver la factura + verificar notificación en campana.", "1 h"],
        ["Documentar deploy manual del módulo Facturación a staging en /docs/ops/deploy-modulo-facturacion.md (prep para el chore de CD del S10) + dejar listo el workflow_dispatch del workflow e2e.yml para correrlo contra staging.", "0.5 h"],
    ], [5.5 * inch, 1.0 * inch], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Riesgos del Sprint 8", styles["H2"]))
    risk_header = ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"]
    risk_rows = [
        ["R1",
         "Decimales del monto: usar number en JS puede provocar redondeos sutiles si se hacen sumas en frontend.",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Medio", styles["WarnLabel"]),
         "Postgres usa numeric(10,2). En frontend usar string para mostrar y SOLO sumar en servidor (RPC suma_facturas_pendientes). Nunca hacer aritmética de montos en JS."],
        ["R2",
         "El lote 'Emitir a todos' aplicado dos veces en el mismo mes duplicaría facturas.",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Alto", styles["FailLabel"]),
         "Constraint UNIQUE(residente_id, tipo, periodo) en la tabla. Si el admin reintenta, la transacción falla y se le muestra un toast claro 'Ya se emitió este lote para mayo 2026'."],
        ["R3",
         "Fecha de vencimiento por defecto (día 30) rompe en febrero o si el mes tiene 29/30/31 días.",
         Paragraph("● Alta", styles["FailLabel"]), Paragraph("● Bajo", styles["OkLabel"]),
         "Helper fecha_vencimiento_por_defecto(periodo) que detecta el último día del mes y aplica min(30, ultimo_dia). Test con los 12 meses + año bisiesto."],
        ["R4",
         "Notificación Realtime de factura puede llegar al residente equivocado si el trigger toma el residente_id mal.",
         Paragraph("● Baja", styles["OkLabel"]), Paragraph("● Alto", styles["FailLabel"]),
         "Test de integración: emitir factura para residente_A y verificar que residente_B NO recibe nada (multi-cliente). Se incluye en el set de tests de RLS."],
        ["R5",
         "El módulo de facturas crece rápido — si en la demo del S9 el seed tiene muchas facturas vencidas pueden saturar la vista del residente.",
         Paragraph("● Baja", styles["OkLabel"]), Paragraph("● Bajo", styles["OkLabel"]),
         "Paginación lazy (carga 25 a la vez con scroll infinito). El seed empieza limpio y se enriquece como parte de la acción 1 del Retro S7."],
        ["R6",
         "El admin puede emitir factura a un residente con estado_cuenta='bloqueado' sin querer.",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Bajo", styles["OkLabel"]),
         "El dropdown de residente filtra por estado_cuenta='activo'. El lote también. Aviso visual si el admin intenta forzarlo manualmente."],
    ]
    s.append(grid_table(risk_header, risk_rows, [0.4 * inch, 2.2 * inch, 0.7 * inch, 0.7 * inch, 2.9 * inch], styles))
    s.append(PageBreak())

    # ── 2. DAILY SCRUMS ────────────────────────────────────────────────────
    s.append(section_banner("2   REGISTRO DE DAILY SCRUMS", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y "
        "adapta el Sprint Backlog. Duración máxima: 15 minutos.",
        styles["Note"],
    ))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        'Sprint Goal: "Módulo Facturación v1 funcional: admin emite (manual y por lote), '
            'residente ve facturas con desglose y recibe notificación Realtime."',
        styles,
    ))

    s.append(Paragraph("Daily Scrum — Día 1 (Lunes)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Lunes — Día 1"),
        ("Progreso hacia el objetivo",
            "Migración 009 lista: tabla facturas creada con enums, UNIQUE constraint, índices y "
            "políticas RLS verificadas con tests de los 3 roles. Trigger after_factura_inserted "
            "operativo. /admin/facturacion con formulario individual funcionando: emite factura "
            "para un residente y verifica que aparece en la tabla. Helper fecha_vencimiento_por_"
            "defecto(periodo) con tests de los 12 meses + bisiesto."),
        ("Plan siguiente 24h",
            "Gonza Morales: RPC emitir_facturas_lote() + UI del botón 'Emitir a todos' con modal. "
            "Santiago Flores: /residente/facturas con tarjetas y filtro por estado + integración "
            "con NotificacionesContext. Cortez Zamora: e2e/facturacion.spec.ts en local."),
        ("Impedimentos",
            "Discutimos si el día 30 de febrero debe ajustarse al 28/29 o si conviene un campo "
            "configurable. Decisión: ajuste automático al último día del mes (más simple, ya "
            "implementado y testeado)."),
        ("Ajuste Sprint Backlog", "Sin cambios."),
    ], styles))

    s.append(Paragraph("Daily Scrum — Día 2 (Martes)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Martes — Día 2"),
        ("Progreso hacia el objetivo",
            "RPC emitir_facturas_lote() funcional con transacción Postgres: emite a 8 residentes "
            "activos de prueba en ~120 ms. Modal de confirmación muestra el conteo de afectados "
            "antes de ejecutar. Vista /residente/facturas con tarjetas, filtro por estado, total "
            "acumulado en la cabecera. Notificación Realtime entrega correctamente: emisión en "
            "navegador admin → campana del residente suma '+1' en menos de 1.5 s."),
        ("Plan siguiente 24h",
            "Gonza Morales: pulir el manejo de errores del lote (mostrar detalle si falla por "
            "UNIQUE). Santiago Flores: vista de detalle de factura + responsive móvil + extender "
            "NotificacionesContext para reconocer tipo 'factura_nueva' con icono propio. Cortez "
            "Zamora: terminar e2e/facturacion.spec.ts y subirlo al workflow."),
        ("Impedimentos",
            "Al hacer click en una notificación de factura, el contexto del S6 no sabe a dónde "
            "navegar (solo conocía solicitudes). Extender el switch del tipo para 'factura_nueva' "
            "→ navega a /residente/facturas/:id. Cubierto en el plan de Santiago para hoy."),
        ("Ajuste Sprint Backlog",
            "Sin cambios. Se aprovecha el buffer (~30 min) para mejorar el mensaje del toast "
            "de error del lote (Acción del PO en la Review)."),
    ], styles))

    s.append(Paragraph("Daily Scrum — Día 3 (Miércoles)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Miércoles — Día 3"),
        ("Progreso hacia el objetivo",
            "Flujo completo demostrable: Carlos emite factura individual → Laura recibe "
            "notificación 'Tienes una factura nueva: $120 — Luz' y la ve en /residente/facturas "
            "con badge ámbar 'Pendiente'. Lote también demostrable: Carlos emite la factura de "
            "luz a todos los residentes activos en una sola acción; el cron de demo enriquece el "
            "seed con un mes pasado de facturas pagadas para que la vista del residente se vea "
            "real. e2e/facturacion.spec.ts verde en CI. Documentación del deploy del módulo "
            "lista en /docs/ops/deploy-modulo-facturacion.md."),
        ("Plan siguiente 24h",
            "Gonza Morales: guión de la Sprint Review con dos escenarios (individual + lote). "
            "Santiago Flores: validar vista del residente en viewport móvil (360 px). Cortez "
            "Zamora: ensayar el e2e en pantalla compartida (mostrar trace en la Review)."),
        ("Impedimentos",
            "Laura (stakeholder) preguntó si puede descargar un PDF de la factura. Está fuera del "
            "scope del S8; el PDF entra como PBI del S9 (Facturación v2). Se registra como insumo."),
        ("Ajuste Sprint Backlog",
            "Sin cambios. PDF queda confirmado en el alcance del Sprint 9."),
    ], styles))
    s.append(PageBreak())

    # ── 3. SPRINT REVIEW ───────────────────────────────────────────────────
    s.append(section_banner("3   ACTA DE SPRINT REVIEW", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina "
        "adaptaciones futuras. Es una sesión de trabajo, no una presentación.",
        styles["Note"],
    ))
    s.append(info_table([
        ("Sprint", "Sprint 8 — Semana 10"),
        ("Fecha", "Viernes — cierre de semana 10"),
        ("Duración", "55 minutos"),
        ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
        ("Scrum Team",
            "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
            "Gonza Morales Yoel, Santiago Flores Carlos"),
        ("Stakeholders",
            "Laura Vega (Residente — protagonista del incremento), Carlos Fuentes (Admin — "
            "emite las facturas), Sra. Rosa Díaz (Dueña — observadora, le interesa el dato de "
            "ingresos para el dashboard ejecutivo del S14), Profesor del curso"),
        ("Incremento presentado",
            "Módulo Facturación v1 operativo: vista /admin/facturacion (formulario individual + "
            "acción 'Emitir a todos' transaccional), vista /residente/facturas (tarjetas con "
            "desglose + filtro + total acumulado), notificación Realtime al residente, segundo "
            "E2E en la suite, documentación del deploy manual del módulo."),
        ("Modalidad de demo",
            "Dos navegadores en pantalla compartida (admin + residente) para evidenciar la "
            "notificación Realtime al emitir. Trace viewer de Playwright para mostrar el E2E."),
    ], styles))

    s.append(Paragraph("Guión de demostración", styles["H2"]))
    demo = [
        "Carlos Fuentes (admin, navegador izquierdo) abre /admin/facturacion y emite una factura "
        "individual: residente Laura Vega, tipo 'Luz', monto $120, periodo '2026-05', "
        "vencimiento autocompletado al 30/05/2026.",
        "En el navegador derecho, Laura (residente) ve aparecer una notificación en su campana "
        "del S6 con texto 'Tienes una factura nueva: Luz — $120, vence 30/05'. Click en la "
        "notificación → la lleva al detalle de la factura.",
        "Laura entra a /residente/facturas y ve la lista en tarjetas: la nueva con badge ámbar "
        "'Pendiente', otras pagadas con badge verde, una vencida del seed con badge rojo. En la "
        "cabecera: 'Tienes $320 por pagar este mes' (suma de pendientes).",
        "Laura filtra por estado 'Pendientes' y solo quedan las dos pendientes. Toca una tarjeta "
        "y abre el detalle: número de factura F-2026-05-001, desglose, descripción.",
        "Carlos vuelve a /admin/facturacion y ejecuta el lote: 'Emitir a todos', tipo 'Agua', "
        "monto $40, periodo '2026-05'. Modal de confirmación muestra '8 residentes activos serán "
        "facturados'. Confirma. La acción crea 8 facturas en una transacción (~120 ms). "
        "Toast: 'Se emitieron 8 facturas correctamente'.",
        "Carlos intenta repetir el lote idéntico — el sistema detecta el UNIQUE constraint y "
        "revierte la transacción: toast claro 'Ya se emitió el lote de Agua para 2026-05'.",
        "Trace viewer de Playwright: se abre el reporte del workflow e2e.yml más reciente. Se "
        "ve el e2e/facturacion.spec.ts pasando: login admin → emite factura → login residente → "
        "ve factura → verifica notificación. Verde y reproducible.",
        "La Sra. Rosa Díaz pide ver una previsualización del 'dashboard ejecutivo' del S14: el "
        "equipo le anticipa cómo la sección 'Finanzas' consumirá estos datos (ingresos por tipo, "
        "ratio cobrado/pendiente). Sin código aún — solo conversación de roadmap.",
    ]
    for i, step in enumerate(demo, start=1):
        s.append(Paragraph(f"<b>{i}.</b> {step}", styles["BodyLeft"]))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Revisión del Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "✓ <b>CUMPLIDO:</b> módulo Facturación v1 operativo (emisión individual + lote "
            "transaccional con UNIQUE protegido + vista residente con tarjetas y filtros + "
            "notificación Realtime). Segundo E2E de la suite Playwright en CI. Deploy del módulo "
            "documentado. <b>DoD v2 al 89%</b> (8/9 — el criterio /health + verificación post-deploy "
            "se completa como chore del Sprint 9). Sprint cerrado sin usar el buffer.",
        styles,
    ))
    s.append(Spacer(1, 6))

    s.append(Paragraph("Feedback de stakeholders", styles["H2"]))

    s.append(Paragraph("Laura Vega (Residente)", styles["H3"]))
    for bullet in [
        '"La notificación en la campana es perfecta — me enteré sin tener que entrar a buscar." → Validación.',
        '"Saber el total a pagar este mes desde el primer vistazo me ahorra cuentas mentales." → Validación.',
        '"¿Puedo descargar un PDF de la factura pagada como comprobante para mis registros?" → <b>PBI-S8-E01</b>: '
        "'Descargar PDF de comprobante por factura pagada'. P2, 2h. <b>Confirmado para Sprint 9 (Facturación v2).</b>",
        '"Cuando vea próximas a vencer, me gustaría que la tarjeta cambie de color antes del vencimiento real." → '
        "Incluido implícitamente en HU-FACT-08 del S9 (recordatorios 3 días antes).",
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Carlos Fuentes (Administrador)", styles["H3"]))
    for bullet in [
        '"La acción \'Emitir a todos\' me ahorra horas de trabajo manual cada mes." → Validación.',
        '"El mensaje de error cuando intenté repetir el lote es claro — supe exactamente qué pasó." → Validación.',
        '"¿Puedo ver cuánto se ha cobrado y cuánto está pendiente como total del edificio?" → <b>PBI-S8-E02</b>: '
        "'Tarjeta agregada en /admin/facturacion con totales del periodo (emitido, cobrado, pendiente)'. "
        "P2, 1.5h. <b>Confirmado para Sprint 9.</b>",
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Sra. Rosa Díaz (Dueña — observadora)", styles["H3"]))
    for bullet in [
        '"Ver las facturas emitiéndose en lote en segundos me da confianza. Y saber que esto se va a '
        'agregar al dashboard ejecutivo del Sprint 14 es exactamente lo que quería." → Validación + '
        "semilla del S14.",
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Spacer(1, 6))

    s.append(Paragraph("Decisiones de adaptación del Product Backlog", styles["H2"]))
    dec_review_header = ["Decisión", "Detalle"]
    dec_review_rows = [
        ["Cero hotfixes", "Cuarto Sprint consecutivo sin hotfixes — práctica consolidada."],
        ["PBI-S8-E01 (NUEVA)", "Descargar PDF de comprobante por factura pagada (feedback Laura). P2, 2h. <b>Sprint 9 (Facturación v2)</b>."],
        ["PBI-S8-E02 (NUEVA)", "Tarjeta agregada en /admin/facturacion con totales del periodo (emitido, cobrado, pendiente — feedback Carlos). P2, 1.5h. <b>Sprint 9</b>."],
        ["Suite Playwright crece", "Segundo E2E entregado (facturación). Patrón confirmado: 1 E2E por módulo nuevo, como chore."],
        ["Sprint 9 confirmado", "Facturación v2: marcar pagada + recordatorios automáticos + estado 'vencida' + PDF de comprobante + totales del periodo (absorbe los 2 emergentes nuevos)."],
        ["Chore /health en S9", "Endpoint /health (DB+Auth+Storage) entra como chore técnico del Sprint 9, completando el último criterio pendiente de DoD v2."],
    ]
    s.append(grid_table(dec_review_header, dec_review_rows, [1.6 * inch, 5.0 * inch], styles))
    s.append(PageBreak())

    # ── 4. RETROSPECTIVE ───────────────────────────────────────────────────
    s.append(section_banner("4   ACTA DE SPRINT RETROSPECTIVE", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "Referencia Scrum: la Retrospective planifica formas de aumentar calidad y "
        "efectividad. Los cambios más impactantes pueden entrar al Sprint Backlog del próximo Sprint.",
        styles["Note"],
    ))
    s.append(info_table([
        ("Sprint", "Sprint 8 — Semana 10"),
        ("Fecha", "Viernes — después de la Sprint Review"),
        ("Duración", "30 minutos"),
        ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
        ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
    ], styles))

    s.append(Paragraph("✓ ¿Qué salió bien?", styles["H2"]))
    for line in [
        "El módulo Facturación se entregó completo (BD + emisión + vista + notificación) en un solo "
        "Sprint, validando que dividir Facturación en v1/v2 era el dimensionamiento correcto.",
        "Reusar el sistema de notificaciones del Sprint 6 ahorró horas: extender el switch para un "
        "nuevo tipo de notificación tomó 30 min en vez de rehacer infraestructura.",
        "El UNIQUE constraint y el manejo transaccional del lote evitaron toda una clase de bugs de "
        "duplicación que habrían aparecido en producción.",
        "Aplicamos la acción 1 del Retro S7 (seed representativo): el seed de Facturación incluyó un "
        "mes pasado de facturas pagadas, lo que hizo que la demo se viera real desde el primer click.",
        "Cuarto Sprint consecutivo sin hotfixes. La práctica del Refinement previo al Planning es "
        "del proceso.",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("✗ ¿Qué salió mal?", styles["H2"]))
    for line in [
        "El tema decimal del monto generó debate (15 min) que pudimos haber evitado documentando la "
        "decisión 'numeric(10,2) + string en frontend' como estándar del proyecto. Falta un "
        "/docs/conventions.md con este tipo de reglas pequeñas.",
        "El helper de fecha_vencimiento_por_defecto se escribió contra el día 30 sin considerar de "
        "entrada el caso de febrero. Lo arreglamos en Día 1 con el helper y los tests, pero "
        "habríamos ahorrado discusión si lo identificábamos en el Refinement.",
        "El stakeholder Laura pidió PDF de comprobante en el Día 3 — fuera de scope, pero si lo "
        "hubiéramos previsto al hacer Sprint Planning, lo habríamos incluido (cabe en el buffer). "
        "Confirma que vale la pena tener al stakeholder en el Planning, no solo en la Review.",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("Acciones de mejora (máx. 3)", styles["H2"]))
    actions = [
        ("Acción 1 — /docs/conventions.md de decisiones recurrentes",
         "Crear documento con las decisiones pequeñas que se repiten (decimales, fechas, ids, "
         "naming de RPCs, formato de errores). Si algo aparece en un Retro, se documenta. Evita "
         "re-discutir la misma decisión en cada Sprint.",
         "Cortez Zamora Leonardo",
         "/docs/conventions.md con al menos 5 decisiones documentadas",
         "Sprint 9"),
        ("Acción 2 — Stakeholder en Planning, no solo en Review",
         "Para los Sprints de Facturación v2 (S9), Tienda v1 (S10) y Tienda v2 (S11), invitar al "
         "stakeholder relevante (Laura para finanzas, residente para tienda) al Planning de 30 "
         "min adicional. Captura pedidos como el PDF a tiempo.",
         "Alvarez Rocca Jaqueline",
         "Acta de Planning de cada uno de S9, S10, S11 menciona stakeholder invitado",
         "Sprint 9 (primera aplicación)"),
        ("Acción 3 — Refinement con foco en edge cases de dominio",
         "El Refinement previo al Planning añade un punto fijo: 'edge cases del dominio del "
         "Sprint'. En este Sprint habría capturado febrero / fin de mes. Para S9 captura: '¿qué "
         "pasa si pago dos veces?', '¿qué pasa si el periodo es ambiguo?'.",
         "Meza Pelaez Carlos",
         "El acta del Refinement de S9 incluye sección 'Edge cases del dominio'",
         "Sprint 9"),
    ]
    for title, desc, owner, evidence, when in actions:
        s.append(Paragraph(title, styles["H3"]))
        s.append(info_table([
            ("Descripción", desc),
            ("Dueño", owner),
            ("Evidencia", evidence),
            ("Fecha", when),
        ], styles))
        s.append(Spacer(1, 4))

    s.append(Paragraph("Verificación DoD v2", styles["H2"]))
    dod_header = ["Criterio", "Estado"]
    dod_rows = [
        ["Todo lo de DoD v1 (lint, unit tests, README, manejo errores, seed, deploy preview)", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Pruebas de integración para flujos críticos (RLS facturas con 3 roles + RPC lote)", Paragraph("✓ CUMPLIDO — 8 tests integración nuevos", styles["OkLabel"])],
        ["Cobertura ≥ 60% en módulos core (src/lib/facturas.ts)", Paragraph("✓ CUMPLIDO — 73%", styles["OkLabel"])],
        ["Endpoint /health disponible en staging", Paragraph("■ Pendiente — confirmado como chore del Sprint 9", styles["WarnLabel"])],
        ["Variables de entorno via Secrets CI/CD — sin hardcode", Paragraph("✓ CUMPLIDO — no hay variables nuevas en este Sprint", styles["OkLabel"])],
        ["Despliegue staging con verificación post-deploy", Paragraph("■ Pendiente — deploy manual documentado, automático llega en chore del S10", styles["WarnLabel"])],
        ["tsc --noEmit pasa sin errores en CI", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Playwright: al menos 1 E2E en pipeline (semilla S7)", Paragraph("✓ CUMPLIDO — ahora son 2 E2E (crear-solicitud + facturacion)", styles["OkLabel"])],
        ["ADR-007 documentado (modelo de facturas)", Paragraph("✓ CUMPLIDO — adicional a DoD v2", styles["OkLabel"])],
    ]
    s.append(grid_table(dod_header, dod_rows, [4.6 * inch, 2.0 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "<b>DoD v2 al 89%</b> (8/9 — el único pendiente es /health + verificación post-deploy, que "
            "se cierra en el chore del Sprint 9). Sprint 8 cerrado sin usar el buffer. La suite "
            "Playwright pasa de 1 a 2 E2E sin volverse protagonista — el patrón del chore "
            "intercalado se sostiene.",
        styles,
    ))
    s.append(PageBreak())

    # ── 5. HISTORIAS DE USUARIO ────────────────────────────────────────────
    s.append(section_banner("5   HISTORIAS DE USUARIO — SPRINT 8", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Módulo FACTURACIÓN — Sprint 8 (v1)", styles["H2"]))

    s.append(hu_card(
        "HU-FACT-01 · Modelado BD de facturas",
        "Tabla facturas + RLS + UNIQUE + trigger de notificación",
        "Sprint 8 · 2 h", "P1 · 2 h",
        "Como <b>sistema</b>, quiero <b>una tabla facturas con tipo, monto, periodo, fechas, estado y "
        "RLS por rol</b>, para soportar la emisión, consulta y futuras integraciones (Tienda S11, "
        "Dashboard ejecutivo S14).",
        [
            "Migración 009 crea tabla facturas con: id (uuid), residente_id (FK profiles), tipo (enum: luz/agua/pension/multa), monto (numeric(10,2) ≥ 0), periodo (text 'YYYY-MM'), fecha_emision (date), vencimiento (date), estado (enum: pendiente/pagada/vencida), descripcion (text opcional), created_at, updated_at.",
            "Constraint UNIQUE(residente_id, tipo, periodo) impide duplicar la emisión del mismo concepto en el mismo mes.",
            "Índices por (residente_id, vencimiento) y por (estado) para soportar filtros del residente y del admin.",
            "RLS: residente SELECT solo donde residente_id = auth.uid(); admin SELECT/INSERT/UPDATE en toda la tabla; técnico sin acceso.",
            "Trigger after_factura_inserted inserta automáticamente una notificación tipo='factura_nueva' en la tabla notificaciones (reusa Realtime del S6).",
            "Tests de integración con los 3 roles validan las políticas RLS.",
        ],
        "Migración 009 aplicada en staging. RLS verificada con tests automatizados. ADR-007 documenta el modelo.",
        styles,
    ))

    s.append(hu_card(
        "HU-FACT-02 · Admin emite factura (individual + lote)",
        "Formulario + acción 'Emitir a todos' transaccional",
        "Sprint 8 · 3 h", "P1 · 3 h",
        "Como <b>administrador</b>, quiero <b>emitir facturas mensuales por residente — una a una "
        "o en lote para todos los residentes activos</b>, para gestionar los cobros del edificio sin "
        "tareas manuales repetidas.",
        [
            "Vista /admin/facturacion con dos modos: 'Emisión individual' y 'Emisión por lote'.",
            "Individual: formulario con residente (dropdown filtrado por estado_cuenta='activo'), tipo, monto, periodo, vencimiento (autocompletado al día 30 del mes con ajuste de febrero).",
            "Lote: 'Emitir a todos' con modal de confirmación que muestra cuántos residentes se afectarán antes de ejecutar.",
            "El lote corre en una sola transacción Postgres (RPC emitir_facturas_lote): si una inserción falla por UNIQUE, toda la transacción se revierte y se muestra mensaje claro.",
            "Validaciones cliente y servidor: monto ≥ 0, periodo en formato 'YYYY-MM', vencimiento posterior a fecha_emision.",
            "Toast de éxito con el conteo ('Se emitieron 8 facturas') o de error con detalle.",
        ],
        "Carlos emitió 8 facturas en lote durante la Sprint Review. UNIQUE protegió contra la doble emisión en el segundo intento.",
        styles,
    ))

    s.append(hu_card(
        "HU-FACT-03 · Residente ve sus facturas con desglose",
        "Tarjetas por tipo + filtro por estado + total acumulado",
        "Sprint 8 · 3 h", "P1 · 3 h",
        "Como <b>residente activo</b>, quiero <b>ver mis facturas en mi panel con desglose por tipo y "
        "estado</b>, para saber exactamente cuánto debo pagar este mes y qué ya está saldado.",
        [
            "Vista /residente/facturas con tarjetas: tipo (icono + etiqueta), monto en grande, vencimiento, badge de estado (verde 'Pagada' / ámbar 'Pendiente' / rojo 'Vencida').",
            "Cabecera con total acumulado pendiente del periodo ('Tienes $XXX por pagar este mes').",
            "Filtro por estado en la cabecera (Todas / Pendientes / Pagadas / Vencidas).",
            "Ordenadas por vencimiento ascendente (más urgentes primero).",
            "Click en una tarjeta abre el detalle con: número legible (F-2026-05-001), desglose, descripción si existe, botón 'Volver'.",
            "Responsiva: en móvil las tarjetas se apilan verticalmente.",
            "Paginación lazy con scroll infinito (carga de 25 en 25) para soportar facturas históricas sin saturar.",
            "RLS verifica que solo se muestren facturas con residente_id = auth.uid().",
        ],
        "Laura vio sus facturas en la Review con el total acumulado pendiente visible desde la cabecera.",
        styles,
    ))

    s.append(hu_card(
        "HU-FACT-05 · Notificación Realtime al emitir factura",
        "Reusa NotificacionesContext del S6 con nuevo tipo",
        "Sprint 8 · 2 h", "P2 · 2 h",
        "Como <b>residente</b>, quiero <b>recibir una notificación en tiempo real cuando se me emita "
        "una factura nueva</b>, para enterarme sin tener que entrar al panel a verificar.",
        [
            "Trigger after_factura_inserted en BD inserta 1 fila en notificaciones con tipo='factura_nueva' y mensaje (ej. 'Factura nueva: Luz — $120, vence 30/05').",
            "NotificacionesContext del Sprint 6 reconoce el nuevo tipo y muestra icono específico (recibo) en la campana.",
            "Click en la notificación navega a /residente/facturas/:id (detalle de la factura).",
            "La campana refleja el cambio en menos de 1.5 s (test de latencia en demo con 2 navegadores).",
            "Si Resend está configurado (RESEND_API_KEY presente), se dispara también un email simulado al residente (fire-and-forget; si falla, la factura igual se crea).",
            "Test de integración multi-cliente: emitir factura para residente_A → solo residente_A recibe la notificación, residente_B no.",
        ],
        "Demo con dos navegadores: emisión a Laura → notificación en su campana en 1.2 s. Click → detalle.",
        styles,
    ))

    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "<b>Chore técnico del Sprint:</b> segundo E2E de la suite Playwright "
        "(<i>e2e/facturacion.spec.ts</i>: login admin → emite → login residente → ve factura + "
        "notificación) + documentación del deploy manual del módulo en "
        "<i>/docs/ops/deploy-modulo-facturacion.md</i>. 1.5 h, P2. La suite pasa de 1 a 2 E2E "
        "sin volverse protagonista.",
        styles["Body"],
    ))
    s.append(Spacer(1, 6))

    s.append(Paragraph("PBIs emergentes — entran en Sprints futuros", styles["H2"]))
    em_header = ["ID", "Historia", "Prior.", "Horas est.", "Sprint"]
    em_rows = [
        ["PBI-S8-E01", "Descargar PDF de comprobante por factura pagada (feedback Laura)", Paragraph("● P2", styles["WarnLabel"]), "2 h", "9"],
        ["PBI-S8-E02", "Tarjeta de totales del periodo en /admin/facturacion (emitido/cobrado/pendiente — feedback Carlos)", Paragraph("● P2", styles["WarnLabel"]), "1.5 h", "9"],
        ["PBI-S6-E03", "Sesiones activas + cerrar todas al cambiar contraseña", Paragraph("● P2", styles["WarnLabel"]), "2 h", "13"],
        ["PBI-S6-E01", "Indicador de presencia en panel admin (Supabase Presence)", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S6-E02", "Sonido + haptic feedback opcional al recibir notificación", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S7-E01", "Filtros por categoría en el dashboard de métricas", Paragraph("● P2", styles["WarnLabel"]), "1 h", "13"],
        ["PBI-S6-E04", "Resumen diario por email a técnicos con asignaciones pendientes", Paragraph("● P3", styles["OkLabel"]), "2 h", "Sin asignar"],
    ]
    s.append(grid_table(em_header, em_rows, [1.1 * inch, 3.0 * inch, 0.7 * inch, 0.8 * inch, 0.7 * inch], styles))
    s.append(PageBreak())

    # ── 6. ESTADO DEL BACKLOG ──────────────────────────────────────────────
    s.append(section_banner("6   ESTADO DEL BACKLOG TRAS SPRINT 8", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Progreso acumulado", styles["H2"]))
    progress_header = ["Sprint", "Horas invertidas", "Incremento entregado", "Estado"]
    progress_rows = [
        ["Sprint 0", "12 h", "Setup técnico + CI + ADRs + Supabase configurado", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 1", "15 h", "Módulo Auth: registro 2 pasos + login por rol + recuperación", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 2", "14 h", "Panel admin + gestión de usuarios + bloqueo/desbloqueo", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 3", "13 h", "Mantenimiento v1: crear solicitud con foto + vista admin", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 4", "13 h", "Mantenimiento v2: asignación + vista técnico + cierre + cámara móvil + confirmación residente", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 5", "13 h", "Trazabilidad: audit log + historial + perfil + foto al rechazar", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 6", "13 h", "Comunicación Realtime: notificaciones + email + foto cierre + alerta admin", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 7", "13 h", "Métricas y Dashboard visual: KPIs + gráficas Recharts + CSV + vista materializada", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 8", "13 h", "★ Facturación v1: tabla facturas + emisión individual/lote + vista residente + notificación Realtime", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 9", "13 h (est.)", "Facturación v2: marcar pagada + recordatorios + estado 'vencida' + PDF de comprobante + totales del periodo", Paragraph("→ Próximo", styles["WarnLabel"])],
        ["Sprints 10–14", "65 h (est.)", "Tienda v1/v2 · Notificaciones avanzadas · Panel residente · ★ Dashboard ejecutivo del dueño + RC", Paragraph("■ Planificado", styles["WarnLabel"])],
    ]
    s.append(grid_table(progress_header, progress_rows, [0.85 * inch, 0.95 * inch, 3.8 * inch, 1.0 * inch], styles))
    s.append(Paragraph(
        "<b>Total invertido:</b> 119 horas en 9 sprints (Sprint 0 → Sprint 8).<br/>"
        "<b>Total restante:</b> 78 horas estimadas en 6 sprints.<br/>"
        "<b>Velocidad promedio:</b> 13.2 horas/sprint (estable por sexto sprint consecutivo).",
        styles["Body"],
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Roadmap actualizado tras Sprint 8 Review", styles["H2"]))
    rm_header = ["Sprint", "Sem.", "Objetivo principal — Entregable funcional"]
    rm_rows = [
        ["S9", "11", "Facturación v2: marcar pagada + recordatorios automáticos + estado 'vencida' + PDF comprobante + totales del periodo (absorbe S8-E01, S8-E02)"],
        ["S10", "12", "Tienda interna v1: admin gestiona catálogo (stock/precio + foto) + residente navega con filtros y búsqueda + chore CD"],
        ["S11", "13", "Tienda interna v2: carrito + descuento atómico de stock + pedido se suma a la factura mensual"],
        ["S12", "14", "Notificaciones avanzadas: Web Push + presencia (Supabase Presence) + sonido/haptic + preferencias"],
        ["S13", "15", "Panel integral del residente + sesiones activas + filtros por categoría en métricas (S7-E01)"],
        ["S14", "16", "★ Dashboard ejecutivo del dueño (Mantenimiento + Finanzas + Tienda) + Release Candidate + demo final"],
    ]
    s.append(grid_table(rm_header, rm_rows, [0.55 * inch, 0.5 * inch, 5.7 * inch], styles))
    s.append(Paragraph(
        "Nota: los dos emergentes del Sprint 8 (S8-E01 PDF de comprobante y S8-E02 totales del periodo) "
        "se absorben en el Sprint 9 — encajan temáticamente con Facturación v2 y suben el alcance "
        "del próximo sprint en 3.5 h. Cabe dentro de las 13 h estimadas + buffer.",
        styles["Note"],
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Vista previa Sprint 9 — Facturación v2 (cobros y recordatorios)", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "Sprint 9: cerrar el ciclo de facturación. Admin marca como pagada, sistema dispara "
            "recordatorios automáticos 3 días antes del vencimiento, facturas vencidas se etiquetan "
            "solas, residente descarga PDF de comprobante, admin ve totales del periodo. Chore: "
            "endpoint /health (cierra DoD v2).",
        styles,
    ))
    preview_header = ["PBI", "Historia", "Horas est.", "Prior."]
    preview_rows = [
        ["HU-FACT-04", "Admin marca factura como pagada + recordatorio Realtime al residente", "3 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-FACT-08", "Recordatorio 3 días antes del vencimiento (Edge Function cron diario)", "3 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-FACT-06", "Estado automático 'vencida' (cron diario)", "2 h", Paragraph("● P2", styles["WarnLabel"])],
        ["PBI-S8-E01", "Descargar PDF de comprobante por factura pagada", "2 h", Paragraph("● P2", styles["WarnLabel"])],
        ["PBI-S8-E02", "Tarjeta de totales del periodo en /admin/facturacion (emitido/cobrado/pendiente)", "1.5 h", Paragraph("● P2", styles["WarnLabel"])],
        ["Chore-T", "Endpoint /health (DB + Auth + Storage) — cierra DoD v2", "1 h", Paragraph("● P2", styles["WarnLabel"])],
    ]
    s.append(grid_table(preview_header, preview_rows, [1.1 * inch, 3.9 * inch, 0.8 * inch, 0.8 * inch], styles))
    s.append(Paragraph("<b>Total estimado Sprint 9:</b> 12.5 horas (2.5 h de buffer).", styles["Body"]))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Variables de entorno acumuladas al Sprint 8", styles["H2"]))
    s.append(Paragraph(
        "No hay variables nuevas en este Sprint. Las anteriores siguen vigentes:",
        styles["Body"],
    ))
    env_header = ["Variable", "Descripción", "Dónde se usa", "Desde Sprint"]
    env_rows = [
        ["VITE_SUPABASE_URL", "URL pública del proyecto Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["VITE_SUPABASE_ANON_KEY", "Clave anónima de Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["SUPABASE_SERVICE_ROLE_KEY", "Clave de servicio (admin) de Supabase", "Edge Functions (servidor) · próximamente /health", "Sprint 3"],
        ["RESEND_API_KEY", "Clave de API de Resend para emails", "Edge Functions (notificación de factura simulada)", "Sprint 2"],
        ["RESEND_FROM_ADDRESS", "Remitente del email de notificaciones", "Edge Function notificar-cambio-estado / factura nueva", "Sprint 6"],
        ["SUPABASE_DB_URL", "URL de conexión directa a la BD", "Migraciones locales", "Sprint 0"],
    ]
    s.append(grid_table(env_header, env_rows, [1.9 * inch, 2.4 * inch, 1.6 * inch, 0.7 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "Variables proyectadas para futuros Sprints (según roadmap reformulado):<br/>"
        "• Sprint 10 (CD): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID para el deploy automático al mergear a main.<br/>"
        "• Sprint 12 (Web Push): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY para las notificaciones push.",
        styles["Body"],
    ))
    s.append(Paragraph(
        "Ninguna de estas variables debe aparecer en el código fuente ni en commits. "
        "Todas van en .env.local (local) y en Secrets de GitHub/Vercel (CI/CD).",
        styles["Note"],
    ))

    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "— Zity · Artefactos Sprint 8 · Documento vivo — actualizar en cada Sprint Review —",
        styles["Footer"],
    ))

    return s


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "sprints")
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "Zity_Sprint8_Artefactos.pdf")

    styles = build_styles()
    doc = make_doc(out_path)
    story = build_story(styles)
    doc.build(story)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Generado: {out_path}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
