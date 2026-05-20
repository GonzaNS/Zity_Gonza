"""
Genera el PDF de artefactos Scrum del Sprint 6 (Zity).
Estilo visual: cabecera azul con título centrado, tablas tipo zebra,
secciones numeradas con banda de color, footer con número de página.

Uso:
    python scripts/generate_sprint6_pdf.py

Salida:
    docs/sprints/Zity_Sprint6_Artefactos.pdf
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
# Paleta inspirada en publicaciones académicas: azul Oxford profundo +
# neutros cálidos. Alto contraste para texto, tintes suaves para fondos.

ZITY_BLUE = colors.HexColor("#1d3a5f")          # Azul Oxford — banners y headers
ZITY_BLUE_DARK = colors.HexColor("#142948")     # Acento profundo — títulos
ZITY_BLUE_LIGHT = colors.HexColor("#e5edf5")    # Fondo suave azulado
ZITY_LABEL_BG = colors.HexColor("#eef1f4")      # Fondo de etiquetas info_table
ZITY_BG_SOFT = colors.HexColor("#f7f8fa")       # Zebra muy sutil
ZITY_BG_QUOTE = colors.HexColor("#f0f4f9")      # Quote/sprint goal box
ZITY_BORDER = colors.HexColor("#d8dde3")        # Bordes finos generales
ZITY_BORDER_LIGHT = colors.HexColor("#e8ebef")  # Líneas internas tabla
ZITY_TEXT = colors.HexColor("#1c2330")          # Cuerpo de texto principal
ZITY_TEXT_MUTED = colors.HexColor("#5b6878")    # Texto secundario / metadata
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

    # ── Portada ────────────────────────────────────────────────────────────
    styles["TitleCover"] = ParagraphStyle(
        "TitleCover",
        parent=base["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=46,
        leading=52,
        alignment=TA_CENTER,
        textColor=ZITY_BLUE_DARK,
        spaceAfter=4,
    )
    styles["SubtitleCover"] = ParagraphStyle(
        "SubtitleCover",
        parent=base["Heading2"],
        fontName="Helvetica",
        fontSize=18,
        leading=24,
        alignment=TA_CENTER,
        textColor=ZITY_BLUE,
        spaceAfter=6,
    )
    styles["TaglineCover"] = ParagraphStyle(
        "TaglineCover",
        parent=base["Italic"],
        fontName="Helvetica-Oblique",
        fontSize=11,
        leading=16,
        alignment=TA_CENTER,
        textColor=ZITY_TEXT_MUTED,
        spaceAfter=26,
    )

    # ── Banners de sección (texto blanco sobre franja azul) ───────────────
    styles["SectionBanner"] = ParagraphStyle(
        "SectionBanner",
        fontName="Helvetica-Bold",
        fontSize=13.5,
        leading=18,
        textColor=colors.white,
        spaceBefore=0,
        spaceAfter=0,
        leftIndent=4,
        letterSpace=0.5,
    )

    # ── Encabezados ────────────────────────────────────────────────────────
    styles["H2"] = ParagraphStyle(
        "H2",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=18,
        textColor=ZITY_BLUE_DARK,
        spaceBefore=16,
        spaceAfter=8,
    )
    styles["H3"] = ParagraphStyle(
        "H3",
        parent=base["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=ZITY_BLUE,
        spaceBefore=12,
        spaceAfter=4,
    )

    # ── Texto corrido ──────────────────────────────────────────────────────
    styles["Body"] = ParagraphStyle(
        "Body",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=15,
        textColor=ZITY_TEXT,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
    )
    styles["BodyLeft"] = ParagraphStyle(
        "BodyLeft",
        parent=styles["Body"],
        alignment=TA_LEFT,
        spaceAfter=6,
    )

    # ── Celdas de tabla ────────────────────────────────────────────────────
    styles["Cell"] = ParagraphStyle(
        "Cell",
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=ZITY_TEXT,
        alignment=TA_LEFT,
    )
    styles["CellBold"] = ParagraphStyle(
        "CellBold",
        parent=styles["Cell"],
        fontName="Helvetica-Bold",
        textColor=ZITY_BLUE_DARK,
    )
    # Cabecera de tabla grilla (texto blanco sobre fondo azul oscuro)
    styles["CellHeader"] = ParagraphStyle(
        "CellHeader",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.white,
        alignment=TA_LEFT,
        letterSpace=0.3,
    )
    # Etiqueta de info_table (texto oscuro sobre fondo claro)
    styles["CellLabel"] = ParagraphStyle(
        "CellLabel",
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=ZITY_BLUE_DARK,
        alignment=TA_LEFT,
        letterSpace=0.2,
    )

    # ── Quote / Sprint Goal ────────────────────────────────────────────────
    styles["Quote"] = ParagraphStyle(
        "Quote",
        parent=styles["Body"],
        fontName="Helvetica-BoldOblique",
        fontSize=10.5,
        leading=16,
        alignment=TA_CENTER,
        textColor=ZITY_BLUE_DARK,
        spaceBefore=0,
        spaceAfter=0,
    )

    # ── Notas y pie ────────────────────────────────────────────────────────
    styles["Note"] = ParagraphStyle(
        "Note",
        parent=base["Italic"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        leading=13,
        textColor=ZITY_TEXT_MUTED,
        spaceBefore=2,
        spaceAfter=10,
    )
    styles["Footer"] = ParagraphStyle(
        "Footer",
        fontName="Helvetica-Oblique",
        fontSize=8.5,
        leading=11,
        textColor=ZITY_TEXT_MUTED,
        alignment=TA_CENTER,
    )

    # ── Etiquetas de estado en celdas (semánticas) ────────────────────────
    styles["OkLabel"] = ParagraphStyle(
        "OkLabel",
        parent=styles["Cell"],
        fontName="Helvetica-Bold",
        textColor=ZITY_OK,
    )
    styles["WarnLabel"] = ParagraphStyle(
        "WarnLabel",
        parent=styles["Cell"],
        fontName="Helvetica-Bold",
        textColor=ZITY_WARN,
    )
    styles["FailLabel"] = ParagraphStyle(
        "FailLabel",
        parent=styles["Cell"],
        fontName="Helvetica-Bold",
        textColor=ZITY_FAIL,
    )

    return styles


# ─── Helpers de tabla ─────────────────────────────────────────────────────────


def info_table(rows: Sequence[tuple[str, str]], styles: dict[str, ParagraphStyle]) -> Table:
    """
    Tabla de 2 columnas etiqueta/valor.
    Etiqueta: fondo tinte gris-azulado + texto azul oscuro (legible, no blanco).
    Valor: fondo blanco + texto cuerpo.
    """
    data = [
        [
            Paragraph(label, styles["CellLabel"]),
            Paragraph(value, styles["Cell"]),
        ]
        for label, value in rows
    ]
    t = Table(data, colWidths=[1.7 * inch, 5.05 * inch], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
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
            ]
        )
    )
    return t


def grid_table(
    header: Sequence[str],
    rows: Sequence[Sequence[object]],
    col_widths: Sequence[float],
    styles: dict[str, ParagraphStyle],
) -> Table:
    """Tabla con cabecera azul oscuro + filas con zebra muy sutil."""
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


def _to_cell(cell, styles: dict[str, ParagraphStyle]):
    if isinstance(cell, Paragraph):
        return cell
    if isinstance(cell, str):
        return Paragraph(cell, styles["Cell"])
    return Paragraph(str(cell), styles["Cell"])


def quote_box(text: str, styles: dict[str, ParagraphStyle]) -> Table:
    """
    Bloque de cita destacada (Sprint Goal, mensajes clave).
    """
    p = Paragraph(text, styles["Quote"])
    t = Table([[p]], colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ZITY_BG_QUOTE),
                ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BLUE_LIGHT),
                ("LEFTPADDING", (0, 0), (-1, -1), 20),
                ("RIGHTPADDING", (0, 0), (-1, -1), 20),
                ("TOPPADDING", (0, 0), (-1, -1), 14),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
                ("LINEBEFORE", (0, 0), (0, -1), 3, ZITY_BLUE),
            ]
        )
    )
    return t


def _separador_decorativo() -> Table:
    """Filete fino centrado, tipo línea editorial bajo el título."""
    t = Table(
        [[""]],
        colWidths=[1.2 * inch],
        rowHeights=[0.04 * inch],
        hAlign="CENTER",
    )
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ZITY_BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    return t


def section_banner(label: str, styles: dict[str, ParagraphStyle]) -> Table:
    """
    Banda de sección a ancho completo.
    """
    p = Paragraph(label, styles["SectionBanner"])
    t = Table([[p]], colWidths=[PAGE_W - LEFT_MARGIN - RIGHT_MARGIN], hAlign="LEFT")
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), ZITY_BLUE_DARK),
                ("LEFTPADDING", (0, 0), (-1, -1), 16),
                ("RIGHTPADDING", (0, 0), (-1, -1), 16),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LINEBEFORE", (0, 0), (0, -1), 4, ZITY_BLUE),
            ]
        )
    )
    return t


def hu_card(
    code: str,
    title: str,
    estimacion: str,
    prioridad: str,
    historia: str,
    criterios: Sequence[str],
    evidencia: str | None,
    styles: dict[str, ParagraphStyle],
    star: bool = False,
) -> KeepTogether:
    """Card visual de una historia de usuario, estilo académico refinado."""
    header_left = f"<b>{code}</b> · {title}{'  ★' if star else ''}"
    header_table = Table(
        [
            [
                Paragraph(header_left, styles["CellBold"]),
                Paragraph(estimacion, styles["Cell"]),
                Paragraph(prioridad, styles["Cell"]),
            ]
        ],
        colWidths=[4.1 * inch, 1.25 * inch, 1.4 * inch],
        hAlign="LEFT",
    )
    header_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), ZITY_LABEL_BG),
                ("BACKGROUND", (1, 0), (1, 0), colors.HexColor("#dde7f0")),
                ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#f0dada")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("ALIGN", (1, 0), (-1, 0), "CENTER"),
                ("BOX", (0, 0), (-1, -1), 0.5, ZITY_BORDER),
            ]
        )
    )

    items: list = [
        header_table,
        Spacer(1, 8),
        Paragraph(historia, styles["Body"]),
        Spacer(1, 4),
        Paragraph("<b>Criterios de aceptación</b>", styles["H3"]),
    ]
    for c in criterios:
        items.append(Paragraph(f"☐ &nbsp; {c}", styles["BodyLeft"]))
    if evidencia:
        items.append(Spacer(1, 4))
        items.append(Paragraph(f"<b>Evidencia:</b> <i>{evidencia}</i>", styles["Note"]))
    if star:
        items.append(Paragraph(
            "★ <i>Continúa el feedback del profesor o emergente del Sprint anterior.</i>",
            styles["Note"],
        ))
    items.append(Spacer(1, 14))
    return KeepTogether(items)


# ─── Plantilla con cabecera/pie ───────────────────────────────────────────────


def make_doc(path: str) -> BaseDocTemplate:
    doc = BaseDocTemplate(
        path,
        pagesize=LETTER,
        leftMargin=LEFT_MARGIN,
        rightMargin=RIGHT_MARGIN,
        topMargin=TOP_MARGIN,
        bottomMargin=BOTTOM_MARGIN,
        title="Zity · Artefactos Sprint 6",
        author="Equipo Zity",
        subject="Notificaciones Realtime, email simulado y foto de cierre técnico",
        keywords="scrum, sprint 6, zity, notificaciones, realtime, supabase",
    )

    frame = Frame(
        doc.leftMargin,
        doc.bottomMargin,
        doc.width,
        doc.height,
        id="main",
        showBoundary=0,
    )

    def on_page(canvas, doc_):
        canvas.saveState()

        # Línea fina decorativa en el footer
        canvas.setStrokeColor(ZITY_BORDER)
        canvas.setLineWidth(0.4)
        canvas.line(
            LEFT_MARGIN,
            0.6 * inch,
            PAGE_W - RIGHT_MARGIN,
            0.6 * inch,
        )

        # Marca de producto (izquierda)
        canvas.setFont("Helvetica-Bold", 8.5)
        canvas.setFillColor(ZITY_BLUE_DARK)
        canvas.drawString(LEFT_MARGIN, 0.4 * inch, "Zity")
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawString(
            LEFT_MARGIN + 0.32 * inch,
            0.4 * inch,
            "· Artefactos Scrum · Sprint 6",
        )

        # Número de página (derecha)
        canvas.setFont("Helvetica", 8.5)
        canvas.setFillColor(ZITY_TEXT_MUTED)
        canvas.drawRightString(
            PAGE_W - RIGHT_MARGIN,
            0.4 * inch,
            f"pág. {doc_.page}",
        )

        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=on_page)])
    return doc


# ─── Contenido del Sprint 6 ───────────────────────────────────────────────────


def build_story(styles: dict[str, ParagraphStyle]) -> list:
    s: list = []

    # ── Portada ────────────────────────────────────────────────────────────
    s.append(Spacer(1, 20))
    s.append(Paragraph("Zity", styles["TitleCover"]))
    s.append(Spacer(1, 4))
    s.append(_separador_decorativo())
    s.append(Spacer(1, 12))
    s.append(Paragraph("Artefactos Scrum — Sprint 6", styles["SubtitleCover"]))
    s.append(
        Paragraph(
            "Comunicación — Notificaciones Supabase Realtime · Email simulado al cambio "
            "de estado · Foto de cierre por técnico (antes/después) · Emergentes Sprint 4 y 5",
            styles["TaglineCover"],
        )
    )
    s.append(Spacer(1, 16))

    s.append(
        info_table(
            [
                ("Producto", "Zity"),
                ("Sprint", "Sprint 6 — Semana 8"),
                (
                    "Stack",
                    "React 19 + Vite 8 + TailwindCSS 4 · Supabase (Postgres + Auth + Storage + Realtime) · "
                    "Resend (email transaccional) · Vercel · GitHub Actions · Vitest "
                    "(Playwright planificado para Sprint 7)",
                ),
                ("Product Owner", "Alvarez Rocca Jaqueline"),
                ("Scrum Master", "Meza Pelaez Carlos"),
                (
                    "Developers",
                    "Cortez Zamora Leonardo Fabian · Gonza Morales Yoel Ronaldo · "
                    "Santiago Flores Carlos Steven",
                ),
                ("Capacidad semanal", "3 h/día × 5 integrantes = 15 horas/semana · 60 horas/mes"),
                ("Horas estimadas", "13 horas (2 horas de buffer)"),
                (
                    "DoD aplicable",
                    "DoD v2 — tercera aplicación (calidad + seguridad base + integración)",
                ),
                (
                    "Nuevo en este sprint",
                    "Suscripciones Realtime de Supabase en los 3 dashboards · Centro de notificaciones "
                    "con badge de no leídas · Email simulado por Edge Function · Foto de cierre del "
                    "técnico (antes/después) · Resuelve emergentes E01/E02/E03 de Sprints 4 y 5 · "
                    "Continúa la deuda DoD v2 (/health planificado Sprint 8)",
                ),
                (
                    "Variable nueva",
                    "RESEND_FROM_ADDRESS para customizar el remitente del email simulado de cambio "
                    "de estado (Sprint 6)",
                ),
                ("Nota", "Documento académico — Datos ficticios sin PII real"),
            ],
            styles,
        )
    )
    s.append(Spacer(1, 14))
    s.append(Paragraph("Documento vivo — se actualiza en cada Sprint Review", styles["Footer"]))
    s.append(PageBreak())

    # ── 1. SPRINT PLANNING ─────────────────────────────────────────────────
    s.append(section_banner("1   ACTA DE SPRINT PLANNING", styles))
    s.append(Spacer(1, 14))

    s.append(
        info_table(
            [
                ("Sprint", "Sprint 6 — Semana 8"),
                ("Fecha", "Lunes — inicio de semana 8"),
                ("Duración del evento", "75 minutos"),
                ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
                (
                    "Asistentes",
                    "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), "
                    "Cortez Zamora Leonardo, Gonza Morales Yoel, "
                    "Santiago Flores Carlos (Devs)",
                ),
                (
                    "Stakeholder invitado",
                    "Laura Vega (Residente ficticia) — el caso de uso del Sprint gira en torno a "
                    "que el residente reciba notificaciones inmediatas tras cada cambio de estado, "
                    "así que se prioriza su participación",
                ),
                ("Capacidad", "15 horas disponibles · se usarán 13 h (2 h de buffer)"),
                (
                    "Entrada",
                    "Product Backlog actualizado tras Sprint 5 Review con 4 PBIs emergentes (HU-MANT-08, "
                    "PBI-S5-E01, PBI-S5-E02, PBI-S5-E03) · DoD v2 continúa (7/9 al cierre del Sprint 5, "
                    "los 2 pendientes son CD/health) · Acciones de mejora del Sprint 5 Retro entran en vigor",
                ),
                (
                    "Variables nuevas",
                    "RESEND_FROM_ADDRESS (opcional, default 'no-reply@zity.local') — cualquier valor se "
                    "valida contra el dominio autorizado en Resend antes del primer envío",
                ),
                (
                    "Estrategia de seed",
                    "Disparar manualmente acciones del Sprint 4/5 (asignar, cerrar, rechazar) para poblar "
                    "la tabla notificaciones y demostrar el Realtime en vivo durante la Review. "
                    "El script seed.js gana un comando opcional --notify para encolar 10 notificaciones "
                    "iniciales por residente activo del seed.",
                ),
                (
                    "Refinement previo",
                    "Acción 3 del Sprint 5 Retro aplicada: el viernes anterior el PO presentó los criterios "
                    "completos de los 7 PBIs en una sesión de 30 min. Resultado: cero hotfixes durante el "
                    "Sprint (vs 1 en Sprint 5)",
                ),
            ],
            styles,
        )
    )
    s.append(Spacer(1, 10))

    s.append(Paragraph("Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        '"Cerrar la comunicación: cada cambio de estado relevante notifica a su destinatario por '
        "Realtime y por email simulado · el residente y el técnico reciben en su navbar una campana "
        "con badge de pendientes · el técnico documenta el cierre con foto antes/después · el admin "
        'recibe alerta cuando un residente rechaza · y se cierran los emergentes E02 y E03 del Sprint 5."',
        styles,
    ))
    s.append(
        Paragraph(
            "Nota: Tercera aplicación de DoD v2. Las acciones de mejora del Sprint 5 Retro entran "
            "en vigor: (1) tabla audit_acciones como única fuente de verdad para el catálogo, "
            "(2) componente RangoDeFechas reusable a partir del date range picker de auditoría, "
            "(3) Refinement de 30 min entre Retro y Planning ya realizado.",
            styles["Note"],
        )
    )
    s.append(Spacer(1, 10))

    # PBIs seleccionados
    s.append(Paragraph("PBIs seleccionados — Sprint 6", styles["H2"]))
    pbi_header = ["ID", "Historia / Tarea", "Tipo", "Prior.", "Horas", "Responsable"]
    pbi_rows = [
        [
            "PBI-12",
            "Notificaciones Supabase Realtime + email simulado al cambiar estado de solicitud",
            "Historia",
            Paragraph("● P1", styles["FailLabel"]),
            "4 h",
            "Gonza Morales",
        ],
        [
            "HU-NOTIF-01",
            "Centro de notificaciones (campana en navbar) con badge de no leídas y dropdown",
            "Historia",
            Paragraph("● P1", styles["FailLabel"]),
            "3 h",
            "Santiago Flores",
        ],
        [
            "HU-NOTIF-02",
            "Marcar notificación como leída · marcar todas como leídas",
            "Historia",
            Paragraph("● P2", styles["WarnLabel"]),
            "1.5 h",
            "Santiago Flores",
        ],
        [
            "PBI-S3-E01",
            "Foto de cierre por técnico al marcar resuelta (antes/después)",
            "Historia",
            Paragraph("● P2", styles["WarnLabel"]),
            "1.5 h",
            "Cortez Zamora",
        ],
        [
            "PBI-S4-E01",
            "Notificar al admin cuando un residente rechaza una solución (cualquier rechazo)",
            "Historia",
            Paragraph("● P2", styles["WarnLabel"]),
            "1 h",
            "Cortez Zamora",
        ],
        [
            "PBI-S5-E02",
            "Botón 'Ver auditoría' en el drawer de una solicitud (filtra audit_log por entidad_id)",
            "Historia",
            Paragraph("● P2", styles["WarnLabel"]),
            "1 h",
            "Santiago Flores",
        ],
        [
            "PBI-S5-E03",
            "Cambio de contraseña desde /perfil con verificación de la contraseña actual",
            "Historia",
            Paragraph("● P2", styles["WarnLabel"]),
            "1 h",
            "Cortez Zamora",
        ],
    ]
    s.append(
        grid_table(
            pbi_header,
            pbi_rows,
            [0.85 * inch, 2.65 * inch, 0.65 * inch, 0.55 * inch, 0.55 * inch, 1.05 * inch],
            styles,
        )
    )
    s.append(
        Paragraph(
            "Total estimado: 13 horas · 2 horas de buffer disponibles para imprevistos.",
            styles["Body"],
        )
    )
    s.append(Spacer(1, 8))

    # Decisiones técnicas
    s.append(Paragraph("Decisiones técnicas del Sprint", styles["H2"]))
    s.append(
        Paragraph(
            "Antes de iniciar el desarrollo, el equipo toma las siguientes decisiones técnicas:",
            styles["Body"],
        )
    )
    dec_header = ["Decisión", "Detalle", "Registrado en"]
    dec_rows = [
        [
            "Canal Realtime único",
            "Una sola suscripción por dashboard al canal 'notificaciones:usuario_id={auth.uid()}'. "
            "El hook useNotificaciones() centraliza connect/disconnect, reconexión exponencial y "
            "limpieza al desmontar. RLS asegura que cada usuario solo recibe sus eventos.",
            "/docs/notificaciones.md (nuevo) + ADR-009",
        ],
        [
            "Email simulado",
            "Edge Function notificar-cambio-estado dispara llamada a Resend con plantilla HTML mínima. "
            "Si RESEND_API_KEY está ausente (entorno local), la función responde 200 y loguea el cuerpo "
            "del email (modo dry-run). En Review usamos modo dry-run para evitar enviar emails reales.",
            "/docs/notificaciones.md + Edge Function",
        ],
        [
            "Foto de cierre técnico",
            "El técnico, al marcar resuelta, puede adjuntar 1 foto (opcional, máx 5MB). Se guarda en "
            "bucket solicitudes-fotos bajo {residente_id}/{solicitud_id}/cierre_{timestamp}_{nombre}. "
            "El path queda en historial_estados.nota como sufijo [cierre: <path>] y la vista de detalle "
            "lo renderiza junto a la foto original (antes/después).",
            "Criterio PBI-S3-E01",
        ],
        [
            "Catálogo de acciones unificado",
            "Acción 1 del Retro Sprint 5: se crea la tabla audit_acciones (codigo PK, descripcion, "
            "requiere_detalle bool). El CHECK SQL del Sprint 5 se reemplaza por FK. El frontend consume "
            "el catálogo vía RPC catalogo_acciones() al iniciar y lo cachea en memoria por la sesión.",
            "/docs/audit.md actualizado + migración 006_audit_acciones.sql",
        ],
        [
            "Componente RangoDeFechas",
            "Acción 2 del Retro Sprint 5: se extrae el date range picker de /admin/auditoria a "
            "src/components/shared/RangoDeFechas.tsx, con validación (desde ≤ hasta, máx 90 días) y "
            "estilos consistentes. Se reusa en el centro de notificaciones (filtro por rango opcional).",
            "Acción 2 Retro Sprint 5",
        ],
        [
            "Cambio de contraseña",
            "PBI-S5-E03 usa supabase.auth.updateUser({password}) tras verificar la actual con un "
            "reauth por signInWithPassword. Si la actual falla, se muestra error inline sin tocar la "
            "contraseña. Tres intentos fallidos seguidos bloquean el formulario por 5 minutos.",
            "Criterio PBI-S5-E03 + OWASP A07",
        ],
        [
            "Cobertura mínima como gate",
            "Antes de cerrar el Sprint, src/lib/notificaciones.ts (nuevo) debe alcanzar ≥ 60% "
            "(replicar lo logrado por audit.ts en Sprint 5). vite.config.ts mantiene el threshold por "
            "archivo nuevo.",
            "DoD v2",
        ],
    ]
    s.append(
        grid_table(
            dec_header,
            dec_rows,
            [1.4 * inch, 4.2 * inch, 1.3 * inch],
            styles,
        )
    )
    s.append(Spacer(1, 10))

    # Desglose por dev
    s.append(Paragraph("Desglose de tareas — ¿Cómo?", styles["H2"]))

    s.append(Paragraph("Gonza Morales Yoel — PBI-12 + Refactor audit_acciones (4 h)", styles["H3"]))
    tarea_header = ["Tarea", "Horas"]
    s.append(
        grid_table(
            tarea_header,
            [
                ["Migración SQL 006: crear tabla audit_acciones (codigo PK, descripcion, requiere_detalle) y poblar con las 21 acciones existentes. Reemplazar CHECK de audit_log.accion por FK.", "0.5 h"],
                ["Migración SQL 007: trigger after_solicitud_estado_changed que inserta en notificaciones (usuario_id destinatario, tipo, mensaje) tras cada cambio relevante. RLS de SELECT/UPDATE solo para el propio usuario_id.", "1 h"],
                ["Edge Function notificar-cambio-estado: recibe payload del trigger via NOTIFY/LISTEN, formatea email HTML mínimo y llama a Resend. Modo dry-run si falta RESEND_API_KEY.", "1.5 h"],
                ["src/lib/notificaciones.ts: helper marcarComoLeida() + marcarTodasComoLeidas() + useNotificaciones() con suscripción Realtime y reconexión. Tests con cobertura ≥ 60%.", "1 h"],
            ],
            [5.5 * inch, 1.0 * inch],
            styles,
        )
    )

    s.append(Paragraph("Santiago Flores Carlos — HU-NOTIF-01 + HU-NOTIF-02 + PBI-S5-E02 (5.5 h)", styles["H3"]))
    s.append(
        grid_table(
            tarea_header,
            [
                ["Componente CampanaNotificaciones: icono con badge de no leídas (animación pulse cuando llega una nueva), dropdown con últimas 10 notificaciones, link 'Ver todas' al centro completo.", "1.5 h"],
                ["Página /notificaciones (todos los roles): lista completa paginada con filtro por estado (leídas / no leídas / todas) y filtro opcional por rango de fechas (RangoDeFechas reusable).", "1.5 h"],
                ["Acción 'Marcar como leída' por fila + botón 'Marcar todas como leídas' con confirmación. Optimistic update: el badge baja al instante, rollback si el UPDATE falla.", "1 h"],
                ["PBI-S5-E02: en DrawerSolicitud del admin, agregar botón 'Ver auditoría' que abre /admin/auditoria con query params entidad=solicitud&amp;entidad_id={id}.", "1 h"],
                ["Extracción de RangoDeFechas (acción 2 Retro Sprint 5) a src/components/shared/RangoDeFechas.tsx; refactor en /admin/auditoria + uso en /notificaciones.", "0.5 h"],
            ],
            [5.5 * inch, 1.0 * inch],
            styles,
        )
    )

    s.append(Paragraph("Cortez Zamora Leonardo — PBI-S3-E01 + PBI-S4-E01 + PBI-S5-E03 (3.5 h)", styles["H3"]))
    s.append(
        grid_table(
            tarea_header,
            [
                ["Extender SeccionActualizarEstado del técnico: al pasar a 'resuelta' habilitar UploadFoto opcional (mismo flujo que rechazo Sprint 5) bajo carpeta 'cierre/'. Vista de detalle renderiza foto original y foto de cierre lado a lado.", "1.5 h"],
                ["PBI-S4-E01: extender trigger after_solicitud_estado_changed para que, cuando estado_nuevo='en_progreso' y origen='rechazo_residente', se inserte una notificación adicional dirigida a TODOS los admin activos del edificio (tipo='alerta_rechazo').", "1 h"],
                ["PBI-S5-E03: agregar pestaña 'Seguridad' en /perfil con formulario de cambio de contraseña (actual + nueva + confirmación). Reauth con signInWithPassword antes de updateUser. Rate limit de 3 intentos cada 5 min.", "1 h"],
            ],
            [5.5 * inch, 1.0 * inch],
            styles,
        )
    )
    s.append(Spacer(1, 10))

    # Riesgos
    s.append(Paragraph("Riesgos del Sprint 6", styles["H2"]))
    risk_header = ["#", "Riesgo", "Prob.", "Impacto", "Mitigación"]
    risk_rows = [
        [
            "R1",
            "El canal Realtime de Supabase puede tener latencia inesperada o desconexiones en redes WiFi inestables (escenario del residente con mal WiFi en casa).",
            Paragraph("● Media", styles["WarnLabel"]),
            Paragraph("● Alto", styles["FailLabel"]),
            "Reconexión exponencial (1s, 2s, 4s, 8s, máx 30s) implementada en useNotificaciones(). Al recuperar conexión, hacer fetch de notificaciones perdidas (últimas 5 min) por REST.",
        ],
        [
            "R2",
            "Resend free tier solo permite 100 emails/día. Si el seed o las pruebas envían más, los emails reales empiezan a fallar.",
            Paragraph("● Media", styles["WarnLabel"]),
            Paragraph("● Medio", styles["WarnLabel"]),
            "Modo dry-run por defecto en local y CI (sin RESEND_API_KEY). Solo el deploy de staging tiene la clave real. Edge Function logguea conteo diario y deshabilita envíos si > 80.",
        ],
        [
            "R3",
            "El trigger after_solicitud_estado_changed podría disparar múltiples notificaciones si el helper cambiarEstadoSolicitud() hace UPDATEs intermedios.",
            Paragraph("● Baja", styles["OkLabel"]),
            Paragraph("● Alto", styles["FailLabel"]),
            "Test de integración explícito: una sola llamada a cambiarEstadoSolicitud() genera exactamente 1 fila en notificaciones. Si falla, ajustar trigger con condición WHEN.",
        ],
        [
            "R4",
            "La foto de cierre podría duplicar el peso del bucket si el técnico siempre la sube — 5MB × 2 fotos por solicitud × 47 solicitudes = ~470MB.",
            Paragraph("● Baja", styles["OkLabel"]),
            Paragraph("● Bajo", styles["OkLabel"]),
            "Foto opcional. Recordar al técnico el límite. Documentar política de retención (limpieza de fotos > 12 meses) como deuda para Sprint 11.",
        ],
        [
            "R5",
            "Reauth para cambio de contraseña podría dejar al usuario en estado 'PASSWORD_RECOVERY' si interpretamos mal el evento de Supabase.",
            Paragraph("● Media", styles["WarnLabel"]),
            Paragraph("● Alto", styles["FailLabel"]),
            "No usar onAuthStateChange en el flujo: hacer signInWithPassword silencioso y descartar la sesión nueva (la actual sigue válida). Test de integración: tras cambio de contraseña, el usuario sigue logueado.",
        ],
        [
            "R6",
            "Acumulación de notificaciones no leídas sin TTL podría inflar la tabla en pocos meses.",
            Paragraph("● Baja", styles["OkLabel"]),
            Paragraph("● Bajo", styles["OkLabel"]),
            "Documentar en docs/notificaciones.md que en Sprint 11 (privacidad) se añade política de retención: notificaciones leídas se purgan a los 90 días, no leídas a los 180. Por ahora sin límite.",
        ],
    ]
    s.append(
        grid_table(
            risk_header,
            risk_rows,
            [0.4 * inch, 2.2 * inch, 0.7 * inch, 0.7 * inch, 2.9 * inch],
            styles,
        )
    )
    s.append(Spacer(1, 10))
    s.append(PageBreak())

    # ── 2. DAILY SCRUMS ────────────────────────────────────────────────────
    s.append(section_banner("2   REGISTRO DE DAILY SCRUMS", styles))
    s.append(Spacer(1, 14))
    s.append(
        Paragraph(
            "Referencia Scrum: la Daily Scrum inspecciona el progreso hacia el Sprint Goal y "
            "adapta el Sprint Backlog. Duración máxima: 15 minutos.",
            styles["Note"],
        )
    )
    s.append(Spacer(1, 6))
    s.append(quote_box(
        'Sprint Goal: "Cerrar la comunicación: Realtime + email simulado · centro de notificaciones · '
            'foto de cierre técnico · alerta admin en rechazo · emergentes Sprint 5."',
        styles,
    ))

    s.append(Paragraph("Daily Scrum — Día 1 (Lunes)", styles["H2"]))
    s.append(
        info_table(
            [
                ("DÍA", "Lunes — Día 1"),
                (
                    "Progreso hacia el objetivo",
                    "Acciones del Sprint 5 Retro verificadas: (1) tabla audit_acciones esqueleteada "
                    "como migración 006 con las 21 acciones del Sprint 5 ya poblando; (2) componente "
                    "RangoDeFechas extraído y compilando — pendiente refactorizar 2 sitios; (3) "
                    "Refinement del viernes pasado dejó los 7 PBIs con criterios completos, cero "
                    "preguntas abiertas. Aplicando feedback del PO al usar canales Realtime, se "
                    "decide un canal por usuario (no global) para minimizar tráfico.",
                ),
                (
                    "Plan siguiente 24h",
                    "Gonza Morales: migración del trigger after_solicitud_estado_changed + esqueleto "
                    "de useNotificaciones() con suscripción Realtime y log en consola. Santiago "
                    "Flores: scaffolding de CampanaNotificaciones con badge mockeado. Cortez Zamora: "
                    "extender SeccionActualizarEstado con upload opcional.",
                ),
                (
                    "Impedimentos",
                    "Ninguno — el Refinement previo eliminó los bloqueos de criterios.",
                ),
                ("Ajuste Sprint Backlog", "Sin cambios."),
            ],
            styles,
        )
    )

    s.append(Paragraph("Daily Scrum — Día 2 (Martes)", styles["H2"]))
    s.append(
        info_table(
            [
                ("DÍA", "Martes — Día 2"),
                (
                    "Progreso hacia el objetivo",
                    "Trigger funcionando: cualquier cambio de estado vía cambiarEstadoSolicitud() "
                    "inserta una fila en notificaciones para el destinatario correcto (residente "
                    "si es admin/técnico el actor, técnico si fue asignación, admin si fue rechazo). "
                    "CampanaNotificaciones renderiza badge en vivo: probado con dos navegadores "
                    "(Carlos y Laura) y la campana de Laura suma un '1' cuando Mario actualiza ZIT-002. "
                    "Foto de cierre lista en frontend, falta la lógica de path + render lado a lado.",
                ),
                (
                    "Plan siguiente 24h",
                    "Gonza Morales: Edge Function notificar-cambio-estado en modo dry-run + tests del "
                    "helper. Santiago Flores: dropdown de la campana con últimas 10 notificaciones + "
                    "página /notificaciones con paginación + PBI-S5-E02. Cortez Zamora: render "
                    "antes/después en vista de detalle + PBI-S4-E01 (notificación al admin) + "
                    "comenzar PBI-S5-E03.",
                ),
                (
                    "Impedimentos",
                    "Al actualizar el estado de una solicitud, Realtime entrega el evento dos veces "
                    "en el listener del residente porque el componente DrawerDetalle también "
                    "suscribe al mismo canal por su cuenta. Acordamos centralizar la suscripción en "
                    "AuthContext (único punto, único oyente, broadcast interno por contexto).",
                ),
                (
                    "Ajuste Sprint Backlog",
                    "Se agrega 'tarea técnica' implícita en PBI-12: mover suscripción Realtime a "
                    "NotificacionesContext (1 h, Gonza Morales). Saldrá del buffer de 2h.",
                ),
            ],
            styles,
        )
    )

    s.append(Paragraph("Daily Scrum — Día 3 (Miércoles)", styles["H2"]))
    s.append(
        info_table(
            [
                ("DÍA", "Miércoles — Día 3"),
                (
                    "Progreso hacia el objetivo",
                    "Flujo end-to-end demostrable en dos navegadores: Mario marca ZIT-005 como "
                    "resuelta con foto del antes/después, Laura recibe la notificación en su campana "
                    "en < 1.5 segundos, abre el detalle y ve las dos fotos. PBI-S5-E03 funcional: "
                    "Laura cambia su contraseña desde /perfil/seguridad sin perder sesión. "
                    "PBI-S5-E02 listo: el botón 'Ver auditoría' del drawer abre /admin/auditoria "
                    "pre-filtrada por entidad_id. CI verde con cobertura 68% en "
                    "src/lib/notificaciones.ts (objetivo ≥ 60%). Email simulado en dry-run logguea "
                    "el HTML correctamente.",
                ),
                (
                    "Plan siguiente 24h",
                    "Santiago Flores: guión de Sprint Review con dos navegadores en pantalla "
                    "compartida para mostrar Realtime en vivo. Gonza Morales: pulir mensajes de "
                    "error de Realtime (reconexión) + revisar checklist OWASP A02 y A07 para los "
                    "nuevos endpoints. Cortez Zamora: validación visual de antes/después en móvil "
                    "(viewport < 640px, ambas fotos apiladas).",
                ),
                (
                    "Impedimentos",
                    "El profesor preguntó si podemos mostrar 'quién está conectado en este momento' "
                    "(presencia en Realtime). Está fuera del scope pero técnicamente posible con "
                    "Supabase Presence.",
                ),
                (
                    "Ajuste Sprint Backlog",
                    "Sin cambios. Presencia no entra al Sprint 6. PO la agrega como PBI emergente "
                    "para discutir en Review.",
                ),
            ],
            styles,
        )
    )
    s.append(PageBreak())

    # ── 3. SPRINT REVIEW ───────────────────────────────────────────────────
    s.append(section_banner("3   ACTA DE SPRINT REVIEW", styles))
    s.append(Spacer(1, 14))
    s.append(
        Paragraph(
            "Referencia Scrum: la Sprint Review inspecciona el resultado del Sprint y determina "
            "adaptaciones futuras. Es una sesión de trabajo, no una presentación.",
            styles["Note"],
        )
    )
    s.append(
        info_table(
            [
                ("Sprint", "Sprint 6 — Semana 8"),
                ("Fecha", "Viernes — cierre de semana 8"),
                ("Duración", "55 minutos"),
                ("Facilitador", "Alvarez Rocca Jaqueline (PO)"),
                (
                    "Scrum Team",
                    "Alvarez Rocca Jaqueline (PO), Meza Pelaez Carlos (SM), Cortez Zamora Leonardo, "
                    "Gonza Morales Yoel, Santiago Flores Carlos",
                ),
                (
                    "Stakeholders",
                    "Laura Vega (Residente ficticia), Mario Peña (Técnico ficticio), Carlos Fuentes "
                    "(Admin ficticio), Profesor del curso",
                ),
                (
                    "Incremento presentado",
                    "Notificaciones Realtime en los 3 dashboards · Email simulado (modo dry-run) en "
                    "Edge Function · Centro de notificaciones (/notificaciones) + campana en navbar "
                    "con badge · Foto antes/después en el cierre del técnico · Alerta a admin en "
                    "rechazo · Botón 'Ver auditoría' en drawer · Cambio de contraseña desde /perfil.",
                ),
                (
                    "Modalidad de demo",
                    "Dos navegadores lado a lado en pantalla compartida (Laura/residente vs "
                    "Carlos/admin) para evidenciar la naturaleza tiempo-real del incremento.",
                ),
            ],
            styles,
        )
    )

    s.append(Paragraph("Guión de demostración", styles["H2"]))
    demo = [
        "Carlos Fuentes (admin, navegador izquierdo) asigna ZIT-008 a Mario Peña. En el navegador "
        "derecho, Mario ve aparecer la notificación 'Nueva solicitud asignada' con badge '+1' en "
        "su campana, en aproximadamente 1.2 segundos. La fila aparece resaltada en su lista de "
        "asignadas.",
        "Mario abre la solicitud, pasa a 'en_progreso' (nota: 'Voy en camino con repuestos'). "
        "Laura Vega (residente, segundo monitor) ve la notificación 'Tu solicitud ZIT-008 pasó a "
        "en_progreso' con tooltip mostrando la nota del técnico.",
        "Mario marca la solicitud como 'resuelta'. En el formulario añade nota obligatoria (≥ 20 "
        "chars) y por primera vez sube la foto del 'después' (mostrando el grifo arreglado). El "
        "campo de la cámara móvil se ve gris hasta que dispara con capture='environment'.",
        "En la vista de detalle de Laura, la solicitud ahora muestra dos miniaturas lado a lado: "
        "'Antes' (foto que ella subió al crear) y 'Después' (foto que Mario acaba de subir al "
        "cerrar). Click en cualquiera abre el lightbox.",
        "Laura rechaza la solución desde 'Pendientes de tu confirmación' (nota: 'El grifo gotea "
        "menos pero todavía gotea, mirá la foto'). En la pantalla de Carlos aparece "
        "instantáneamente la alerta 'Laura Vega rechazó ZIT-008 (intento 1/3)' — primera vez que "
        "el admin se entera sin tener que refrescar.",
        "Email simulado: el log de la Edge Function muestra el HTML del email que se le habría "
        "enviado a Laura (cambio de estado a en_progreso). Modo dry-run intencional: en staging "
        "real con RESEND_API_KEY configurado, llegaría a su bandeja.",
        "Laura abre /perfil > Seguridad y cambia su contraseña. Sigue logueada (la sesión actual "
        "no se invalida). En el siguiente login, la contraseña vieja ya no funciona.",
        "Carlos abre el drawer de ZIT-008 y hace click en 'Ver auditoría'. Se abre /admin/auditoria "
        "pre-filtrada por entidad=solicitud, entidad_id=ZIT-008. La tabla muestra 6 entradas: "
        "crear, asignar, actualizar_estado x3 (pendiente→asignada→en_progreso→resuelta), rechazar.",
        "Centro de notificaciones: Laura abre /notificaciones, ve 4 entradas no leídas, hace click "
        "en 'Marcar todas como leídas' — el badge baja a 0 instantáneamente, con confirmación "
        "visual. La campana de la navbar refleja el cambio.",
    ]
    for i, step in enumerate(demo, start=1):
        s.append(Paragraph(f"<b>{i}.</b> {step}", styles["BodyLeft"]))
    s.append(Spacer(1, 8))

    s.append(Paragraph("Revisión del Sprint Goal", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "✓ <b>CUMPLIDO:</b> notificaciones Realtime activas en los 3 dashboards · email simulado "
            "(dry-run) operativo · centro de notificaciones con marcar como leída · foto de cierre "
            "antes/después · alerta admin al rechazo · emergentes Sprint 5 (E02, E03) resueltos. "
            "<b>DoD v2 al 78%</b> (mismo nivel que Sprints 4 y 5: los 2 criterios pendientes — /health "
            "y verificación post-deploy — se cierran en Sprint 8 como CD).",
        styles,
    ))
    s.append(Spacer(1, 6))

    s.append(Paragraph("Feedback de stakeholders", styles["H2"]))

    s.append(Paragraph("Profesor del curso", styles["H3"]))
    for bullet in [
        '"Excelente demo con dos navegadores en paralelo. La latencia &lt; 1.5 segundos demuestra '
        'que el Realtime está bien implementado, no es un mock." → Validación.',
        '"¿Podríamos tener una vista de presencia (quién está conectado ahora mismo)? '
        'Supabase Presence lo soporta nativamente." → PBI-S6-E01: \'Indicador de presencia '
        '(activo / inactivo) por usuario en el panel admin\'. P3, 2h. Sprint 12 (hardening, '
        'requiere medición de carga primero).',
        '"El email en modo dry-run es prudente, pero para la demo final del Sprint 14 '
        'esperaría ver un correo real llegando a una bandeja del equipo." → Tarea de '
        'configuración: probar RESEND_API_KEY contra un dominio del equipo entre Sprints 7 y 8.',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Laura Vega (Residente)", styles["H3"]))
    for bullet in [
        '"Ver la foto del antes/después al lado es muy útil — ya no tengo que recordar cómo '
        'estaba el grifo antes de mandarlo a arreglar." → Validación.',
        '"La campana es bonita pero a veces se me pasan notificaciones porque no hace ningún '
        'sonido. ¿Podría sonar o vibrar en móvil?" → PBI-S6-E02: \'Sonido + haptic feedback '
        'opcional al recibir notificación (con toggle en preferencias)\'. P3, 2h. Sprint 12.',
        '"El cambio de contraseña funciona, pero después de cambiarla no me dice si las '
        'sesiones de otros dispositivos siguen abiertas." → PBI-S6-E03: \'Mostrar sesiones '
        'activas + cerrar todas al cambiar contraseña\'. P2, 2h. Sprint 11 (privacidad).',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Mario Peña (Técnico)", styles["H3"]))
    for bullet in [
        '"La foto del antes/después me ayuda a documentar mi trabajo. Antes solo tenía nota; '
        'ahora puedo mostrar el resultado." → Validación.',
        '"Me llega notificación cuando se me asigna, pero también me gustaría una resumida '
        'al inicio del día con todo lo pendiente — para no tener que abrir el panel." → '
        'PBI-S6-E04: \'Resumen diario por email a las 7am con asignaciones pendientes del '
        'técnico\'. P3, 2h. Sprint 13 (observabilidad).',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Paragraph("Carlos Fuentes (Administrador)", styles["H3"]))
    for bullet in [
        '"La alerta al rechazo es exactamente lo que faltaba. Ahora me entero al instante en lugar '
        'de descubrirlo al día siguiente revisando solicitudes." → Validación.',
        '"El botón \'Ver auditoría\' desde el drawer me ahorra mucho tiempo. Es perfecto." → '
        'Validación.',
    ]:
        s.append(Paragraph(f"• {bullet}", styles["Body"]))

    s.append(Spacer(1, 6))

    # Decisiones backlog
    s.append(Paragraph("Decisiones de adaptación del Product Backlog", styles["H2"]))
    dec_review_header = ["Decisión", "Detalle"]
    dec_review_rows = [
        ["Sin hotfix en sprint", "Cero hotfixes durante el Sprint — primera vez. Atribuido al Refinement previo (acción 3 del Retro Sprint 5)."],
        ["PBI-S6-E01 (NUEVA)", "Indicador de presencia (activo/inactivo) en panel admin con Supabase Presence — P3, 2h, Sprint 12."],
        ["PBI-S6-E02 (NUEVA)", "Sonido + haptic feedback opcional al recibir notificación (con toggle de preferencias) — P3, 2h, Sprint 12."],
        ["PBI-S6-E03 (NUEVA)", "Mostrar sesiones activas + cerrar todas al cambiar contraseña — P2, 2h, Sprint 11."],
        ["PBI-S6-E04 (NUEVA)", "Resumen diario por email a técnicos con asignaciones pendientes — P3, 2h, Sprint 13."],
        ["Configuración Resend", "Probar RESEND_API_KEY real contra dominio del equipo entre Sprints 7 y 8 — chore, 0.5h, Sprint 7."],
        ["Sprint 7 confirmado", "Calidad: Playwright + suite E2E (3 flujos críticos) + threat model + checklist OWASP top 10 completo + soporte HEIC en UploadFoto."],
    ]
    s.append(
        grid_table(
            dec_review_header,
            dec_review_rows,
            [1.6 * inch, 5.0 * inch],
            styles,
        )
    )
    s.append(PageBreak())

    # ── 4. RETROSPECTIVE ───────────────────────────────────────────────────
    s.append(section_banner("4   ACTA DE SPRINT RETROSPECTIVE", styles))
    s.append(Spacer(1, 14))
    s.append(
        Paragraph(
            "Referencia Scrum: la Retrospective planifica formas de aumentar calidad y "
            "efectividad. Los cambios más impactantes pueden entrar al Sprint Backlog del próximo Sprint.",
            styles["Note"],
        )
    )
    s.append(
        info_table(
            [
                ("Sprint", "Sprint 6 — Semana 8"),
                ("Fecha", "Viernes — después de la Sprint Review"),
                ("Duración", "30 minutos"),
                ("Facilitador", "Meza Pelaez Carlos (Scrum Master)"),
                ("Participantes", "Todo el Scrum Team (PO + SM + Developers)"),
            ],
            styles,
        )
    )

    s.append(Paragraph("✓ ¿Qué salió bien?", styles["H2"]))
    for line in [
        "Las 3 acciones del Sprint 5 Retro entregaron resultados visibles: (1) audit_acciones eliminó la duplicación catálogo TS/SQL; "
        "(2) RangoDeFechas se reusó en 2 vistas (auditoría y notificaciones) en un Sprint, validando el principio de extracción; "
        "(3) el Refinement de 30 min previo al Planning resultó en CERO hotfixes durante el Sprint (vs 1 en Sprint 5).",
        "La demo con dos navegadores en paralelo fue la más impactante hasta ahora — el profesor la mencionó explícitamente "
        "como evidencia de que el sistema 'se siente real'.",
        "Centralizar la suscripción Realtime en NotificacionesContext en lugar de tenerla en cada componente eliminó "
        "duplicación de eventos y simplificó el código. Decisión tomada en Daily de día 2, no fue planificada.",
        "DoD v2 cumplida sin sorpresas: 68% de cobertura en src/lib/notificaciones.ts (objetivo ≥ 60%), checklist OWASP "
        "A01/A02/A03/A07 verificada para los nuevos endpoints (A02 nueva: gestión de credenciales en cambio de contraseña).",
        "PBI-12 era el ítem más voluminoso del backlog (4h) y se cerró sin desbordes — el equipo aprendió a estimar mejor "
        "tareas con infraestructura nueva (Realtime) basándose en la experiencia del Sprint 4 con cámara móvil.",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("✗ ¿Qué salió mal?", styles["H2"]))
    for line in [
        "Detectamos la duplicación de eventos Realtime recién al Día 2 cuando ya había código escrito. Si hubiéramos "
        "diseñado el contexto antes de codear, ahorramos 1 hora de buffer. Falta un paso de diseño explícito antes de "
        "implementar lógica con efectos colaterales.",
        "El modo dry-run del email es funcional pero el equipo nunca probó el envío real (no se quiso quemar el cupo "
        "de Resend free tier). Hay riesgo de que en Sprint 14 descubramos que la plantilla HTML se ve mal en algún "
        "cliente de correo.",
        "Las pruebas de Realtime se hicieron manualmente con dos navegadores — no hay test automatizado que verifique "
        "que un cambio de estado dispara una notificación en un cliente conectado. Vitest no es el lugar; Playwright "
        "será la herramienta (Sprint 7).",
    ]:
        s.append(Paragraph(f"• {line}", styles["Body"]))

    s.append(Paragraph("Acciones de mejora (máx. 3)", styles["H2"]))
    actions = [
        (
            "Acción 1 — Diseño explícito antes de codear lógica con efectos",
            "Antes de empezar a implementar cualquier PBI que involucre triggers, suscripciones, cache "
            "o lógica entre componentes, el responsable redacta una nota de 5-10 líneas (en el PR como "
            "comentario inicial o en /docs/decisiones/) describiendo el flujo de datos. Esto previene "
            "duplicaciones como la detectada en Day 2 con Realtime.",
            "Cortez Zamora Leonardo (rotativo cada Sprint)",
            "Cada PBI con etiqueta 'logic-flow' (definida por el SM en el Planning) tiene una nota de diseño en su PR antes del primer commit",
            "Desde Sprint 7",
        ),
        (
            "Acción 2 — Prueba real de email en staging antes de Sprint 14",
            "Como chore aislado en Sprint 7 (0.5h, Gonza Morales), enviar 1 email real desde staging "
            "con RESEND_API_KEY configurada hacia 3 cuentas del equipo (Gmail, Outlook, ProtonMail). "
            "Validar que la plantilla HTML se ve correcta y que no cae en spam. Documentar resultado "
            "en docs/notificaciones.md.",
            "Gonza Morales Yoel",
            "Sección 'Prueba de email real' añadida a docs/notificaciones.md con 3 screenshots",
            "Sprint 7",
        ),
        (
            "Acción 3 — Test E2E de Realtime en Sprint 7",
            "Al instalar Playwright (PBI-19), incluir un test E2E que abra 2 contextos del navegador, "
            "logue uno como admin y otro como residente, dispare un cambio de estado en el contexto "
            "admin y verifique que la notificación aparece en el contexto residente en &lt; 3 segundos.",
            "Santiago Flores Carlos",
            "Test e2e/notificaciones-realtime.spec.ts pasando en CI",
            "Sprint 7",
        ),
    ]
    for title, desc, owner, evidence, when in actions:
        s.append(Paragraph(title, styles["H3"]))
        s.append(
            info_table(
                [
                    ("Descripción", desc),
                    ("Dueño", owner),
                    ("Evidencia", evidence),
                    ("Fecha", when),
                ],
                styles,
            )
        )
        s.append(Spacer(1, 4))

    s.append(Paragraph("Verificación DoD v2", styles["H2"]))
    dod_header = ["Criterio", "Estado"]
    dod_rows = [
        ["Todo lo de DoD v1 (lint, unit tests, README, manejo errores, seed, deploy preview)", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Pruebas de integración para flujos críticos (notificaciones: insertar, suscripción, marcar leída)", Paragraph("✓ CUMPLIDO — 7 tests integración nuevos", styles["OkLabel"])],
        ["Cobertura ≥ 60% en módulo src/lib/notificaciones.ts", Paragraph("✓ CUMPLIDO — 68% al cierre", styles["OkLabel"])],
        ["Endpoint /health disponible en staging", Paragraph("■ Pendiente — planificado Sprint 8 (CD)", styles["WarnLabel"])],
        ["Checklist OWASP aplicada a cambios relevantes", Paragraph("✓ CUMPLIDO — A01 (notif por usuario_id con RLS), A02 (reauth en cambio de contraseña con rate limit), A03 (Edge Function sanitiza HTML), A07 (suscripción Realtime requiere JWT válido)", styles["OkLabel"])],
        ["Variables de entorno via Secrets CI/CD — sin hardcode", Paragraph("✓ CUMPLIDO — RESEND_FROM_ADDRESS añadida a GitHub Secrets y Vercel", styles["OkLabel"])],
        ["Despliegue staging con verificación post-deploy", Paragraph("■ Pendiente — planificado Sprint 8 (CD)", styles["WarnLabel"])],
        ["tsc --noEmit pasa sin errores en CI", Paragraph("✓ CUMPLIDO", styles["OkLabel"])],
        ["Documento /docs/notificaciones.md con arquitectura Realtime + dry-run", Paragraph("✓ CUMPLIDO — adicional a DoD v2", styles["OkLabel"])],
        ["ADR-009 documentado (Realtime: canal por usuario, no global)", Paragraph("✓ CUMPLIDO — adicional a DoD v2", styles["OkLabel"])],
    ]
    s.append(grid_table(dod_header, dod_rows, [4.6 * inch, 2.0 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "<b>DoD v2 CUMPLIDA AL 78%</b> (7/9 criterios — tercer Sprint consecutivo en el mismo nivel). "
            "Los 2 criterios pendientes (/health + verificación post-deploy) se cierran en Sprint 8 "
            "(CD a staging). Sprint 6 cerrado correctamente sin uso del buffer de 2 horas — primera "
            "vez que esto sucede en el proyecto.",
        styles,
    ))
    s.append(PageBreak())

    # ── 5. HISTORIAS DE USUARIO ────────────────────────────────────────────
    s.append(section_banner("5   HISTORIAS DE USUARIO — SPRINT 6", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Módulo NOTIFICACIONES — Sprint 6", styles["H2"]))

    s.append(
        hu_card(
            "PBI-12 · Notificaciones Supabase Realtime + email simulado",
            "Realtime + email transaccional al cambio de estado",
            "Sprint 6 · 4 h",
            "P1 · 4 h",
            "Como <b>residente / técnico / admin</b>, quiero <b>recibir una notificación en tiempo real y un "
            "email cuando el estado de una solicitud relevante para mí cambie</b>, para enterarme sin tener "
            "que refrescar el panel.",
            [
                "Tabla notificaciones con (id, usuario_id, solicitud_id, tipo, mensaje, leida, created_at) + RLS: cada usuario solo SELECT/UPDATE sus filas.",
                "Trigger after_solicitud_estado_changed inserta 1 fila por destinatario relevante: residente cuando admin/técnico cambia su solicitud, técnico cuando es asignado, admin cuando residente rechaza.",
                "Suscripción Realtime centralizada en NotificacionesContext: una sola conexión al canal 'notificaciones:{auth.uid()}' por sesión. Reconexión exponencial (1s, 2s, 4s, 8s, máx 30s).",
                "Edge Function notificar-cambio-estado: llama a Resend con plantilla HTML mínima. Modo dry-run automático si falta RESEND_API_KEY (responde 200 y logguea cuerpo).",
                "Test de integración: un solo cambiarEstadoSolicitud() inserta exactamente 1 notificación por destinatario válido.",
                "Si Resend responde 4xx/5xx, NO se revierte el cambio de estado (fire-and-forget) — el error queda en logs de la Edge Function.",
            ],
            "Demostrado en Sprint 6 Review con dos navegadores: Mario actualiza ZIT-008, Laura ve la notificación en su campana en 1.2s. Email simulado dry-run muestra HTML correcto.",
            styles,
        )
    )

    s.append(
        hu_card(
            "HU-NOTIF-01 · Centro de notificaciones con campana en navbar",
            "Badge de no leídas + dropdown rápido + página completa",
            "Sprint 6 · 3 h",
            "P1 · 3 h",
            "Como <b>usuario activo (cualquier rol)</b>, quiero <b>ver un icono de campana en la navbar con la "
            "cantidad de notificaciones no leídas y poder abrir un dropdown con las últimas</b>, para enterarme "
            "rápidamente de cambios relevantes sin abandonar la pantalla actual.",
            [
                "Componente CampanaNotificaciones visible en la navbar de los 3 dashboards (admin, residente, técnico).",
                "Badge con número de no leídas (máx '99+'). Animación pulse suave cuando llega una nueva por Realtime.",
                "Dropdown con últimas 10 notificaciones ordenadas por created_at desc. Cada item: icono por tipo + mensaje + tiempo relativo. Click en item: navega al detalle de la solicitud y marca como leída.",
                "Link 'Ver todas' al final del dropdown que abre /notificaciones (página completa con paginación 25 filas/página + filtro de leídas + RangoDeFechas opcional).",
                "Si no hay notificaciones, estado vacío amigable con texto 'Aún no tienes notificaciones'.",
                "Responsiva: en móvil (< 640px) el dropdown ocupa el ancho completo de la pantalla.",
                "Accesible: dropdown navegable con teclado (Tab, Enter, Esc) y aria-live='polite' para anunciar nuevas notificaciones a lectores de pantalla.",
            ],
            "Laura cierra el dropdown, recibe una notificación nueva → badge sube a 5 con pulse, vuelve a abrir el dropdown y ve la nueva en la cima.",
            styles,
        )
    )

    s.append(
        hu_card(
            "HU-NOTIF-02 · Marcar notificación como leída · Marcar todas",
            "Actualización del campo leida con optimistic update",
            "Sprint 6 · 1.5 h",
            "P2 · 1.5 h",
            "Como <b>usuario activo</b>, quiero <b>poder marcar notificaciones individuales o todas como leídas</b>, "
            "para limpiar la lista y bajar el contador del badge cuando ya las atendí.",
            [
                "Acción 'Marcar como leída' por fila en /notificaciones (icono check) y al hacer click en el item del dropdown.",
                "Botón 'Marcar todas como leídas' visible solo si hay no leídas. Confirmación con modal: 'Esto marcará 12 notificaciones como leídas. ¿Continuar?'",
                "Optimistic update: la UI baja el badge y oscurece la fila inmediatamente. Si el UPDATE falla, rollback con toast de error.",
                "Una notificación leída no vuelve a contar en el badge ni dispara animación si llega un evento Realtime sobre ella.",
                "RLS: solo el propietario (usuarios.id = notificaciones.usuario_id) puede UPDATE leida.",
                "Marcar como leída NO se registra en audit_log (no es acción crítica por definición).",
            ],
            "Laura marca 4 notificaciones como leídas — el badge baja de 4 a 0 al instante. Verificado que Carlos no puede UPDATE notificaciones de Laura (RLS).",
            styles,
        )
    )

    s.append(
        hu_card(
            "PBI-S3-E01 · Foto de cierre por técnico (antes/después) ★",
            "Adjuntar foto al marcar resuelta + render lado a lado",
            "Sprint 6 · 1.5 h",
            "P2 · 1.5 h",
            "Como <b>técnico</b>, quiero <b>poder adjuntar una foto opcional del trabajo terminado al marcar la "
            "solicitud como resuelta</b>, para evidenciar visualmente el resultado y dar contexto al residente "
            "al confirmar.",
            [
                "SeccionActualizarEstado del técnico añade, cuando estado_destino='resuelta', un UploadFoto opcional bajo la nota.",
                "Mismo flujo de UploadFoto que el residente: capture='environment' en móvil, máx 5MB, JPEG/PNG, validarImagen() reutilizado.",
                "La foto se sube a bucket solicitudes-fotos bajo path {residente_id}/{solicitud_id}/cierre_{timestamp}_{nombre}.",
                "El path queda guardado en historial_estados.nota como sufijo `[cierre: <path>]` (mismo esquema que rechazo del Sprint 5).",
                "Vista de detalle (residente, admin, técnico) renderiza dos miniaturas lado a lado etiquetadas 'Antes' y 'Después' cuando ambas existen. En móvil se apilan verticalmente (viewport < 640px).",
                "Si no adjunta foto, el flujo de cierre sigue idéntico al del Sprint 4.",
            ],
            "Mario sube foto del grifo arreglado al cerrar ZIT-008. Laura ve antes/después en el detalle antes de confirmar.",
            styles,
            star=True,
        )
    )

    s.append(
        hu_card(
            "PBI-S4-E01 · Notificar al admin cuando residente rechaza ★",
            "Alerta inmediata a todos los admin del edificio",
            "Sprint 6 · 1 h",
            "P2 · 1 h",
            "Como <b>administrador</b>, quiero <b>recibir una notificación inmediata cuando cualquier residente "
            "rechaza la solución de un técnico</b>, para intervenir temprano y evitar que la solicitud escale "
            "innecesariamente al tercer rechazo.",
            [
                "Trigger after_solicitud_estado_changed se extiende: cuando estado_nuevo='en_progreso' y origen='rechazo_residente', inserta 1 fila adicional por cada usuario con rol=admin y estado_cuenta=activo.",
                "Tipo de la notificación: 'alerta_rechazo'. Mensaje: 'Laura Vega rechazó ZIT-008 (intento 1/3) — Mario Peña'.",
                "En el dropdown se muestra con icono de alerta naranja para distinguirla de notificaciones rutinarias.",
                "Click en la notificación abre el drawer de la solicitud rechazada directamente en /admin/solicitudes.",
                "La alerta se dispara también al primer rechazo (no solo al tercero) — Sprint 4 solo escalaba al tercero. Ahora hay visibilidad temprana.",
            ],
            "Laura rechaza ZIT-008 → Carlos recibe la alerta en su campana en 1.4s, abre el drawer y ve el motivo del rechazo + las dos fotos.",
            styles,
            star=True,
        )
    )

    s.append(
        hu_card(
            "PBI-S5-E02 · Botón 'Ver auditoría' en drawer de solicitud ★",
            "Filtro pre-aplicado del audit_log por entidad_id",
            "Sprint 6 · 1 h",
            "P2 · 1 h",
            "Como <b>administrador</b>, quiero <b>un botón en el drawer de cada solicitud que abra el audit_log "
            "filtrado solo por esa solicitud</b>, para ver el historial completo de acciones sin filtrar a mano "
            "por entidad_id.",
            [
                "Botón 'Ver auditoría' visible solo en DrawerSolicitud (admin) y solo si hay al menos 1 entrada de audit_log para esa solicitud.",
                "Click navega a /admin/auditoria?entidad=solicitud&amp;entidad_id={id}.",
                "La vista de auditoría reconoce los query params y aplica los filtros iniciales — no hay request adicional para descubrir el ID.",
                "El URL resultante es compartible: pegar el link en otra pestaña reproduce la misma vista filtrada.",
                "Tooltip en el botón: 'Ver las 6 acciones registradas para ZIT-008'.",
            ],
            "Carlos abre el drawer de ZIT-008, hace click en 'Ver auditoría' y ve la timeline completa: crear, asignar, 3 cambios de estado, rechazar.",
            styles,
            star=True,
        )
    )

    s.append(
        hu_card(
            "PBI-S5-E03 · Cambio de contraseña desde /perfil ★",
            "Pestaña Seguridad con reauth + rate limit",
            "Sprint 6 · 1 h",
            "P2 · 1 h",
            "Como <b>usuario activo</b>, quiero <b>cambiar mi contraseña desde la página de perfil sin pasar "
            "por el flujo de recuperación por email</b>, para hacerlo de forma directa cuando todavía conozco "
            "la actual.",
            [
                "Pestaña 'Seguridad' en /perfil con formulario: contraseña actual, nueva (mín 8 chars, debe incluir 1 número), confirmar nueva.",
                "Validaciones frontend: las dos contraseñas nuevas deben coincidir, la nueva no puede ser igual a la actual.",
                "Backend: reauth silencioso con supabase.auth.signInWithPassword({email, password: actual}). Si falla, error inline 'Contraseña actual incorrecta' sin tocar la cuenta.",
                "Si el reauth tiene éxito, supabase.auth.updateUser({password: nueva}). La sesión actual NO se invalida (el usuario sigue logueado).",
                "Rate limit: 3 intentos fallidos seguidos bloquean el formulario por 5 minutos (con countdown visual).",
                "OWASP A02 (Cryptographic Failures): la contraseña nueva nunca queda en logs ni en audit_log; el evento solo registra 'cambio_contrasena' sin payload.",
            ],
            "Laura cambia su contraseña en /perfil/seguridad sin perder sesión; al cerrar y volver a entrar, la antigua ya no funciona.",
            styles,
            star=True,
        )
    )

    s.append(Spacer(1, 6))

    # PBIs emergentes
    s.append(Paragraph("PBIs emergentes — entran en Sprints futuros", styles["H2"]))
    em_header = ["ID", "Historia", "Prior.", "Horas est.", "Sprint"]
    em_rows = [
        ["PBI-S6-E01", "Indicador de presencia (activo / inactivo) por usuario en panel admin con Supabase Presence", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S6-E02", "Sonido + haptic feedback opcional al recibir notificación (con toggle en preferencias)", Paragraph("● P3", styles["OkLabel"]), "2 h", "12"],
        ["PBI-S6-E03", "Mostrar sesiones activas + cerrar todas al cambiar contraseña", Paragraph("● P2", styles["WarnLabel"]), "2 h", "11"],
        ["PBI-S6-E04", "Resumen diario por email a técnicos con asignaciones pendientes (cron 7am)", Paragraph("● P3", styles["OkLabel"]), "2 h", "13"],
    ]
    s.append(grid_table(em_header, em_rows, [1.1 * inch, 3.0 * inch, 0.7 * inch, 0.8 * inch, 0.7 * inch], styles))
    s.append(PageBreak())

    # ── 6. ESTADO DEL BACKLOG ──────────────────────────────────────────────
    s.append(section_banner("6   ESTADO DEL BACKLOG TRAS SPRINT 6", styles))
    s.append(Spacer(1, 14))
    s.append(Paragraph("Progreso acumulado", styles["H2"]))

    progress_header = ["Sprint", "Horas invertidas", "Incremento entregado", "Estado"]
    progress_rows = [
        ["Sprint 0", "12 h", "Setup técnico + CI/CD + ADRs base + Supabase configurado", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 1", "15 h", "Módulo Auth: registro 2 pasos, activación, login por rol, recuperación", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 2", "14 h", "BD modelada · Panel admin · Gestión de usuarios · Bloqueo/desbloqueo", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 3", "13 h", "Módulo Mantenimiento v1: crear solicitud con foto + vista admin", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 4", "13 h", "Mantenimiento v2: asignación + vista técnico + cierre + cámara móvil + confirmación residente", Paragraph("✓ Completado", styles["OkLabel"])],
        ["Sprint 5", "13 h", "Trazabilidad: audit log completo + vista admin con filtros + helper centralizado + notas obligatorias + perfil editable + carga técnico + foto rechazo", Paragraph("✓ Completado", styles["OkLabel"])],
        [
            "Sprint 6",
            "13 h",
            "Comunicación: Realtime en 3 dashboards + email simulado + centro de notificaciones + foto cierre técnico antes/después + alerta admin rechazo + emergentes S5 (Ver auditoría, Cambio de contraseña)",
            Paragraph("✓ Completado", styles["OkLabel"]),
        ],
        ["Sprint 7", "13 h (est.)", "Calidad: Playwright + 3 E2E críticos + threat model + OWASP top 10 completo + soporte HEIC + prueba real de email", Paragraph("→ Próximo", styles["WarnLabel"])],
        ["Sprints 8–14", "91 h (est.)", "CD, métricas, Facturación, Tienda, hardening, performance, seguridad, Twilio", Paragraph("■ Pendiente", styles["WarnLabel"])],
    ]
    s.append(grid_table(progress_header, progress_rows, [0.85 * inch, 0.95 * inch, 3.8 * inch, 1.0 * inch], styles))

    s.append(
        Paragraph(
            "<b>Total invertido:</b> 93 horas en 7 sprints (Sprint 0 → Sprint 6).<br/>"
            "<b>Total restante:</b> 104 horas estimadas en 8 sprints.<br/>"
            "<b>Velocidad promedio:</b> 13.3 horas/sprint (estable por cuarto sprint consecutivo).",
            styles["Body"],
        )
    )
    s.append(Spacer(1, 8))

    s.append(Paragraph("Roadmap actualizado tras Sprint 6 Review", styles["H2"]))
    rm_header = ["Sprint", "Sem.", "Objetivo principal y nuevos módulos"]
    rm_rows = [
        ["Sprint 7", "9", "Calidad: Playwright instalado + suite E2E (crear/asignar/cerrar/Realtime) + threat model + checklist OWASP top 10 completo + soporte HEIC + prueba real de email"],
        ["Sprint 8", "10", "CD a staging: deploy automático + endpoint /health + smoke tests (cierra DoD v2 al 100%)"],
        ["Sprint 9", "11", "Métricas + CSV + Facturación v1 (HU-FACT-01, 02, 03 — BD + admin emite + residente ve)"],
        ["Sprint 10", "12", "Hardening + Facturación v2 (HU-FACT-04 cobros) + Tienda v1 + HU-MANT-08 timeline + PBI-S5-E01 dashboard carga"],
        ["Sprint 11", "13", "Privacidad reforzada + Tienda v2 (carrito + integración con factura mensual) + PBI-S6-E03 sesiones activas"],
        ["Sprint 12", "14", "Performance: Lighthouse + k6 + code splitting + PBI-S6-E01 presencia + PBI-S6-E02 sonido notificaciones"],
        ["Sprint 13", "15", "Seguridad y observabilidad: OWASP completo + logging estructurado + alertas Vercel + PBI-S6-E04 resumen diario"],
        ["Sprint 14", "16", "★ Twilio Verify + Release Candidate + demo final (incluye comunicación Realtime, Facturación y Tienda en demo)"],
    ]
    s.append(grid_table(rm_header, rm_rows, [0.85 * inch, 0.55 * inch, 5.2 * inch], styles))
    s.append(
        Paragraph(
            "Nota de adaptación del roadmap: el Sprint 6 cerró comunicación sin uso del buffer — "
            "el equipo entregó al 100% de la estimación con cero hotfixes. Los 4 emergentes (E01-E04) "
            "se reparten entre Sprints 11, 12 y 13, donde encajan temáticamente (privacidad / "
            "performance / observabilidad). Capacidad de cada sprint sigue siendo 13 h + 2 h de buffer.",
            styles["Note"],
        )
    )
    s.append(Spacer(1, 8))

    s.append(Paragraph("Vista previa Sprint 7 — Calidad y E2E", styles["H2"]))
    s.append(Spacer(1, 6))
    s.append(quote_box(
        "Sprint 7: Playwright instalado · Suite E2E con los 3 flujos críticos (crear, asignar, "
            "cerrar) + 1 escenario Realtime · Threat model + checklist OWASP top 10 completo · "
            "Soporte HEIC en UploadFoto · Prueba real de email (acción 2 Retro Sprint 6).",
        styles,
    ))
    preview_header = ["PBI", "Historia", "Horas est.", "Prior."]
    preview_rows = [
        ["PBI-19", "Playwright + suite E2E: crear solicitud, asignar, cerrar con confirmación", "4 h", Paragraph("● P1", styles["FailLabel"])],
        ["HU-E2E-01", "E2E Realtime: dos contextos, cambio de estado dispara notificación &lt; 3s", "2 h", Paragraph("● P1", styles["FailLabel"])],
        ["PBI-20", "Threat model ligero + checklist OWASP top 10 documentado en /docs/security/", "3 h", Paragraph("● P1", styles["FailLabel"])],
        ["PBI-S3-E02", "Soporte HEIC en UploadFoto (conversión automática a JPEG en cliente)", "2 h", Paragraph("● P2", styles["WarnLabel"])],
        ["Chore", "Prueba real de email en staging contra 3 cuentas (Gmail/Outlook/ProtonMail)", "0.5 h", Paragraph("● P2", styles["WarnLabel"])],
        ["Chore", "Documentar 'logic-flow' como etiqueta en PRs (acción 1 Retro Sprint 6)", "0.5 h", Paragraph("● P3", styles["OkLabel"])],
        ["Buffer", "Reservado para hallazgos del threat model que requieran fix inmediato", "1 h", Paragraph("● —", styles["WarnLabel"])],
    ]
    s.append(grid_table(preview_header, preview_rows, [1.1 * inch, 3.9 * inch, 0.8 * inch, 0.8 * inch], styles))
    s.append(Paragraph("<b>Total estimado Sprint 7:</b> 13 horas (1 h del buffer pre-reservada para hallazgos OWASP).", styles["Body"]))
    s.append(Spacer(1, 10))

    s.append(Paragraph("Variables de entorno acumuladas al Sprint 6", styles["H2"]))
    s.append(Paragraph("Una variable nueva en este Sprint (RESEND_FROM_ADDRESS); las anteriores siguen vigentes:", styles["Body"]))
    env_header = ["Variable", "Descripción", "Dónde se usa", "Desde Sprint"]
    env_rows = [
        ["VITE_SUPABASE_URL", "URL pública del proyecto Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["VITE_SUPABASE_ANON_KEY", "Clave anónima de Supabase", "Frontend (cliente JS) · test.env como dummy en CI", "Sprint 0"],
        ["SUPABASE_SERVICE_ROLE_KEY", "Clave de servicio (admin) de Supabase", "Edge Functions (servidor)", "Sprint 3"],
        ["RESEND_API_KEY", "Clave de API de Resend para emails", "Edge Functions (servidor)", "Sprint 2"],
        ["RESEND_FROM_ADDRESS", "Remitente del email simulado (default 'no-reply@zity.local' en dry-run)", "Edge Function notificar-cambio-estado", "Sprint 6"],
        ["SUPABASE_DB_URL", "URL de conexión directa a la BD", "Migraciones locales", "Sprint 0"],
    ]
    s.append(grid_table(env_header, env_rows, [1.9 * inch, 2.4 * inch, 1.6 * inch, 0.7 * inch], styles))
    s.append(Spacer(1, 6))
    s.append(
        Paragraph(
            "Variables proyectadas para futuros Sprints:<br/>"
            "• Sprint 8 (CD): VERCEL_TOKEN, VERCEL_ORG_ID, VERCEL_PROJECT_ID para deploy automático.<br/>"
            "• Sprint 14 (Twilio): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID.",
            styles["Body"],
        )
    )
    s.append(
        Paragraph(
            "Ninguna de estas variables debe aparecer en el código fuente ni en commits. "
            "Todas van en .env.local (local) y en Secrets de GitHub/Vercel (CI/CD).",
            styles["Note"],
        )
    )

    s.append(Spacer(1, 14))
    s.append(
        Paragraph(
            "— Zity · Artefactos Sprint 6 · Documento vivo — actualizar en cada Sprint Review —",
            styles["Footer"],
        )
    )

    return s


# ─── Entry point ──────────────────────────────────────────────────────────────


def main() -> None:
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "sprints")
    out_dir = os.path.normpath(out_dir)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "Zity_Sprint6_Artefactos.pdf")

    styles = build_styles()
    doc = make_doc(out_path)
    story = build_story(styles)
    doc.build(story)

    size_kb = os.path.getsize(out_path) / 1024
    print(f"Generado: {out_path}  ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
