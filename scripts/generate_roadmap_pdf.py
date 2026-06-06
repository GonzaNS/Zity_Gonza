"""
Genera el PDF del Roadmap de Sprints reformulado (Zity).
Versión: enfoque funcional — cada Sprint cierra con un entregable visual y
demostrable en la Sprint Review. La parte técnica (tests, deploy, seguridad) se
intercala como chore pequeño en cada Sprint, sin protagonismo.

Estilo visual idéntico al de los artefactos de Sprint:
cabecera azul con título centrado, tablas tipo zebra,
secciones numeradas con banda de color, footer con número de página.

Uso:
    python scripts/generate_roadmap_pdf.py

Salida:
    docs/sprints/Zity_Roadmap_Sprints.pdf
"""

from __future__ import annotations

import os
import shutil
from typing import Sequence

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
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

    styles["TitleCover"] = ParagraphStyle(
        "TitleCover", parent=base["Heading1"], fontName="Helvetica-Bold",
        fontSize=46, leading=52, alignment=TA_CENTER, textColor=ZITY_BLUE_DARK,
        spaceAfter=4,
    )
    styles["SubtitleCover"] = ParagraphStyle(
        "SubtitleCover", parent=base["Heading2"], fontName="Helvetica",
        fontSize=18, leading=24, alignment=TA_CENTER, textColor=ZITY_BLUE,
        spaceAfter=6,
    )
    styles["TaglineCover"] = ParagraphStyle(
        "TaglineCover", parent=base["Italic"], fontName="Helvetica-Oblique",
        fontSize=11, leading=16, alignment=TA_CENTER, textColor=ZITY_TEXT_MUTED,
        spaceAfter=26,
    )
    styles["SectionBanner"] = ParagraphStyle(
        "SectionBanner", fontName="Helvetica-Bold", fontSize=13.5, leading=18,
        textColor=colors.white, spaceBefore=0, spaceAfter=0, leftIndent=4,
        letterSpace=0.5,
    )
    styles["H2"] = ParagraphStyle(
        "H2", parent=base["Heading2"], fontName="Helvetica-Bold",
        fontSize=13, leading=18, textColor=ZITY_BLUE_DARK,
        spaceBefore=16, spaceAfter=8,
    )
    styles["H3"] = ParagraphStyle(
        "H3", parent=base["Heading3"], fontName="Helvetica-Bold",
        fontSize=11, leading=15, textColor=ZITY_BLUE,
        spaceBefore=12, spaceAfter=4,
    )
    styles["Body"] = ParagraphStyle(
        "Body", parent=base["BodyText"], fontName="Helvetica",
        fontSize=10, leading=15, textColor=ZITY_TEXT,
        spaceAfter=6, alignment=TA_JUSTIFY,
    )
    styles["BodyLeft"] = ParagraphStyle(
        "BodyLeft", parent=styles["Body"], alignment=TA_LEFT, spaceAfter=6,
    )
    styles["Cell"] = ParagraphStyle(
        "Cell", fontName="Helvetica", fontSize=9, leading=13,
        textColor=ZITY_TEXT, alignment=TA_LEFT,
    )
    styles["CellBold"] = ParagraphStyle(
        "CellBold", parent=styles["Cell"], fontName="Helvetica-Bold",
        textColor=ZITY_BLUE_DARK,
    )
    styles["CellHeader"] = ParagraphStyle(
        "CellHeader", fontName="Helvetica-Bold", fontSize=9, leading=12,
        textColor=colors.white, alignment=TA_LEFT, letterSpace=0.3,
    )
    styles["CellLabel"] = ParagraphStyle(
        "CellLabel", fontName="Helvetica-Bold", fontSize=9, leading=13,
        textColor=ZITY_BLUE_DARK, alignment=TA_LEFT, letterSpace=0.2,
    )
    styles["Quote"] = ParagraphStyle(
        "Quote", parent=styles["Body"], fontName="Helvetica-BoldOblique",
        fontSize=10.5, leading=16, alignment=TA_CENTER,
        textColor=ZITY_BLUE_DARK, spaceBefore=0, spaceAfter=0,
    )
    styles["Note"] = ParagraphStyle(
        "Note", parent=base["Italic"], fontName="Helvetica-Oblique",
        fontSize=9, leading=13, textColor=ZITY_TEXT_MUTED,
        spaceBefore=2, spaceAfter=10,
    )
    styles["Footer"] = ParagraphStyle(
        "Footer", fontName="Helvetica-Oblique", fontSize=8.5, leading=11,
        textColor=ZITY_TEXT_MUTED, alignment=TA_CENTER,
    )
    styles["OkLabel"] = ParagraphStyle(
        "OkLabel", parent=styles["Cell"], fontName="Helvetica-Bold",
        textColor=ZITY_OK,
    )
    styles["WarnLabel"] = ParagraphStyle(
        "WarnLabel", parent=styles["Cell"], fontName="Helvetica-Bold",
        textColor=ZITY_WARN,
    )
    styles["FailLabel"] = ParagraphStyle(
        "FailLabel", parent=styles["Cell"], fontName="Helvetica-Bold",
        textColor=ZITY_FAIL,
    )
    return styles


# ─── Helpers de tabla ─────────────────────────────────────────────────────────


def info_table(rows: Sequence[tuple[str, str]], styles: dict[str, ParagraphStyle]) -> Table:
    data = [
        [Paragraph(label, styles["CellLabel"]), Paragraph(value, styles["Cell"])]
        for label, value in rows
    ]
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


# ─── Plantilla con cabecera/pie ───────────────────────────────────────────────


def make_doc(path):
    doc = BaseDocTemplate(
        path, pagesize=LETTER,
        leftMargin=LEFT_MARGIN, rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN, bottomMargin=BOTTOM_MARGIN,
        title="Zity · Roadmap de Sprints — Enfoque funcional",
        author="Equipo Zity",
        subject="Roadmap reformulado · cada Sprint cierra con un entregable funcional y visual",
        keywords="zity, roadmap, scrum, sprints, dashboard, facturacion, tienda, demo",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height,
                  id="main", showBoundary=0)

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
        canvas.drawString(LEFT_MARGIN + 0.32 * inch, 0.4 * inch,
                          "· Roadmap de Sprints · Enfoque funcional")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawRightString(PAGE_W - RIGHT_MARGIN, 0.4 * inch,
                               f"pág. {doc_.page}")
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=on_page)])
    return doc


