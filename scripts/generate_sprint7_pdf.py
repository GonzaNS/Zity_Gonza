"""
Genera el PDF de artefactos Scrum del Sprint 7 (Zity).
Tema: Métricas y Dashboard visual — panel de KPIs con gráficas (Recharts),
exportación CSV y vista materializada. Playwright entra como chore técnico
intercalado (sin protagonismo).

Estilo visual: cabecera azul con título centrado, tablas tipo zebra,
secciones numeradas con banda de color, footer con número de página.

Uso:
    python scripts/generate_sprint7_pdf.py

Salida:
    docs/sprints/Zity_Sprint7_Artefactos.pdf
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


# ─── Helpers de tabla ─────────────────────────────────────────────────────────


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


# ─── Plantilla con cabecera/pie ───────────────────────────────────────────────


def make_doc(path):
    doc = BaseDocTemplate(
        path, pagesize=LETTER,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Zity · Artefactos Sprint 7",
        author="Equipo Zity",
        subject="Métricas y Dashboard visual: panel de KPIs con gráficas Recharts, exportación CSV, vista materializada",
        keywords="scrum, sprint 7, zity, metricas, dashboard, recharts, csv, kpis",
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
        canvas.drawString(LEFT_MARGIN + 0.32 * inch, 0.4 * inch, "· Artefactos Scrum · Sprint 7")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.4 * inch, f"pág. {doc_.page}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=on_page)])
    return doc


# ─── Contenido del Sprint 7 ───────────────────────────────────────────────────


def build_story(styles):
    s: list = []

    # ── Portada ────────────────────────────────────────────────────────────
    s.append(Spacer(1, 20))
    s.append(Paragraph("Zity", styles["TitleCover"]))
    s.append(Spacer(1, 4))
    s.append(_separador_decorativo())
    s.append(Spacer(1, 12))
    s.append(Paragraph("Artefactos Scrum — Sprint 7", styles["SubtitleCover"]))
    s.append(Paragraph(
        "Métricas y Dashboard visual — Panel de KPIs del admin · Gráficas de barras y líneas (Recharts) · "
        "Exportación CSV · Vista materializada Postgres · Playwright como chore técnico intercalado",
        styles["TaglineCover"],
    ))
    s.append(Spacer(1, 16))
    s.append(info_table([
        ("Producto", "Zity"),
        ("Sprint", "Sprint 7 — Semana 9"),
        ("Stack",
            "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
            "Resend · Vercel · GitHub Actions · Vitest · <b>Recharts</b> (nuevo en este Sprint para gráficas) · "
            "<b>Playwright</b> (instalado como chore técnico)"),
        ("Product Owner", "Alvarez Rocca Jaqueline"),
        ("Scrum Master", "Meza Pelaez Carlos"),
        ("Developers",
            "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
        ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
        ("Horas estimadas", "13 horas (2 horas de buffer)"),
        ("DoD aplicable",
            "DoD v2 — cuarta aplicación · arranca la inversión en E2E (semilla) que se completa "
            "como chore en sprints siguientes"),
        ("Nuevo en este sprint",
            "Vista /admin/metricas con panel de KPIs (total, por estado, por tipo, tiempo promedio) · "
            "Gráficas de barras y líneas con Recharts · Exportación CSV por rango de fechas · "
            "Vista materializada Postgres vw_metricas_solicitudes (refrescada cada hora) · "
            "Cambio de enfoque del roadmap: cada Sprint pasa a ser un módulo funcional; "
            "lo técnico (Playwright, /health, CD…) se intercala como chore"),
        ("Chore técnico del Sprint", "Instalar Playwright + escribir el primer E2E (crear solicitud). 1 h, P3."),
        ("Variables nuevas", "Ninguna en código fuente · pg_cron habilitado en Supabase para el refresh de la vista materializada"),
        ("Nota", "Documento académico — Datos ficticios sin PII real"),
    ], styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Documento vivo — se actualiza en cada Sprint Review", styles["Footer"]))
    s.append(PageBreak())

    # ── 1. SPRINT PLANNING ─────────────────────────────────────────────────
    s.append(section_banner("1   ACTA DE SPRINT PLANNING", styles))
    s.append(Spacer(1, 14))
    s.append(info_table([
        ("Sprint", "Sprint 7 — Semana 9"),
        ("Fecha", "Lunes — inicio de semana 9"),
        ("Duración del evento", "75 minutos"),
        ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
        ("Asistentes",
            "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), "
            "Cortez Zamora Leonardo, Gonza Morales Yoel, Santiago Flores Carlos (Devs)"),
        ("Stakeholder invitado",
            "Carlos Fuentes (Admin ficticio) — usuario directo del nuevo dashboard de métricas. "
            "También se invita a la Sra. Rosa Díaz (dueña del edificio) como observadora: las gráficas "
            "que veremos son la semilla del dashboard ejecutivo del Sprint 14 (broche del curso)."),
        ("Capacidad", "15 horas disponibles · se usarán 13 h (2 h de buffer)"),
        ("Entrada",
            "Product Backlog reformulado tras la decisión del equipo de cambiar el enfoque del roadmap: "
            "cada Sprint cierra con un módulo funcional demostrable; lo técnico (Playwright, /health, "
            "CD, OWASP, performance) se reparte como chore. PBI-22, HU-KPI-01 y PBI-17 entran como "
            "núcleo del Sprint. 4 emergentes del S6 (E01-E04) NO entran (van a S12-S13)."),
        ("Refinement previo",
            "Práctica institucionalizada desde S5 Retro: el viernes anterior el PO presentó los "
            "criterios completos en 30 min. Resultado esperado: cero hotfixes (tercer Sprint consecutivo)."),
    ], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        '"Que el admin abra su panel y vea de un vistazo el volumen, los tiempos promedio y la '
        "distribución de las solicitudes en gráficas claras (barras y líneas), y que pueda "
        'exportar el rango que necesite a CSV."',
        styles,
    ))
    s.append(Paragraph(
        "Nota: Cuarta aplicación de DoD v2. La instalación de Playwright entra como <b>chore técnico de "
        "1 hora</b> (no como protagonista) — el primer E2E queda en CI como semilla. La suite crece "
        "como chore en sprints siguientes (un E2E por módulo nuevo).",
        styles["Note"],
    ))
    s.append(Spacer(1, 10))

    s.append(Paragraph("PBIs seleccionados — Sprint 7", styles["H2"]))
    pbi_header = ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"]
    pbi_rows = [
        ["PBI-22",
         "Panel de métricas /admin/metricas: total, por estado, por tipo, tiempo promedio de resolución",
         "Historia", Paragraph("● P1", styles["FailLabel"]), "5 h", "Gonza Morales"],
        ["HU-KPI-01",
         "Gráficas con Recharts: barras por tipo + líneas de tiempo de resolución mensual + top 5 categorías",
         "Historia", Paragraph("● P1", styles["FailLabel"]), "3 h", "Santiago Flores"],
        ["PBI-17",
         "Exportar solicitudes a CSV por rango de fechas (botón en /admin con selector de rango)",
         "Historia", Paragraph("● P2", styles["WarnLabel"]), "2 h", "Cortez Zamora"],
        ["Refactor",
         "Vista materializada Postgres vw_metricas_solicitudes + cron de refresh cada hora",
         "Refactor", Paragraph("● P2", styles["WarnLabel"]), "2 h", "Gonza Morales"],
        ["Chore-T",
         "Instalar Playwright + workflow CI + primer E2E del flujo 'crear solicitud' (semilla)",
         "Chore", Paragraph("● P3", styles["OkLabel"]), "1 h", "Cortez Zamora"],
    ]
    s.append(grid_table(
        pbi_header, pbi_rows,
        [0.85 * inch, 2.65 * inch, 0.65 * inch, 0.55 * inch, 0.55 * inch, 1.05 * inch],
        styles,
    ))
    s.append(Paragraph(
        "Total estimado: 13 horas · 2 horas de buffer disponibles para imprevistos del refactor o la "
        "integración de Recharts.",
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
        ["Recharts sobre SVG nativo",
         "Se elige Recharts (~110 KB minified+gzip) por velocidad de implementación, soporte de "
         "barras/líneas/pie out-of-the-box y composición declarativa en React. Se aplica code splitting "
         "(lazy load) para que el bundle inicial no crezca: solo se carga al abrir /admin/metricas.",
         "ADR-006 (redactado en este Sprint)"],
        ["Vista materializada vw_metricas_solicitudes",
         "Las queries de KPIs (count agrupado por tipo/estado, AVG de tiempo de resolución) son pesadas "
         "para correrlas en cada apertura del panel. Se crea una vista materializada y un cron de "
         "Postgres (pg_cron) que la refresca cada hora con REFRESH CONCURRENTLY.",
         "Migración 008 + /docs/metricas.md"],
        ["Fórmula del tiempo de resolución",
         "Tiempo de resolución = (timestamp de cambio a 'resuelta') − (timestamp de creación). En "
         "minutos. Se reportan promedio, mediana y P95 — la mediana protege contra outliers de "
         "solicitudes muy viejas o atascadas.",
         "/docs/metricas.md (sección fórmulas)"],
        ["Formato del CSV",
         "Codificación UTF-8 con BOM (para que Excel reconozca los acentos sin pasos extra). "
         "Separador coma. Fechas en ISO-8601 (YYYY-MM-DD HH:MM). Cabecera en español. Se genera "
         "server-side con pg COPY y se descarga con Content-Disposition: attachment.",
         "Criterio PBI-17"],
        ["Tests para fórmulas de KPIs",
         "Los KPIs deben tener tests unitarios de las fórmulas de cálculo (no solo del SQL): "
         "casos de borde con 0 solicitudes, 1 solicitud, solicitudes sin resolver, outliers extremos.",
         "DoD v2 — coverage ≥ 60%"],
        ["Playwright como chore intercalado",
         "Solo el setup mínimo: playwright.config.ts con Chromium, workflow CI básico y 1 spec del "
         "flujo 'crear solicitud'. Sin matriz Firefox, sin trace viewer avanzado. La suite crecerá "
         "como chore en cada Sprint funcional (1 E2E por módulo).",
         "Chore-T + /docs/testing/e2e.md (sección inicial)"],
    ]
    s.append(grid_table(dec_header, dec_rows, [1.4 * inch, 4.2 * inch, 1.3 * inch], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Desglose de tareas — ¿Cómo?", styles["H2"]))

    s.append(Paragraph("Gonza Morales Yoel — PBI-22 + Refactor vista materializada (7 h)", styles["H3"]))
    tarea_header = ["Tarea", "Horas"]
    s.append(grid_table(tarea_header, [
        ["Queries Postgres de KPIs: total de solicitudes, conteo por estado, conteo por tipo, AVG/MEDIAN/P95 de tiempo de resolución, top 5 categorías. Documentar cada fórmula en /docs/metricas.md.", "1.5 h"],
        ["Migración 008: crear vista materializada vw_metricas_solicitudes + índices + permisos. Cron pg_cron diario con REFRESH MATERIALIZED VIEW CONCURRENTLY.", "1.5 h"],
        ["Endpoint/RPC metricas_solicitudes() que retorna el set completo de KPIs en una sola llamada. RLS verifica que solo admin puede invocar.", "1 h"],
        ["Vista /admin/metricas: layout con tarjetas (total, pendientes, en proceso, resueltas hoy) + contenedores para las gráficas. Refresh automático cada 60 s mientras el panel está abierto.", "2 h"],
        ["Tests unitarios de las fórmulas (mediana, P95, AVG con conjunto vacío) y test de integración del RPC con datos de seed.", "1 h"],
    ], [5.5 * inch, 1.0 * inch], styles))

    s.append(Paragraph("Santiago Flores Carlos — HU-KPI-01 (3 h)", styles["H3"]))
    s.append(grid_table(tarea_header, [
        ["Componente GraficaBarras<Tipo>: barras horizontales con conteo por tipo de solicitud (Recharts BarChart). Color por tipo (paleta Zity).", "1 h"],
        ["Componente GraficaLineas<TiempoResolucion>: serie temporal mensual con promedio y mediana (Recharts LineChart + ResponsiveContainer).", "1 h"],
        ["Componente TopCategorias: lista visual de las 5 categorías más reportadas con barra de proporción. Responsiva (en móvil pasa a lista apilada).", "0.5 h"],
        ["Lazy load de Recharts en /admin/metricas (React.lazy + Suspense) para no inflar el bundle inicial.", "0.5 h"],
    ], [5.5 * inch, 1.0 * inch], styles))

    s.append(Paragraph("Cortez Zamora Leonardo — PBI-17 + Chore Playwright (3 h)", styles["H3"]))
    s.append(grid_table(tarea_header, [
        ["Endpoint/RPC export_solicitudes_csv(desde, hasta): genera CSV server-side con pg COPY a un buffer + UTF-8 BOM. Solo admin (RLS).", "1 h"],
        ["UI: botón 'Exportar CSV' en /admin con popover de selector de rango (DateRangePicker reusable del S5). Descarga con Content-Disposition.", "1 h"],
        ["Chore técnico: instalar Playwright (npm), playwright.config.ts mínimo (Chromium), workflow .github/workflows/e2e.yml básico, 1 spec del flujo crear-solicitud (login → /residente/nueva → completar formulario → submit → ver en listado). ADR-006 redactado.", "1 h"],
    ], [5.5 * inch, 1.0 * inch], styles))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Riesgos del Sprint 7", styles["H2"]))
    risk_header = ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"]
    risk_rows = [
        ["R1",
         "El bundle de Recharts (~110 KB) infla el chunk de /admin y empeora Lighthouse.",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Medio", styles["WarnLabel"]),
         "Lazy load con React.lazy + Suspense: Recharts solo se descarga al abrir /admin/metricas. Validar en DevTools que el chunk inicial de /admin no crece."],
        ["R2",
         "El seed actual no tiene suficientes datos históricos (solo solicitudes recientes) y las gráficas se ven vacías.",
         Paragraph("● Alta", styles["FailLabel"]), Paragraph("● Medio", styles["WarnLabel"]),
         "El seed gana un comando --metricas que crea 3 meses de solicitudes históricas (≈ 60 filas) con tipos y estados variados. Se documenta en /docs/seed.md."],
        ["R3",
         "pg_cron puede no estar disponible o requerir setup en Supabase free tier; el refresh automático falla.",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Bajo", styles["OkLabel"]),
         "Verificar disponibilidad de pg_cron en el Día 1. Fallback: refresh on-demand cuando se abre /admin/metricas si la vista tiene más de 1 hora de antigüedad (heurística almacenada en una tabla mini)."],
        ["R4",
         "Playwright en CI puede agotar minutos del free tier de GitHub Actions si la suite crece sin control.",
         Paragraph("● Baja", styles["OkLabel"]), Paragraph("● Medio", styles["WarnLabel"]),
         "Solo Chromium como gate de PR. Sin Firefox. Sin trace viewer descargable al inicio. Cada sprint añade un solo E2E nuevo; ningún sprint añade más de uno."],
        ["R5",
         "Excel rompe formatos de fecha del CSV (interpreta DD/MM como MM/DD, etc.).",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Bajo", styles["OkLabel"]),
         "Formato ISO-8601 (YYYY-MM-DD HH:MM) y BOM UTF-8. Validar abriendo el CSV en Excel, LibreOffice y Google Sheets antes de la Review."],
        ["R6",
         "Las fórmulas de KPIs pueden tener errores silenciosos (mediana, P95) en conjuntos de borde (vacíos, 1 elemento, todos resueltos en 0 minutos).",
         Paragraph("● Media", styles["WarnLabel"]), Paragraph("● Alto", styles["FailLabel"]),
         "Tests unitarios obligatorios para cada fórmula con casos: vacío, n=1, n=2, outliers extremos. Code review específico del helper de KPIs."],
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
        'Sprint Goal: "Dashboard visual del admin con gráficas y CSV. Métricas listas para presentar."',
        styles,
    ))

    s.append(Paragraph("Daily Scrum — Día 1 (Lunes)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Lunes — Día 1"),
        ("Progreso hacia el objetivo",
            "Seed enriquecido con 3 meses de solicitudes históricas (60 filas, tipos y estados "
            "variados). Migración 008 esqueleteada: vista materializada vw_metricas_solicitudes creada "
            "y consultable. Recharts instalado y los 3 componentes de gráficas mockeados con datos "
            "hardcoded. Playwright instalado en local, primer spec smoke (login) verde. ADR-006 redactado."),
        ("Plan siguiente 24h",
            "Gonza Morales: RPC metricas_solicitudes() + cron pg_cron + queries reales. Santiago Flores: "
            "conectar las gráficas Recharts al RPC y aplicar la paleta Zity. Cortez Zamora: endpoint de "
            "CSV con pg COPY + UI del selector de rango. Workflow CI de Playwright."),
        ("Impedimentos",
            "pg_cron requiere habilitarlo desde el panel de Supabase (no es por migración). Se hizo "
            "manualmente; documentado en /docs/setup.md para que el próximo seed lo asuma habilitado."),
        ("Ajuste Sprint Backlog", "Sin cambios."),
    ], styles))

    s.append(Paragraph("Daily Scrum — Día 2 (Martes)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Martes — Día 2"),
        ("Progreso hacia el objetivo",
            "/admin/metricas funcional con datos reales: tarjetas con totales en vivo + 3 gráficas "
            "Recharts conectadas al RPC. CSV exporta correctamente y abre en Excel/Sheets/LibreOffice "
            "con acentos OK (BOM UTF-8 funciona). Cron pg_cron configurado: la vista materializada "
            "refresca cada hora. Workflow CI de Playwright corre el spec de crear-solicitud verde en "
            "Chromium."),
        ("Plan siguiente 24h",
            "Gonza Morales: tests unitarios de las fórmulas (mediana, P95) + casos de borde. Santiago "
            "Flores: pulido visual (tooltips, responsive en móvil) + lazy load definitivo. Cortez "
            "Zamora: refinar UI del DateRangePicker + ensayar la demo del CSV en pantalla compartida."),
        ("Impedimentos",
            "Detectado bug en la mediana cuando hay solo 1 solicitud resuelta (PostgreSQL retorna NULL "
            "en PERCENTILE_CONT con n=1). Se corrige con COALESCE y se añade al set de tests de borde."),
        ("Ajuste Sprint Backlog",
            "Sin cambios de alcance. Se decide mostrar 'Sin datos suficientes' en la tarjeta cuando el "
            "P95 no se puede calcular (n < 5)."),
    ], styles))

    s.append(Paragraph("Daily Scrum — Día 3 (Miércoles)", styles["H2"]))
    s.append(info_table([
        ("DÍA", "Miércoles — Día 3"),
        ("Progreso hacia el objetivo",
            "Tests unitarios de fórmulas en verde (incluye los 4 casos de borde acordados). Lazy load "
            "de Recharts verificado en DevTools: el chunk inicial de /admin no creció (Recharts solo "
            "se descarga al abrir /admin/metricas). Tooltips activos en las gráficas mostrando "
            "valores exactos. Responsive: en móvil las gráficas se apilan verticalmente con scroll "
            "horizontal en la de líneas. CSV ensayado en 3 clientes (Excel/Sheets/LibreOffice). "
            "Playwright E2E corre en CI en menos de 25 s."),
        ("Plan siguiente 24h",
            "Gonza Morales: guión de la Review con escenarios concretos (filtro 'Último mes', filtro "
            "'Últimos 3 meses'). Santiago Flores: capturas de las gráficas como referencia para el "
            "dashboard ejecutivo del Sprint 14. Cortez Zamora: doc /docs/metricas.md con las fórmulas "
            "y el CSV documentado."),
        ("Impedimentos",
            "La Sra. Rosa Díaz (que asistirá a la Review como observadora) pidió ver también una vista "
            "filtrada por mes. Ya está cubierto por el DateRangePicker — no requiere desarrollo extra."),
        ("Ajuste Sprint Backlog",
            "Sin cambios. La feature ya cubre el pedido de la observadora."),
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
        ("Sprint", "Sprint 7 — Semana 9"),
        ("Fecha", "Viernes — cierre de semana 9"),
        ("Duración", "55 minutos"),
        ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
        ("Scrum Team",
            "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
            "Gonza Morales Yoel, Santiago Flores Carlos"),
        ("Stakeholders",
            "Carlos Fuentes (Admin — usuario directo del nuevo dashboard), Sra. Rosa Díaz (Dueña del "
            "edificio — semilla del dashboard ejecutivo del S14), Profesor del curso"),
        ("Incremento presentado",
            "Vista /admin/metricas con KPIs en vivo + 3 gráficas Recharts (barras por tipo, líneas de "
            "tiempo de resolución, top 5 categorías) + exportación CSV por rango + vista materializada "
            "refrescada cada hora + Playwright instalado con primer E2E como semilla."),
        ("Modalidad de demo",
            "Pantalla compartida del navegador con el panel del admin. Datos reales del seed (3 meses) "
            "para que las gráficas tengan información significativa."),
    ], styles))

    s.append(Paragraph("Guión de demostración", styles["H2"]))
    demo = [
        "Carlos Fuentes (admin) abre /admin/metricas. Aparecen 4 tarjetas con KPIs en vivo: total de "
        "solicitudes (102), pendientes (8), en proceso (5), resueltas hoy (3). Las tarjetas se "
        "refrescan automáticamente cada 60 s.",
        "Debajo, la gráfica de barras horizontales muestra el conteo por tipo: Mantenimiento (45), "
        "Reparación (32), Queja (15), Sugerencia (7), Otro (3). Al pasar el cursor sobre cada barra "
        "el tooltip muestra el valor exacto.",
        "La gráfica de líneas muestra la tendencia de tiempo de resolución mensual (promedio y "
        "mediana) en los últimos 3 meses. Tooltip al hover con valores en minutos.",
        "Top 5 categorías: Plomería, Electricidad, Limpieza, Áreas comunes, Seguridad — con barras "
        "de proporción.",
        "Carlos selecciona en el DateRangePicker 'Últimos 30 días' y hace clic en 'Exportar CSV'. Se "
        "descarga solicitudes_2026-04-26_2026-05-26.csv. Lo abre en Excel: cabeceras en español, "
        "acentos correctos (BOM UTF-8), fechas en formato ISO.",
        "Demostración del refresh de la vista materializada: en /admin/metricas se muestra el "
        "timestamp 'Datos actualizados hace 12 min' (calculado contra la última corrida del cron).",
        "La Sra. Rosa Díaz pregunta 'Y si quiero ver todo junto: mantenimiento, facturación, tienda…' "
        "→ se le muestra el roadmap actualizado y se le anticipa que el Sprint 14 le entregará un "
        "dashboard ejecutivo consolidado.",
        "Chore técnico: el equipo abre GitHub y muestra el workflow de e2e.yml en verde con el spec "
        "de crear-solicitud (semilla de la suite). 'A partir del S8 cada sprint añade un E2E al "
        "módulo nuevo, sin volverse protagonista.'",
    ]
    for i, step in enumerate(demo, start=1):
        s.append(Paragraph(f"<b>{i}.</b> {step}", styles["BodyLeft"]))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Revisión del Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "✓ <b>CUMPLIDO:</b> dashboard visual del admin operativo con 3 gráficas y datos en vivo · "
            "exportación CSV correcta en 3 clientes de oficina · vista materializada refrescada cada "
            "hora · Playwright instalado con 1 E2E como semilla. <b>DoD v2 al 89%</b> (8/9 — el "
            "criterio 'verificación post-deploy' se completa en S9 con el chore de /health). "
            "El Sprint cerró sin usar el buffer de 2 horas.",
        styles,
    ))
    s.append(Spacer(1, 6))

    s.append(Paragraph("Feedback de stakeholders", styles["H2"]))

    s.append(Paragraph("Carlos Fuentes (Administrador)", styles["H3"]))
    for bullet in [
        '"El dashboard es exactamente lo que necesitaba: en un vistazo veo si la semana está cargada y '
        'qué categoría se repite más." → Validación.',
        '"¿Puedo filtrar las gráficas por categoría además de por tipo?" → <b>PBI-S7-E01</b>: '
        "'Filtros por categoría en el dashboard de métricas'. P2, 1h. Sprint 13.",
        '"El CSV con UTF-8 BOM es un detalle pequeño pero salva el día — antes los acentos salían rotos en Excel." → Validación.',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Sra. Rosa Díaz (Dueña del edificio — observadora)", styles["H3"]))
    for bullet in [
        '"Esto es lo que yo necesito para tomar decisiones. ¿Puedo verlo yo también, sin tener que ser '
        'administradora del sistema?" → Validación + semilla del Sprint 14 (dashboard ejecutivo con '
        'rol observador).',
        '"Cuando vea los ingresos por facturación y por tienda al lado de esto, voy a poder negociar '
        'mejor con el proveedor de mantenimiento." → Validación del enfoque del S14.',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Spacer(1, 6))

    s.append(Paragraph("Decisiones de adaptación del Product Backlog", styles["H2"]))
    dec_review_header = ["Decisión", "Detalle"]
    dec_review_rows = [
        ["Cero hotfixes", "Tercer Sprint consecutivo sin hotfixes — la práctica de Refinement previo al Planning ya es del proceso."],
        ["PBI-S7-E01 (NUEVA)", "Filtros por categoría en el dashboard de métricas (feedback Carlos) — P2, 1h, Sprint 13 (junto con el panel integral del residente)."],
        ["Sprint 14 confirmado", "El dashboard ejecutivo del dueño del edificio queda confirmado como broche del curso (la observadora Rosa Díaz validó la dirección)."],
        ["Sprint 8 confirmado", "Facturación v1: HU-FACT-01 a 03 + HU-FACT-05 (notificación al residente) + chore técnico E2E de facturación + deploy del módulo."],
        ["E2E como inversión continua", "Confirmado: cada Sprint funcional añade 1 E2E del módulo nuevo como chore (1.5–2h). Sin sprint dedicado a E2E."],
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
        ("Sprint", "Sprint 7 — Semana 9"),
        ("Fecha", "Viernes — después de la Sprint Review"),
        ("Duración", "30 minutos"),
        ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
        ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
    ], styles))

    s.append(Paragraph("✓ ¿Qué salió bien?", styles["H2"]))
    for line in [
        "El cambio de enfoque del roadmap (módulos funcionales con técnica intercalada) se sintió "
        "natural desde el Planning. La demo tuvo un entregable visual fuerte por primera vez en "
        "varios sprints; los stakeholders lo notaron en la Review.",
        "Recharts se integró rápido (≈ 3 h reales) y con lazy load no afectó el bundle inicial. "
        "La paleta Zity se aplicó de forma consistente entre gráficas.",
        "La vista materializada + cron pg_cron resuelve la performance del panel de un solo golpe: "
        "queries de KPIs en ~20 ms vs ~600 ms sin la vista.",
        "Playwright como chore de 1 h cumplió: instalado, workflow en verde, 1 E2E sirviendo de "
        "semilla. Sin presión sobre los PBIs funcionales del Sprint.",
        "El test del bug de la mediana con n=1 (PostgreSQL retorna NULL) se descubrió en Día 2 — "
        "antes de la Review — gracias a los tests de borde de las fórmulas.",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("✗ ¿Qué salió mal?", styles["H2"]))
    for line in [
        "Tuvimos que enriquecer el seed con 3 meses de datos históricos en el Día 1 — no se "
        "previó en el Planning. Si bien fue rápido, marca un patrón: cada módulo nuevo necesita "
        "su propio seed representativo para que la demo se vea real.",
        "pg_cron no estaba habilitado en Supabase por defecto; tuvimos que activarlo manualmente "
        "desde el panel. No es por migración, así que no hay forma de que la próxima persona que "
        "monte el proyecto lo asuma; lo documentamos en /docs/setup.md pero es deuda de DX.",
        "El refresh automático cada 60 s del panel /admin/metricas vuelve a llamar al RPC aunque "
        "el panel esté en background — gasta cuota de Supabase sin valor. Falta pausar el refresh "
        "cuando el tab no está activo.",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("Acciones de mejora (máx. 3)", styles["H2"]))
    actions = [
        ("Acción 1 — Seed representativo por módulo",
         "Cada Sprint que entregue un módulo nuevo (Facturación, Tienda, etc.) añadirá al seed un "
         "comando dedicado (--facturacion, --tienda) que cargue datos representativos de los últimos "
         "3 meses. Sin esto, las demos pierden fuerza. Se documenta como parte del DoR de los "
         "nuevos módulos.",
         "Gonza Morales Yoel",
         "Cada Sprint Planning lista un comando de seed nuevo cuando el módulo lo requiere",
         "Sprint 8"),
        ("Acción 2 — Pausar refresh cuando el tab está en background",
         "Usar document.visibilityState en el componente /admin/metricas: si el tab pasa a "
         "'hidden', se pausa el polling de 60 s; al volver a 'visible', se hace un refresh "
         "inmediato y se reanuda el polling. Ahorra cuota de Supabase y mejora batería en móvil.",
         "Santiago Flores Carlos",
         "PR mergeado con uso de document.visibilityState en MetricasContext",
         "Sprint 8"),
        ("Acción 3 — Documentar setup de extensiones Postgres",
         "Crear /docs/setup-supabase.md que liste todas las extensiones que hay que habilitar "
         "manualmente (pg_cron, ahora; potencialmente otras en sprints futuros). Si en el S14 "
         "alguien clona el repo, debe poder activar todo en 5 minutos.",
         "Cortez Zamora Leonardo",
         "/docs/setup-supabase.md con lista de extensiones y pasos de activación",
         "Sprint 8"),
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
        ["Pruebas de integración para flujos críticos (RPC metricas_solicitudes, export CSV)", Paragraph("✓ CUMPLIDO — 5 tests integración nuevos", styles["OkLabel"])],
        ["Cobertura ≥ 60% en módulos core (incluye fórmulas de KPIs)", Paragraph("✓ CUMPLIDO — 71% en src/lib/metricas.ts", styles["OkLabel"])],
        ["Endpoint /health disponible en staging", Paragraph("■ Pendiente — planificado como chore del Sprint 9", styles["WarnLabel"])],
        ["Variables de entorno via Secrets CI/CD — sin hardcode", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Despliegue staging con verificación post-deploy", Paragraph("■ Pendiente — planificado como chore del Sprint 9-10", styles["WarnLabel"])],
        ["tsc --noEmit pasa sin errores en CI", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Playwright instalado + al menos 1 E2E en pipeline", Paragraph("✓ CUMPLIDO — chore técnico entregado", styles["OkLabel"])],
        ["ADR-006 documentado (Recharts vs SVG nativo)", Paragraph("✓ CUMPLIDO — adicional a DoD v2", styles["OkLabel"])],
    ]
    s.append(grid_table(dod_header, dod_rows, [4.6 * inch, 2.0 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "<b>DoD v2 al 89%</b> (8/9 — el único pendiente es /health + verificación post-deploy, que "
            "se completa como chore del Sprint 9). Sprint 7 cerrado sin usar el buffer de 2 horas. "
            "El cambio de enfoque del roadmap entregó su primer Sprint con éxito: demo visual fuerte, "
            "deuda técnica bajo control y stakeholders satisfechos.",
        styles,
    ))
    s.append(PageBreak())

    # ── 5. HISTORIAS DE USUARIO ────────────────────────────────────────────
    s.append(section_banner("5   HISTORIAS DE USUARIO — SPRINT 7", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Módulo MÉTRICAS / DASHBOARD — Sprint 7", styles["H2"]))

    s.append(hu_card(
        "PBI-22 · Panel de métricas /admin/metricas",
        "Tarjetas KPIs en vivo + refresh automático",
        "Sprint 7 · 5 h", "P1 · 5 h",
        "Como <b>administrador</b>, quiero <b>un panel /admin/metricas con los KPIs operativos del "
        "mantenimiento (totales, por estado, por tipo, tiempo promedio de resolución)</b>, para "
        "entender el volumen y la eficiencia del módulo de un vistazo.",
        [
            "Vista /admin/metricas con 4 tarjetas KPI: total acumulado, pendientes, en proceso, resueltas hoy.",
            "Las tarjetas se refrescan automáticamente cada 60 s mientras el tab está activo (pausa cuando va a background — acción 2 del Retro).",
            "Tiempo promedio de resolución: se reportan AVG, mediana y P95. Mediana protege contra outliers.",
            "Casos de borde manejados: conjuntos vacíos, n=1, P95 sin datos suficientes muestran 'Sin datos suficientes'.",
            "Solo accesible para rol admin (guarda + RLS verifica el RPC).",
            "Tests unitarios de las fórmulas con 4 casos de borde (vacío, n=1, n=2, outliers).",
        ],
        "Demostrado en Sprint 7 Review: Carlos abre el panel y ve 102 solicitudes totales con el desglose, refrescándose cada 60 s.",
        styles,
    ))

    s.append(hu_card(
        "HU-KPI-01 · Gráficas Recharts en el dashboard",
        "Barras por tipo + líneas tiempo resolución + top 5 categorías",
        "Sprint 7 · 3 h", "P1 · 3 h",
        "Como <b>administrador</b>, quiero <b>gráficas visuales de barras y líneas en el dashboard</b>, "
        "para identificar tendencias y categorías más frecuentes sin tener que leer tablas.",
        [
            "Gráfica de barras horizontales con conteo por tipo de solicitud (Recharts BarChart).",
            "Gráfica de líneas con tendencia mensual del tiempo de resolución (promedio y mediana, Recharts LineChart).",
            "Top 5 categorías como lista visual con barras de proporción.",
            "Paleta de colores Zity (azul Oxford + neutros) aplicada de forma consistente.",
            "Lazy load (React.lazy + Suspense): Recharts solo se descarga al abrir /admin/metricas, no infla el bundle inicial.",
            "Responsiva: en móvil las gráficas se apilan verticalmente con scroll horizontal en la de líneas.",
            "Tooltips activos al hover mostrando los valores exactos.",
        ],
        "Validada por Carlos en la Review; la calidad visual del dashboard fue destacada en el feedback de los asistentes.",
        styles,
    ))

    s.append(hu_card(
        "PBI-17 · Exportar solicitudes a CSV",
        "Selector de rango + descarga UTF-8 BOM compatible con Excel",
        "Sprint 7 · 2 h", "P2 · 2 h",
        "Como <b>administrador</b>, quiero <b>exportar las solicitudes de un rango de fechas a CSV</b>, "
        "para llevar registros externos o procesar los datos en Excel/Sheets sin acceder a la BD.",
        [
            "Botón 'Exportar CSV' en /admin con popover de DateRangePicker (reusa componente del S5).",
            "Generación server-side con pg COPY a buffer (RPC export_solicitudes_csv); rápido incluso con muchas filas.",
            "Codificación UTF-8 con BOM para que Excel reconozca los acentos sin pasos manuales.",
            "Cabecera en español; fechas en ISO-8601 (YYYY-MM-DD HH:MM); separador coma.",
            "Solo rol admin (RLS bloquea el RPC para residente y técnico).",
            "Nombre del archivo: solicitudes_<desde>_<hasta>.csv.",
            "Validado abriendo el CSV en Excel, Google Sheets y LibreOffice antes de la Review.",
        ],
        "Carlos descargó en la Review el CSV del último mes y lo abrió en Excel sin un solo paso manual.",
        styles,
    ))

    s.append(hu_card(
        "Refactor · Vista materializada vw_metricas_solicitudes",
        "Performance del panel + refresh cada hora con pg_cron",
        "Sprint 7 · 2 h", "P2 · 2 h",
        "Como <b>sistema</b>, quiero <b>una vista materializada con los KPIs agregados refrescada "
        "cada hora</b>, para que el panel /admin/metricas responda en milisegundos sin recalcular "
        "agregados pesados en cada apertura.",
        [
            "Migración 008 crea vw_metricas_solicitudes con: total, conteo por estado, conteo por tipo, AVG/MEDIAN/P95 de tiempo de resolución, top 5 categorías.",
            "Índices sobre las columnas de agrupación para soportar REFRESH MATERIALIZED VIEW CONCURRENTLY.",
            "Cron pg_cron diario que ejecuta REFRESH cada hora (extensión habilitada manualmente en Supabase; documentado).",
            "Fallback: si la vista tiene más de 1 hora de antigüedad, se dispara un refresh on-demand al abrir /admin/metricas.",
            "Performance: queries del panel pasan de ~600 ms (calculadas en vivo) a ~20 ms (sirviendo la vista).",
        ],
        "Antes 600 ms / Después 20 ms (medido en staging con 60 solicitudes del seed). pg_cron refrescando cada hora.",
        styles,
    ))

    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "<b>Chore técnico del Sprint:</b> Instalación de Playwright (npm + binarios) + workflow "
        ".github/workflows/e2e.yml mínimo (solo Chromium) + 1 E2E del flujo crear-solicitud "
        "(semilla de la suite) + ADR-006 documentado. <b>1 h</b>, P3. Sin protagonismo: la suite "
        "crece como chore en cada Sprint funcional (1 E2E por módulo nuevo: S8 facturación, S10 "
        "tienda, etc.).",
        styles["Body"],
    ))
    s.append(Spacer(1, 6))

    s.append(Paragraph("PBIs emergentes — entran en Sprints futuros", styles["H2"]))
    em_header = ["ID", "Historia", "Prior.", "Horas est.", "Sprint"]
    em_rows = [
        ["PBI-S6-E03", "Mostrar sesiones activas + cerrar todas al cambiar contraseña", Paragraph("● P2", styles["WarnLabel"]), "2 h", "13"],
        ["PBI-S6-E01", "Indicador de presencia (Supabase Presence) en panel admin", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S6-E02", "Sonido + haptic feedback opcional al recibir notificación", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S6-E04", "Resumen diario por email a técnicos con asignaciones pendientes", Paragraph("● P3", styles["OkLabel"]), "2 h", "Sin asignar"],
        ["PBI-S7-E01", "Filtros por categoría en el dashboard de métricas (feedback Carlos S7)", Paragraph("● P2", styles["WarnLabel"]), "1 h", "13"],
    ]
    s.append(grid_table(em_header, em_rows, [1.1 * inch, 3.0 * inch, 0.7 * inch, 0.8 * inch, 0.7 * inch], styles))
    s.append(PageBreak())

    # ── 6. ESTADO DEL BACKLOG ──────────────────────────────────────────────
    s.append(section_banner("6   ESTADO DEL BACKLOG TRAS SPRINT 7", styles))
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
        ["Sprint 6", "13 h", "Comunicación Realtime: notificaciones + email + foto cierre antes/después + alerta admin", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 7", "13 h", "★ Métricas y Dashboard visual: KPIs + gráficas Recharts + CSV + vista materializada + chore Playwright (semilla E2E)", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 8", "13 h (est.)", "Facturación v1: BD + admin emite (manual/lote) + residente ve facturas + notificación Realtime", Paragraph("→ Próximo", styles["WarnLabel"])],
        ["Sprints 9–14", "78 h (est.)", "Facturación v2 · Tienda v1/v2 · Notificaciones avanzadas · Panel residente · ★ Dashboard ejecutivo del dueño + RC", Paragraph("■ Planificado", styles["WarnLabel"])],
    ]
    s.append(grid_table(progress_header, progress_rows, [0.85 * inch, 0.95 * inch, 3.8 * inch, 1.0 * inch], styles))
    s.append(Paragraph(
        "<b>Total invertido:</b> 106 horas en 8 sprints (Sprint 0 → Sprint 7).<br/>"
        "<b>Total restante:</b> 91 horas estimadas en 7 sprints.<br/>"
        "<b>Velocidad promedio:</b> 13.25 horas/sprint (estable por quinto sprint consecutivo).",
        styles["Body"],
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Roadmap actualizado tras Sprint 7 Review", styles["H2"]))
    rm_header = ["Sprint", "Sem.", "Objetivo principal — Entregable funcional"]
    rm_rows = [
        ["S8", "10", "Facturación v1: admin emite facturas (manual + lote) + residente ve con desglose + notificación Realtime"],
        ["S9", "11", "Facturación v2: marcar pagada + recordatorios automáticos + estado 'vencida' + PDF de comprobante"],
        ["S10", "12", "Tienda interna v1: admin gestiona catálogo (stock/precio + foto) + residente navega con filtros y búsqueda"],
        ["S11", "13", "Tienda interna v2: carrito + descuento atómico de stock + pedido se suma a la factura mensual"],
        ["S12", "14", "Notificaciones avanzadas: Web Push + presencia (Supabase Presence) + sonido/haptic + preferencias"],
        ["S13", "15", "Panel integral del residente: tarjetas Solicitudes + Facturas + Pedidos en una sola vista + sesiones activas"],
        ["S14", "16", "★ Dashboard ejecutivo del dueño del edificio (mantenimiento + finanzas + tienda) + Release Candidate + demo final"],
    ]
    s.append(grid_table(rm_header, rm_rows, [0.55 * inch, 0.5 * inch, 5.7 * inch], styles))
    s.append(Paragraph(
        "Nota de adaptación del roadmap: el Sprint 7 inauguró con éxito el nuevo enfoque funcional. "
        "La parte técnica (Playwright como semilla) se entregó como chore de 1 h sin afectar el "
        "Sprint Goal. El patrón se replica en los próximos sprints.",
        styles["Note"],
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Vista previa Sprint 8 — Facturación v1", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "Sprint 8: el admin emite facturas mensuales por tipo (luz/agua/pensión/multas) — "
            "manualmente o por lote 'emitir a todos' — y cada residente las ve en su panel con "
            "desglose y estado. Se reusa el sistema de notificaciones Realtime del S6 para avisar "
            "al residente cuando se le emite una factura nueva.",
        styles,
    ))
    preview_header = ["PBI", "Historia", "Horas est.", "Prior."]
    preview_rows = [
        ["HU-FACT-01", "Modelado BD: tabla facturas (tipos, monto, vencimiento, estado) + RLS", "2 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-FACT-02", "Admin emite factura: formulario individual + acción 'Emitir a todos' (lote)", "3 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-FACT-03", "Residente ve facturas (pendientes/pagadas/vencidas) con desglose por tipo", "3 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-FACT-05", "Notificación Realtime al residente cuando se emite su factura (reusa S6)", "2 h", Paragraph("● P2", styles["WarnLabel"])],
        ["Chore-T", "E2E del flujo 'admin emite → residente ve' + deploy del módulo a staging", "1.5 h", Paragraph("● P2", styles["WarnLabel"])],
        ["Buffer", "Reservado para imprevistos del modelado BD", "1.5 h", Paragraph("● —", styles["WarnLabel"])],
    ]
    s.append(grid_table(preview_header, preview_rows, [1.1 * inch, 3.9 * inch, 0.8 * inch, 0.8 * inch], styles))
    s.append(Paragraph("<b>Total estimado Sprint 8:</b> 13 horas (1.5 h de buffer).", styles["Body"]))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Variables de entorno acumuladas al Sprint 7", styles["H2"]))
    s.append(Paragraph(
        "No hay variables nuevas en este Sprint. Sí se habilitó la extensión <b>pg_cron</b> en "
        "Supabase manualmente (documentado en /docs/setup-supabase.md). Las variables anteriores "
        "siguen vigentes.",
        styles["Body"],
    ))
    env_header = ["Variable", "Descripción", "Dónde se usa", "Desde Sprint"]
    env_rows = [
        ["VITE_SUPABASE_URL", "URL pública del proyecto Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["VITE_SUPABASE_ANON_KEY", "Clave anónima de Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["SUPABASE_SERVICE_ROLE_KEY", "Clave de servicio (admin) de Supabase", "Edge Functions (servidor)", "Sprint 3"],
        ["RESEND_API_KEY", "Clave de API de Resend para emails", "Edge Functions (servidor)", "Sprint 2"],
        ["RESEND_FROM_ADDRESS", "Remitente del email de cambio de estado", "Edge Function notificar-cambio-estado", "Sprint 6"],
        ["SUPABASE_DB_URL", "URL de conexión directa a la BD", "Migraciones locales", "Sprint 0"],
    ]
    s.append(grid_table(env_header, env_rows, [1.9 * inch, 2.4 * inch, 1.6 * inch, 0.7 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(Paragraph(
        "Variables proyectadas para futuros Sprints (en línea con el roadmap reformulado):<br/>"
        "• Sprint 10 (CD): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID para el deploy automático en merge a main.<br/>"
        "• Sprint 12 (Push): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY para Web Push.",
        styles["Body"],
    ))
    s.append(Paragraph(
        "Ninguna de estas variables debe aparecer en el código fuente ni en commits. "
        "Todas van en .env.local (local) y en Secrets de GitHub/Vercel (CI/CD).",
        styles["Note"],
    ))

    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "— Zity · Artefactos Sprint 7 · Documento vivo — actualizar en cada Sprint Review —",
        styles["Footer"],
    ))

    return s


# ─── Entry point ──────────────────────────────────────────────────────────────


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "sprints")
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "Zity_Sprint7_Artefactos.pdf")

    styles = build_styles()
    doc = make_doc(out_path)
    story = build_story(styles)
    doc.build(story)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Generado: {out_path}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