# ─── Helper para detalle por Sprint ───────────────────────────────────────────


def sprint_detail(
    titulo: str,
    semana: str,
    sprint_goal: str,
    demo: str,
    pbis: Sequence[tuple[str, str, str, str]],
    entregables: Sequence[str],
    chore_tecnico: str,
    dod: str,
    notas: str,
    styles: dict[str, ParagraphStyle],
) -> list:
    """
    Bloque visual del detalle de un Sprint. Devuelve una lista de flowables.
    pbis: tuplas (id, descripcion, prioridad, horas)
    """
    items: list = []
    items.append(Paragraph(titulo, styles["H2"]))
    items.append(quote_box(f'"{sprint_goal}"', styles))
    items.append(Spacer(1, 6))
    items.append(
        info_table(
            [
                ("Semana", semana),
                ("Demo del Sprint", demo),
                ("DoD aplicable", dod),
                ("Chore técnico", chore_tecnico),
            ],
            styles,
        )
    )
    items.append(Spacer(1, 6))
    items.append(Paragraph("PBIs candidatos", styles["H3"]))
    pbi_header = ["ID", "Historia / Tarea", "Prioridad", "Horas est."]
    pbi_rows = []
    for code, desc, prio, horas in pbis:
        if prio.startswith("P1"):
            prio_style = styles["FailLabel"]
        elif prio.startswith("P2"):
            prio_style = styles["WarnLabel"]
        else:
            prio_style = styles["OkLabel"]
        pbi_rows.append([code, desc, Paragraph(f"● {prio}", prio_style), horas])
    items.append(grid_table(
        pbi_header, pbi_rows,
        [1.05 * inch, 4.0 * inch, 0.85 * inch, 0.85 * inch], styles,
    ))
    items.append(Spacer(1, 6))
    items.append(Paragraph("Entregables verificables", styles["H3"]))
    for e in entregables:
        items.append(Paragraph(f"☐ &nbsp; {e}", styles["BodyLeft"]))
    if notas:
        items.append(Paragraph(f"<b>Notas:</b> {notas}", styles["Note"]))
    items.append(Spacer(1, 8))
    return items


# ─── Contenido ────────────────────────────────────────────────────────────────


def build_story(styles: dict[str, ParagraphStyle]) -> list:
    s: list = []

    # ── Portada ────────────────────────────────────────────────────────────
    s.append(Spacer(1, 20))
    s.append(Paragraph("Zity", styles["TitleCover"]))
    s.append(Spacer(1, 4))
    s.append(_separador_decorativo())
    s.append(Spacer(1, 12))
    s.append(Paragraph("Roadmap de Sprints — Semanas 6 a 16", styles["SubtitleCover"]))
    s.append(Paragraph(
        "Enfoque funcional · Cada Sprint cierra con un entregable visual y demostrable en la Sprint Review · "
        "La parte técnica (tests, deploy, seguridad) se intercala como chore en cada Sprint, sin protagonismo.",
        styles["TaglineCover"],
    ))
    s.append(Spacer(1, 16))
    s.append(info_table(
        [
            ("Producto", "Zity"),
            ("Alcance del documento", "Sprints 4 al 14 · Semanas 6 a 16 (planificación general)"),
            ("Stack", "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                      "Resend · Vercel · GitHub Actions · Vitest · Playwright (chore desde S7) · Recharts (S7)"),
            ("Product Owner", "Alvarez Rocca Jaqueline"),
            ("Scrum Master", "Meza Pelaez Carlos"),
            ("Developers", "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · Santiago Flores Carlos Steven"),
            ("Capacidad por Sprint", "15 horas/semana (3 h/día × 5 integrantes) · Velocidad observada: 13.2 h/sprint"),
            ("Estado actual", "Sprint 6 cerrado (Semana 8). Próximo: Sprint 7 — Semana 9 (Métricas y Dashboard visual)."),
            ("Filosofía del roadmap",
                "Cada Sprint cierra con un entregable funcional, visible y demostrable en la Sprint Review. "
                "Las tareas técnicas (tests E2E, deploy/CD, seguridad, privacidad, performance) NO ocupan "
                "sprints completos: cada sprint funcional incluye 1 chore técnico pequeño (≈ 1–2 h)."),
            ("Broche final",
                "Sprint 14 (Semana 16) reserva el ★ <b>Dashboard ejecutivo del dueño del edificio</b> "
                "(Sra. Rosa Díaz) — consolida mantenimiento + finanzas + tienda en gráficas — junto al "
                "Release Candidate y la demo final integral. Twilio 2FA queda fuera (no era visual)."),
            ("Nota Scrum",
                "Este roadmap es una proyección, no un compromiso. Cada Sprint Planning ajusta el "
                "alcance según el incremento del Sprint anterior y el feedback de la Sprint Review."),
        ],
        styles,
    ))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Documento vivo — se ajusta tras cada Sprint Review", styles["Footer"]))
    s.append(PageBreak())

    # ── 1. RESUMEN ─────────────────────────────────────────────────────────
    s.append(section_banner("1   RESUMEN DEL ROADMAP DE 16 SEMANAS", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "El proyecto Zity se ejecuta en 16 semanas dentro del curso de Ingeniería de Software con Scrum. "
        "La Semana 1 fue de introducción (sin Sprint formal); el trabajo técnico arrancó en la Semana 2 "
        "con el Sprint 0. Cada Sprint cierra con una demo presentable en la Sprint Review.",
        styles["Body"],
    ))
    s.append(Spacer(1, 6))
    res_header = ["Sprint", "Sem.", "Objetivo principal — Entregable visible del Sprint", "DoD", "Estado"]
    res_rows = [
        ["—", "1", "Introducción al curso (sin Sprint formal)", "—", Paragraph("✓ Hecha", styles["OkLabel"])],
        ["S0", "2", "Setup técnico: repo + CI + Supabase + ADRs base", "v1", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S1", "3", "Módulo Auth: registro 2 pasos + login por rol + recuperación", "v1", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S2", "4", "Panel admin + gestión de usuarios + bloqueo/desbloqueo", "v1", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S3", "5", "Mantenimiento v1: crear solicitud con foto + vista admin", "v1", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S4", "6", "Mantenimiento v2: asignación + vista técnico + cierre + cámara móvil + confirmación residente", "v2", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S5", "7", "Trazabilidad: audit log visible + historial completo + perfil editable + foto al rechazar", "v2", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S6", "8", "Comunicación Realtime: notificaciones en vivo + email + foto cierre antes/después + alerta admin", "v2", Paragraph("✓ Completado", styles["OkLabel"])],
        ["S7", "9", "★ Métricas y Dashboard visual: panel de KPIs con gráficas + exportación CSV", "v2", Paragraph("→ Próximo", styles["WarnLabel"])],
        ["S8", "10", "Facturación v1: admin emite (manual/lote) + residente ve facturas con desglose", "v2", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S9", "11", "Facturación v2: marcar pagada + recordatorios automáticos + estado 'vencida'", "v2", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S10", "12", "Tienda interna v1: admin gestiona catálogo + residente navega productos", "v2", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S11", "13", "Tienda interna v2: carrito + pedido se suma a la factura mensual", "v3", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S12", "14", "Comunicación: tablón de anuncios del edificio (admin publica → residente recibe en vivo)", "v3", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S13", "15", "Panel integral del residente: solicitudes + facturas + pedidos en una sola vista", "v3", Paragraph("■ Planificado", styles["WarnLabel"])],
        ["S14", "16", "★ Dashboard ejecutivo del dueño + Release Candidate + demo final integral", "v3", Paragraph("★ Broche final", styles["WarnLabel"])],
    ]
    s.append(grid_table(
        res_header, res_rows,
        [0.55 * inch, 0.5 * inch, 4.55 * inch, 0.4 * inch, 0.85 * inch], styles,
    ))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Notas clave del cronograma", styles["H3"]))
    for nota in [
        "<b>Semana 1 sin Sprint:</b> introducción al curso, presentación del equipo, definición del producto. No genera incremento técnico.",
        "<b>Setup en Semana 2:</b> el primer Sprint formal arrancó después de la Semana 1 de introducción. Por eso el cronograma usa 15 Sprints sobre 16 semanas.",
        "<b>Velocidad de referencia:</b> 13.2 h/sprint (promedio de Sprints 0–6). Sprints 7–14 mantienen 13 h trabajadas + 2 h de buffer.",
        "<b>Cambio de enfoque tras Sprint 6 Review:</b> antes el roadmap dedicaba Sprints completos a Calidad (S7), CD (S8), Privacidad (S11), Performance (S12) y Seguridad (S13). Tras el feedback del equipo se reformuló: cada Sprint es ahora un módulo funcional demostrable y la parte técnica se reparte como chore.",
        "<b>Transición DoD v1 → v2:</b> a partir del Sprint 4 (Semana 6) se exigen tests de integración y cobertura ≥ 60% en módulos core.",
        "<b>Transición DoD v2 → v3:</b> a partir del Sprint 11 (Semana 13) se exigen E2E mínimos en CI, no-PII en logs y entrega como release candidate.",
        "<b>★ Broche del Sprint 14:</b> el Dashboard ejecutivo del dueño del edificio (Sra. Rosa Díaz, stakeholder del PRD que aún no tuvo su feature) consolida en gráficas todo lo construido. Reemplaza a Twilio Verify del roadmap anterior por ser más visual y demostrable.",
    ]:
        s.append(Paragraph(f"• {nota}", styles["Body"]))
    s.append(PageBreak())

    # ── 2. DETALLE POR SPRINT ──────────────────────────────────────────────
    s.append(section_banner("2   DETALLE POR SPRINT — ENTREGABLES DEMOSTRABLES", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "Cada Sprint se planifica para producir un incremento visible y demostrable en la "
        "Sprint Review. La sección <b>Demo del Sprint</b> describe en concreto qué se "
        "presentará en la sesión de cierre. La parte técnica aparece como "
        "<b>Chore técnico</b> intercalado, con peso ≤ 2 h.",
        styles["Body"],
    ))
    s.append(Spacer(1, 8))

    # Sprint 7
    s.extend(sprint_detail(
        titulo="Sprint 7 — Semana 9 · Métricas y Dashboard visual",
        semana="Semana 9 (próximo)",
        sprint_goal="Que el admin abra su panel y vea de un vistazo el volumen, los tiempos promedio y "
                    "la distribución de las solicitudes en gráficas claras, y pueda exportar el rango "
                    "que necesite a CSV.",
        demo="Vista nueva /admin/metricas con gráficas de barras y líneas: la demo recorre el "
             "dashboard con datos reales del seed (volumen mensual de solicitudes, tiempo promedio "
             "de resolución, top categorías). Se exporta un CSV en vivo con el rango del último mes "
             "y se abre en Excel para verificar que los datos quedan formateados correctamente.",
        pbis=[
            ("PBI-22", "Panel de métricas (total, por estado, por tipo, tiempo promedio resolución)", "P1", "5 h"),
            ("HU-KPI-01", "Gráficas: barras por tipo + líneas de tiempo de resolución (Recharts)", "P1", "3 h"),
            ("PBI-17", "Exportar solicitudes a CSV por rango de fechas (solo admin)", "P2", "2 h"),
            ("Refactor", "Vista materializada Postgres vw_metricas_solicitudes para KPIs", "P2", "2 h"),
            ("Chore-T", "Instalar Playwright + 1 E2E 'crear solicitud' (semilla de la suite)", "P3", "1 h"),
        ],
        entregables=[
            "Botón 'Exportar CSV' funcional en el panel admin con selector de rango.",
            "Dashboard /admin/metricas con datos en vivo del último mes y gráficas Recharts.",
            "Vista materializada vw_metricas_solicitudes refrescada cada hora.",
            "Playwright instalado y 1 E2E pasando como gate en CI (semilla; la suite crece como chore en sprints siguientes).",
        ],
        chore_tecnico="Instalar Playwright + escribir el primer E2E (crear solicitud). 1 h. Sin protagonismo.",
        dod="DoD v2 — los KPIs incluyen tests unitarios para las fórmulas de cálculo.",
        notas="Recharts vs SVG nativo: se elige Recharts por velocidad de implementación (registrado en ADR-006). "
              "El chore de Playwright queda como semilla — los E2E de cada módulo nuevo entrarán como chore "
              "del sprint correspondiente.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 8
    s.extend(sprint_detail(
        titulo="Sprint 8 — Semana 10 · Facturación v1 (emisión y vista)",
        semana="Semana 10",
        sprint_goal="Lanzar el módulo de facturación: el admin emite facturas mensuales por tipo "
                    "(luz, agua, pensión, multas) — manualmente o en lote — y cada residente las ve "
                    "en su panel con desglose y estado (pendiente / pagada / vencida).",
        demo="Carlos (admin) abre /admin/facturacion, emite la factura del mes en lote para todos "
             "los residentes. Laura (residente) entra a su panel y ve sus facturas: pendientes con "
             "monto y fecha de vencimiento, pagadas históricas, y recibe una notificación Realtime "
             "en su campana avisando 'Tienes una factura nueva: $XX, vence el 30'.",
        pbis=[
            ("HU-FACT-01", "Modelado BD: tabla facturas (tipos, monto, vencimiento, estado) + RLS", "P1", "2 h"),
            ("HU-FACT-02", "Admin emite factura: formulario individual + acción 'Emitir a todos' (lote)", "P1", "3 h"),
            ("HU-FACT-03", "Residente ve sus facturas (pendientes/pagadas/vencidas) con desglose por tipo", "P1", "3 h"),
            ("HU-FACT-05", "Notificación Realtime al residente cuando se emite su factura (reusa S6)", "P2", "2 h"),
            ("Chore-T", "E2E del flujo 'admin emite → residente ve' + deploy del módulo a staging", "P2", "1.5 h"),
        ],
        entregables=[
            "Tabla facturas operativa + RLS verificada (residente solo ve las suyas).",
            "Vista /admin/facturacion con emisión manual y acción 'Emitir a todos' por mes.",
            "Vista /residente/facturas con desglose por tipo, fechas y estados.",
            "1 E2E del flujo de facturación pasando en CI.",
        ],
        chore_tecnico="E2E del flujo de facturación (Playwright, sigue de la semilla del S7) + deploy "
                      "manual del módulo a staging. 1.5 h.",
        dod="DoD v2.",
        notas="La fórmula de lote 'Emitir a todos' itera por residentes activos y crea N facturas en una "
              "sola transacción. Si una falla, la transacción se revierte para no dejar el lote a medias.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 9
    s.extend(sprint_detail(
        titulo="Sprint 9 — Semana 11 · Facturación v2 (cobros y recordatorios)",
        semana="Semana 11",
        sprint_goal="Cerrar el ciclo de facturación: el admin marca como pagada cada factura, el sistema "
                    "dispara recordatorios automáticos (Realtime + email) antes del vencimiento, y las "
                    "facturas vencidas se etiquetan solas.",
        demo="Carlos registra el pago de una factura → el estado pasa a 'pagada' y Laura recibe una "
             "notificación. Avance simulado del tiempo (seed especial) muestra cómo aparecen los "
             "recordatorios 3 días antes del vencimiento y cómo las facturas pasan a 'vencida' "
             "automáticamente. Laura descarga el comprobante PDF de una factura pagada.",
        pbis=[
            ("HU-FACT-04", "Admin marca factura como pagada + recordatorio Realtime al residente", "P1", "3 h"),
            ("HU-FACT-08", "Recordatorio 3 días antes del vencimiento (Edge Function cron diario)", "P1", "3 h"),
            ("HU-FACT-06", "Estado automático 'vencida' (trigger por fecha en cron diario)", "P2", "2 h"),
            ("HU-FACT-07", "Filtros y badge de facturas vencidas en /admin/facturacion", "P2", "2 h"),
            ("Mejora", "Botón 'Descargar comprobante' (PDF mínimo) por factura pagada", "P3", "2 h"),
            ("Chore-T", "Endpoint /health básico (DB + Auth + Storage) — semilla para alertas", "P2", "1 h"),
        ],
        entregables=[
            "Acción 'Marcar como pagada' en /admin/facturacion con efecto Realtime visible al residente.",
            "Cron diario que pasa facturas a 'vencida' y envía recordatorios 3 días antes.",
            "PDF de comprobante descargable desde el detalle de una factura pagada.",
            "/health responde JSON con estado de DB, Auth y Storage.",
        ],
        chore_tecnico="Endpoint /health básico (chequeo de DB, Auth y Storage). 1 h. Semilla para "
                      "alertas y observabilidad que se completan en chores siguientes.",
        dod="DoD v2.",
        notas="El PDF del comprobante se genera con reportlab (ya en el proyecto). Plantilla simple: "
              "logo Zity + datos residente + desglose + sello 'PAGADO' + fecha.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 10
    s.extend(sprint_detail(
        titulo="Sprint 10 — Semana 12 · Tienda interna v1 (catálogo)",
        semana="Semana 12",
        sprint_goal="Lanzar el catálogo de la tienda interna del edificio: el admin gestiona productos "
                    "(alta/baja/stock/precio + foto) y el residente navega el catálogo desde su panel "
                    "con filtros y búsqueda.",
        demo="Carlos abre /admin/tienda y crea 5 productos (agua, gaseosa, snacks, papel higiénico, "
             "focos LED) con foto, stock y precio. Laura entra a /residente/tienda y ve el catálogo "
             "en grilla con tarjetas atractivas: foto, nombre, precio, stock disponible. Filtra por "
             "categoría 'bebidas' y busca 'agua'.",
        pbis=[
            ("HU-TIENDA-01", "BD productos / pedidos / pedido_items + RLS por rol", "P1", "2 h"),
            ("HU-TIENDA-02", "Admin gestiona catálogo: alta/baja/stock/precio + foto del producto", "P1", "3 h"),
            ("HU-TIENDA-05", "Vista /residente/tienda con catálogo en grilla de tarjetas", "P1", "3 h"),
            ("HU-TIENDA-06", "Filtros del catálogo (categoría, disponibilidad) y búsqueda por nombre", "P2", "2 h"),
            ("Mejora", "Indicador visual de stock bajo (≤ 5 unidades) en la tarjeta del producto", "P3", "1 h"),
            ("Chore-T", "CD: deploy automático en merge a main (Vercel)", "P2", "2 h"),
        ],
        entregables=[
            "Tablas productos / pedidos / pedido_items operativas + RLS verificada.",
            "/admin/tienda con CRUD de productos y subida de foto a Storage.",
            "/residente/tienda con catálogo navegable, filtros y búsqueda.",
            "Workflow deploy-staging.yml operativo (merge a main → deploy automático).",
        ],
        chore_tecnico="CD a staging: workflow GitHub Actions que despliega automáticamente en cada "
                      "merge a main. 2 h. Sin smoke tests por ahora (entran como chore del S14).",
        dod="DoD v2.",
        notas="El indicador de stock bajo es puramente visual (badge naranja). No bloquea la compra; "
              "el stock 0 sí impide agregar al carrito (validado en S11).",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 11
    s.extend(sprint_detail(
        titulo="Sprint 11 — Semana 13 · Tienda interna v2 (carrito + integración con factura)",
        semana="Semana 13",
        sprint_goal="Cerrar el ciclo de la tienda: el residente arma un carrito y confirma su pedido; "
                    "el pedido descuenta stock y al cerrar el mes se suma automáticamente como línea "
                    "en su factura. El admin ve todas las órdenes con filtros.",
        demo="Laura arma un carrito (2 aguas + 1 papel higiénico). Confirma el pedido y se muestra la "
             "confirmación con total; aparece en su historial. Avance simulado del tiempo hasta cierre "
             "de mes: la siguiente factura mensual de Laura incluye automáticamente una línea "
             "'Tienda — Pedido del 15' con el total acumulado.",
        pbis=[
            ("HU-TIENDA-03", "Carrito del residente + confirmación de pedido (descuento atómico de stock)", "P1", "3 h"),
            ("HU-TIENDA-04", "Pedido genera línea automática en la factura mensual del residente", "P1", "3 h"),
            ("HU-TIENDA-07", "Historial de pedidos del residente en /residente/tienda/historial", "P2", "2 h"),
            ("HU-TIENDA-08", "Vista admin de pedidos (todas las órdenes, filtros por residente/fecha/estado)", "P2", "2 h"),
            ("Mejora", "Mini-carrito en navbar con badge de unidades agregadas y subtotal", "P3", "1 h"),
            ("Chore-T", "Privacidad / no-PII: revisión de logs de tienda y factura (solo IDs, sin nombres)", "P2", "2 h"),
        ],
        entregables=[
            "Carrito funcional con descuento atómico de stock al confirmar (transacción).",
            "Pedido confirmado se inserta como línea en la factura del mes al cierre.",
            "Historial de pedidos visible para residente y para admin.",
            "Logs de tienda y factura sin PII directa (solo IDs).",
        ],
        chore_tecnico="Privacidad / no-PII: revisar y limpiar logs de los nuevos módulos (tienda y "
                      "factura) para que solo guarden IDs. 2 h.",
        dod="DoD v3 (primera vez) — incluye E2E mínimos del flujo carrito → pedido → factura + no-PII verificada.",
        notas="El descuento de stock debe ser atómico: si dos residentes intentan comprar la última "
              "unidad simultáneamente, solo uno gana. Test de concurrencia obligatorio.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 12
    s.extend(sprint_detail(
        titulo="Sprint 12 — Semana 14 · Comunicación: tablón de anuncios del edificio",
        semana="Semana 14",
        sprint_goal="Abrir el canal de comunicación oficial del edificio: el admin publica comunicados "
                    "(por categoría y prioridad, con imagen opcional, con la opción de fijarlos y darles "
                    "vigencia) y cada residente los ve al instante en un tablón, con indicador de no leído "
                    "y la posibilidad de marcarlos como leídos.",
        demo="Carlos (admin) abre /admin/anuncios y publica 'Corte de agua programado' (categoría "
             "'mantenimiento', prioridad 'importante') con una imagen, y lo fija. Laura (residente), con "
             "la app abierta, ve aparecer el anuncio al instante con badge 'Nuevo' y la campana suma 1; "
             "al abrirlo, el badge desaparece. Laura filtra el tablón por categoría y el comunicado "
             "fijado queda destacado arriba. Se demuestra que un residente no puede publicar (RLS) y que "
             "un &lt;script&gt; en el cuerpo queda neutralizado (sanitización).",
        pbis=[
            ("HU-ANUNCIO-01", "BD anuncios / anuncio_lecturas + RLS (solo admin publica) + bucket adjuntos", "P1", "2 h"),
            ("HU-ANUNCIO-02", "Admin publica/gestiona comunicados: categoría, prioridad, imagen, fijar, vigencia", "P1", "3 h"),
            ("HU-ANUNCIO-03", "Vista /residente/anuncios: feed con badge de no leído y marcar como leído", "P1", "3 h"),
            ("HU-ANUNCIO-04", "Aviso Realtime + badge de no leídos en la navbar al publicar (reusa S6)", "P2", "2 h"),
            ("Mejora", "Filtro por categoría + anuncios fijados (destacados arriba)", "P3", "1 h"),
            ("Chore-T", "Checklist OWASP de los endpoints de anuncios (A01 acceso, A03 XSS, A05 config)", "P2", "2 h"),
        ],
        entregables=[
            "Tablas anuncios / anuncio_lecturas operativas + RLS verificada (solo el admin publica).",
            "/admin/anuncios con CRUD de comunicados, imagen a Storage, fijar y vigencia.",
            "/residente/anuncios con feed en vivo, badge de no leído y marcar como leído.",
            "Aviso Realtime + badge en la navbar al publicar un comunicado importante/urgente.",
        ],
        chore_tecnico="Checklist OWASP top 10 aplicada a los endpoints de anuncios (A01 control de acceso, "
                      "A03 sanitización del contenido / XSS, A05 configuración). 2 h.",
        dod="DoD v3.",
        notas="El cuerpo del anuncio admite markdown limitado y se sanitiza en servidor (sin HTML/script), "
              "por ser contenido publicado que ven todos los residentes. El tablón reusa el sistema de "
              "notificaciones Realtime del S6 y el patrón de Storage del S3/S10; no requiere variables "
              "nuevas. El Web Push avanzado se mantiene como mejora opcional post-curso.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 13
    s.extend(sprint_detail(
        titulo="Sprint 13 — Semana 15 · Panel integral del residente",
        semana="Semana 15",
        sprint_goal="Dar al residente una vista única donde vea, en una sola pantalla, sus solicitudes "
                    "activas, sus facturas pendientes y sus pedidos del mes — el 'home' que reemplaza "
                    "al dashboard simple actual.",
        demo="Laura entra a Zity y, sin navegar, ve 3 tarjetas grandes: 'Mis solicitudes activas' con "
             "badge del estado, 'Mis facturas pendientes' con monto total a pagar y próximo vencimiento, "
             "'Mis pedidos del mes' con resumen y total acumulado. Cada tarjeta lleva al detalle con un "
             "clic. Cambia su contraseña y revisa sesiones activas (PBI-S6-E03).",
        pbis=[
            ("HU-HOME-01", "Vista /residente como dashboard integral con 3 tarjetas (layout grid responsive)", "P1", "4 h"),
            ("HU-HOME-02", "Tarjeta 'Solicitudes activas' con badge de estado + últimos 3 cambios", "P1", "2 h"),
            ("HU-HOME-03", "Tarjeta 'Facturas pendientes' con total a pagar y próximo vencimiento", "P1", "2 h"),
            ("HU-HOME-04", "Tarjeta 'Pedidos del mes' con resumen de unidades y total acumulado", "P1", "2 h"),
            ("PBI-S6-E03", "Sesiones activas + cerrar todas al cambiar contraseña", "P2", "2 h"),
            ("Chore-T", "Lighthouse ≥ 80 en /residente + revisión de cobertura de tests", "P2", "1 h"),
        ],
        entregables=[
            "Nueva ruta /residente que reemplaza al dashboard simple por las 3 tarjetas.",
            "Cada tarjeta navega al detalle con un clic; responsive en móvil (apilan vertical).",
            "Pestaña 'Sesiones' en /perfil con listado y acción 'Cerrar todas las demás'.",
            "Lighthouse ≥ 80 en performance en la nueva /residente.",
        ],
        chore_tecnico="Auditoría Lighthouse de la nueva /residente + revisión global de cobertura de tests. 1 h.",
        dod="DoD v3.",
        notas="Las 3 tarjetas reusan datos ya disponibles (no se inventan endpoints). El cálculo de "
              "totales se hace con vistas Postgres ligeras para mantener Lighthouse alto.",
        styles=styles,
    ))
    s.append(PageBreak())

    # Sprint 14
    s.extend(sprint_detail(
        titulo="Sprint 14 — Semana 16 · ★ Dashboard ejecutivo del dueño + RC + demo final",
        semana="Semana 16 — ★ BROCHE DEL CURSO",
        sprint_goal="Cerrar el curso con el broche visual: un dashboard ejecutivo para la dueña del "
                    "edificio (Sra. Rosa Díaz) que consolida en una sola vista mantenimiento + finanzas "
                    "+ tienda con gráficas de alto nivel; etiquetar Release Candidate y ensayar la demo "
                    "final integral del producto.",
        demo="La Sra. Rosa Díaz entra al sistema con rol 'observador' y abre /admin/ejecutivo. Ve, en "
             "una sola página: gráfica de barras del volumen mensual de solicitudes resueltas (último "
             "trimestre), tendencia de tiempos de resolución, ingresos por facturación (luz/agua/pensión "
             "separados) con gráfica circular, ingresos por tienda con top 5 productos, comparación "
             "mensual de ingresos vs facturas pendientes. Luego ensayo de demo final completa de todos "
             "los módulos del curso.",
        pbis=[
            ("HU-EJEC-01", "Rol 'observador' del dueño + ruta /admin/ejecutivo con guarda de acceso", "P1", "2 h"),
            ("HU-EJEC-02", "Sección 'Mantenimiento': gráfica de volumen + tiempos + top categorías", "P1", "3 h"),
            ("HU-EJEC-03", "Sección 'Finanzas': gráfica de ingresos por tipo + ratio cobrado/pendiente", "P1", "3 h"),
            ("HU-EJEC-04", "Sección 'Tienda': ingresos del mes + top 5 productos + tendencia", "P1", "2 h"),
            ("RELEASE", "Tag v1.0.0-rc en main + deploy final a staging + smoke tests post-deploy", "P1", "1 h"),
            ("Demo", "Ensayo de demo final + grabación de evidencia académica + retro del curso", "P1", "2 h"),
        ],
        entregables=[
            "Rol 'observador' agregado al sistema + ruta /admin/ejecutivo accesible solo para dueño/admin.",
            "Dashboard ejecutivo en una sola página con 3 secciones (Mantenimiento, Finanzas, Tienda).",
            "Tag v1.0.0-rc publicado en GitHub + deploy a staging final.",
            "Demo final grabada como evidencia académica + documento de retrospectiva del curso.",
        ],
        chore_tecnico="Smoke tests post-deploy del staging final como cierre del ciclo de calidad. "
                      "Incluido en el PBI RELEASE.",
        dod="DoD v3 final — entrega académica completa.",
        notas="El dashboard ejecutivo NO inventa datos: consume los KPIs del S7, las facturas del S8/S9 "
              "y los pedidos del S10/S11. Es la consolidación visual de todo el producto y por eso es "
              "el cierre natural del curso.",
        styles=styles,
    ))
    s.append(PageBreak())

    # ── 3. EVOLUCIÓN DE LA DoD ─────────────────────────────────────────────
    s.append(section_banner("3   EVOLUCIÓN DE LA DEFINITION OF DONE", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "La DoD se escalona en 3 versiones para reflejar el aumento progresivo de calidad esperado. "
        "Cada versión hereda los criterios de la anterior y añade nuevos. Con el enfoque funcional, "
        "los criterios técnicos se cumplen vía chores intercalados en lugar de sprints dedicados.",
        styles["Body"],
    ))

    s.append(Paragraph("DoD v1 — Sprints 0 al 3 (Semanas 2 a 5) · Baseline funcional", styles["H2"]))
    for crit in [
        "Código mergeado a main con CI en verde (lint ESLint + unit tests Vitest).",
        "PR revisado por al menos 1 Developer.",
        "README actualizado: cómo correr localmente + tests + variables de entorno.",
        "Manejo básico de errores: sin stacktraces ni secretos en respuestas de la UI.",
        "Datos demo disponibles (npm run seed) para reproducir la demo del Sprint.",
        "Deploy preview en Vercel funcional para el PR.",
    ]:
        s.append(Paragraph(f"☐ &nbsp; {crit}", styles["BodyLeft"]))

    s.append(Paragraph("DoD v2 — Sprints 4 al 10 (Semanas 6 a 12) · Calidad + integración", styles["H2"]))
    s.append(Paragraph("Todo lo de DoD v1, más:", styles["Body"]))
    for crit in [
        "Pruebas de integración para flujos críticos (crear solicitud, asignar, cambiar estado, emitir factura).",
        "Cobertura ≥ 60% en módulos core (Vitest coverage en CI).",
        "Endpoint /health disponible en staging (cumplido como chore del Sprint 9).",
        "Variables de entorno via Secrets de CI/CD — sin hardcode.",
        "tsc --noEmit pasa sin errores en CI.",
        "Playwright instalado y al menos 1 E2E pasando (cumplido como chore del Sprint 7; la suite crece como chore por sprint).",
    ]:
        s.append(Paragraph(f"☐ &nbsp; {crit}", styles["BodyLeft"]))

    s.append(Paragraph("DoD v3 — Sprints 11 al 14 (Semanas 13 a 16) · Release candidate", styles["H2"]))
    s.append(Paragraph("Todo lo de DoD v2, más:", styles["Body"]))
    for crit in [
        "E2E mínimos de los módulos críticos (mantenimiento + facturación + tienda) en pipeline.",
        "Regresión: si se toca un flujo de los módulos críticos, deben pasar unit + integration + E2E.",
        "Evidencia de no-PII en logs (cumplido como chore del Sprint 11).",
        "Checklist OWASP top 10 aplicada (cumplido como chore del Sprint 12).",
        "Performance: Lighthouse ≥ 80 en rutas principales (cumplido como chore del Sprint 13).",
        "Release candidate etiquetado en staging y demo final reproducible (cumplido en Sprint 14).",
    ]:
        s.append(Paragraph(f"☐ &nbsp; {crit}", styles["BodyLeft"]))
    s.append(Spacer(1, 8))
    s.append(quote_box(
        "Decisión clave del nuevo roadmap: la calidad no baja, pero deja de ser el protagonista. "
            "Cada criterio técnico tiene un dueño y un sprint asignado como chore intercalado.",
        styles,
    ))
    s.append(PageBreak())

    # ── 4. BACKLOG RESTANTE ────────────────────────────────────────────────
    s.append(section_banner("4   BACKLOG RESTANTE PRIORIZADO", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "PBIs del Product Backlog que aún están pendientes, organizados por prioridad y Sprint sugerido "
        "en el nuevo roadmap. La asignación final se confirma en cada Sprint Planning.",
        styles["Body"],
    ))
    bk_header = ["ID", "Historia", "Prioridad", "Estim.", "Sprint sugerido"]
    bk_rows = [
        ["PBI-17", "Exportar solicitudes a CSV (admin)", Paragraph("● P2", styles["WarnLabel"]), "2 h", "S7"],
        ["PBI-22", "Panel de métricas / KPIs", Paragraph("● P1", styles["FailLabel"]), "5 h", "S7"],
        ["HU-KPI-01", "Gráficas básicas: barras + líneas (Recharts)", Paragraph("● P1", styles["FailLabel"]), "3 h", "S7"],
        ["HU-FACT-01..05", "Módulo Facturación v1 (BD + emisión + vista residente + notificación)", Paragraph("● P1", styles["FailLabel"]), "10 h", "S8"],
        ["HU-FACT-04..08", "Módulo Facturación v2 (cobros + recordatorios + vencida + PDF)", Paragraph("● P1", styles["FailLabel"]), "12 h", "S9"],
        ["HU-TIENDA-01,02,05,06", "Módulo Tienda v1 (BD + catálogo admin + vista residente + filtros)", Paragraph("● P1", styles["FailLabel"]), "10 h", "S10"],
        ["HU-TIENDA-03,04,07,08", "Módulo Tienda v2 (carrito + integración factura + historial)", Paragraph("● P1", styles["FailLabel"]), "10 h", "S11"],
        ["HU-ANUNCIO-01..04", "Módulo Comunicación (tablón de anuncios del edificio + lecturas)", Paragraph("● P1", styles["FailLabel"]), "10 h", "S12"],
        ["HU-PUSH-01, PBI-S6-E01,E02", "Web Push + presencia + sonido/haptic (mejora opcional; Realtime+email del S6 ya cubre el aviso)", Paragraph("● P3", styles["OkLabel"]), "9 h", "Post-curso"],
        ["HU-HOME-01..04", "Panel integral del residente (3 tarjetas)", Paragraph("● P1", styles["FailLabel"]), "10 h", "S13"],
        ["PBI-S6-E03", "Sesiones activas + cerrar todas al cambiar contraseña", Paragraph("● P2", styles["WarnLabel"]), "2 h", "S13"],
        ["HU-EJEC-01..04", "Dashboard ejecutivo del dueño del edificio", Paragraph("● P1", styles["FailLabel"]), "10 h", "S14"],
        ["RELEASE", "Tag v1.0.0-rc + demo final + retro del curso", Paragraph("● P1", styles["FailLabel"]), "3 h", "S14"],
        ["PBI-S6-E04, S7-E01", "Resumen diario por email · cobertura E2E publicada", Paragraph("● P3", styles["OkLabel"]), "3 h", "Sin asignar"],
        ["HU-AUTH-07", "Twilio Verify 2FA (descartado del roadmap, queda como opcional post-curso)", Paragraph("● P3", styles["OkLabel"]), "5 h", "Post-curso"],
    ]
    s.append(grid_table(bk_header, bk_rows, [1.3 * inch, 3.5 * inch, 0.75 * inch, 0.55 * inch, 0.65 * inch], styles))
    s.append(Spacer(1, 8))
    s.append(Paragraph(
        "<b>Total estimado pendiente:</b> ~90 h en 8 sprints (S7–S14). Capacidad: 8 × 13 h = 104 h "
        "(con 16 h de buffer acumulado). Holgura saludable para absorber emergentes.",
        styles["Body"],
    ))
    s.append(PageBreak())

    # ── 5. DEPENDENCIAS Y RIESGOS ─────────────────────────────────────────
    s.append(section_banner("5   DEPENDENCIAS Y RIESGOS GLOBALES", styles))
    s.append(Spacer(1, 14))

    s.append(Paragraph("Dependencias críticas entre Sprints", styles["H2"]))
    dep_header = ["Dependencia", "Detalle"]
    dep_rows = [
        ["Sprint 7 → Sprint 14", "Las gráficas (Recharts) y vistas materializadas del S7 las reusa el dashboard ejecutivo del S14."],
        ["Sprint 8 → Sprint 9", "La emisión de facturas (S8) es prerrequisito de los cobros y recordatorios (S9)."],
        ["Sprint 9 → Sprint 11", "La estructura de facturas (S9) la consume la Tienda v2 al integrar pedidos como línea de factura."],
        ["Sprint 10 → Sprint 11", "El catálogo y BD de tienda (S10) son prerrequisito del carrito (S11)."],
        ["Sprint 8/9/10/11 → Sprint 14", "El dashboard ejecutivo consume todos los datos de los módulos funcionales previos."],
        ["Sprint 6 (Realtime) → Sprint 8", "El sistema de notificaciones del S6 se reusa para notificar emisión de facturas."],
        ["Sprint 6 (Realtime) → Sprint 12", "El sistema de notificaciones Realtime del S6 se reusa para avisar en vivo de los nuevos anuncios del tablón (S12)."],
    ]
    s.append(grid_table(dep_header, dep_rows, [1.6 * inch, 5.15 * inch], styles))

    s.append(Paragraph("Riesgos transversales del roadmap", styles["H2"]))
    risk_header = ["#", "Riesgo", "Mitigación"]
    risk_rows = [
        ["R-RM1",
         "Acumular calidad/CD/seguridad como chores podría hacer que se posterguen y nunca se completen.",
         "El SM marca el chore técnico en cada Sprint Planning como obligatorio (no es 'opcional'). Si un chore se posterga, se reprograma como prioridad del siguiente sprint."],
        ["R-RM2",
         "El dashboard ejecutivo del S14 depende de datos reales de todos los módulos previos; si algún módulo se retrasa, el broche pierde fuerza.",
         "El seed de demo se mantiene actualizado en cada sprint con datos representativos de cada módulo nuevo. El S14 puede usar el seed si los datos reales no alcanzan."],
        ["R-RM3",
         "La Tienda v2 (S11) depende de la Facturación v1 (S8). Si el modelo de facturas cambia, hay que retocar la integración.",
         "Acordar en S8 el esquema de líneas de factura pensando en la integración futura con tienda; si cambia, generar migración y refactor en el chore del S11."],
        ["R-RM4",
         "Las gráficas con Recharts pueden inflar el bundle.",
         "Code splitting por ruta (lazy load de /admin/metricas y /admin/ejecutivo). Validar en el chore Lighthouse del S13."],
        ["R-RM5",
         "El contenido publicado en el tablón de anuncios (S12) podría incluir HTML/script malicioso (XSS), visible para todos los residentes.",
         "Sanitización del contenido en servidor (markdown limitado, sin HTML/script) + render seguro; control de acceso por RLS (solo el admin publica). Cubierto por el chore OWASP del S12 (A01/A03)."],
        ["R-RM6",
         "Concurrencia en descuento de stock de la tienda (S11) puede llevar a sobreventa.",
         "Descuento atómico en transacción Postgres con SELECT ... FOR UPDATE o constraint check; test de concurrencia explícito."],
        ["R-RM7",
         "Algún Sprint produce un entregable que no resulta suficientemente visible en la Sprint Review.",
         "Cada Sprint Planning define explícitamente la 'Demo del Sprint' como criterio de aceptación obligatorio del Sprint Goal."],
        ["R-RM8",
         "Twilio quedó fuera del roadmap; si algún stakeholder lo esperaba como sorpresa, hay que justificar el cambio.",
         "El cambio se documenta en la portada del roadmap (se reemplazó por el dashboard ejecutivo del dueño, más visual y con mejor cierre narrativo del producto)."],
    ]
    s.append(grid_table(risk_header, risk_rows, [0.6 * inch, 3.0 * inch, 3.15 * inch], styles))
    s.append(PageBreak())

    # ── 6. RECORDATORIOS ───────────────────────────────────────────────────
    s.append(section_banner("6   RECORDATORIOS PARA EL EQUIPO", styles))
    s.append(Spacer(1, 14))
    for r in [
        "<b>Cada Sprint debe presentar algo visible:</b> antes de cerrar el Sprint Planning, el equipo valida que existe una demo concreta para la Sprint Review. Si no, se rediseña el alcance.",
        "<b>El chore técnico no es opcional:</b> es parte del Sprint Backlog comprometido. Saltárselo sistemáticamente significa que la DoD no se cumple — el SM debe levantar la mano si esto pasa.",
        "<b>El Sprint Goal manda:</b> el roadmap es una proyección, pero el Sprint Goal de cada Sprint es inamovible una vez acordado en el Planning.",
        "<b>Refinement entre Sprints:</b> reservar 30 minutos entre la Retrospective y el Planning siguiente para refinar el backlog del próximo Sprint con datos del Review. Práctica adoptada desde el Sprint 5 Retro.",
        "<b>PBIs emergentes:</b> cada Review puede generar PBIs nuevos. Estos compiten con los planificados aquí; la priorización la define el PO.",
        "<b>Capacidad real vs estimada:</b> documentar cada Sprint las horas reales invertidas para ajustar la velocidad observada (estable en 13.2 h/sprint).",
        "<b>DoD escalonada:</b> el equipo no puede 'bajar' de DoD versionada — un Sprint en DoD v2 nunca vuelve a aplicar DoD v1.",
        "<b>★ Mantener el dashboard del dueño como cierre narrativo:</b> aunque está planificado, evitar adelantar su demo en las Reviews previas; se presenta recién en el Sprint 14 para preservar su impacto como pieza de integración final del producto.",
        "<b>Documento vivo:</b> tras cada Sprint Review, actualizar este roadmap con el estado real y los PBIs emergentes que entren al backlog.",
    ]:
        s.append(Paragraph(f"• {r}", styles["Body"]))

    s.append(Spacer(1, 14))
    s.append(Paragraph(
        "— Zity · Roadmap reformulado · Enfoque funcional · Documento vivo — actualizar tras cada Sprint Review —",
        styles["Footer"],
    ))

    return s


# ─── Entry point ──────────────────────────────────────────────────────────────


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "sprints")
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "Zity_Roadmap_Sprints.pdf")

    styles = build_styles()
    doc = make_doc(out_path)
    story = build_story(styles)
    doc.build(story)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Generado: {out_path}  ({size_kb:.1f} KB)")

    # Copia paralela a la raíz del proyecto (donde existe el roadmap previo)
    root_copy = os.path.normpath(
        os.path.join(os.path.dirname(__file__), "..", "Zity_Roadmap_Sprints.pdf")
    )
    shutil.copyfile(out_path, root_copy)
    print(f"Copiado:  {root_copy}")


if __name__ == "__main__":
    main()
