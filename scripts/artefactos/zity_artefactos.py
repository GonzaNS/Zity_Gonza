# -*- coding: utf-8 -*-
"""
Motor de generación de PDFs de Artefactos Scrum de Zity (reportlab).

Replica el estilo del documento `docs/sprints/Zity_Sprint8_Artefactos.pdf`:
portada con título "Zity", barras de sección navy con acento lateral, tablas
con cabecera navy + zebra, cajas de Sprint Goal, tarjetas de Historia de Usuario
y pie de página corrido ("Zity · Artefactos Scrum · Sprint N" + "pág. N").

El contenido de cada sprint se describe como una lista de "bloques" usando los
helpers de la sección API (sec, meta, goal, table, hucard, ...). Ver
`sprint9.py` y `sprint10.py`.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, PageBreak,
)

# --------------------------------------------------------------------------- #
#  Paleta (tomada del Sprint 8)                                                #
# --------------------------------------------------------------------------- #
NAVY        = colors.HexColor("#22304F")   # barras de sección / cabeceras tabla
NAVY_ACCENT = colors.HexColor("#3D5A8A")   # acento lateral de las barras
GOAL_BG     = colors.HexColor("#EEF1F7")   # fondo caja Sprint Goal
META_LABEL  = colors.HexColor("#EDEFF3")   # fondo etiqueta de tablas meta
ZEBRA       = colors.HexColor("#F5F6F9")   # fila alterna de tablas
ROWLINE     = colors.HexColor("#DFE3EA")   # separadores horizontales suaves
TEXT        = colors.HexColor("#1A1A1A")
SUBTLE      = colors.HexColor("#6B7280")   # texto gris (notas, pie)
HU_TITLE_BG = colors.HexColor("#ECEEF2")   # celda título de tarjeta HU
HU_SIDE_BG  = colors.HexColor("#F8E7EA")   # celdas laterales (rosa) de tarjeta HU

RED   = colors.HexColor("#C2392F")   # P1 / Alta / Alto
AMBER = colors.HexColor("#C8862A")   # P2 / Media / Medio
GREEN = colors.HexColor("#3E7D3A")   # P3 / Baja / Bajo

CONTENT_W = letter[0] - 2 * 0.9 * inch  # ancho útil con márgenes de 0.9"

# --------------------------------------------------------------------------- #
#  Fuentes — Arial (cuerpo, igual que el Sprint 8) + DejaVu Sans (símbolos)    #
#  Arial no incluye ★ ✓ ✗; esos glifos se envuelven en la fuente de símbolos. #
# --------------------------------------------------------------------------- #
import os
import importlib.util
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase.pdfmetrics import registerFontFamily


def _module_exists(name):
    return importlib.util.find_spec(name) is not None


_WIN_FONTS = r"C:\Windows\Fonts"
_DEJAVU = os.path.join(
    os.path.dirname(importlib.util.find_spec("matplotlib").origin),
    "mpl-data", "fonts", "ttf", "DejaVuSans.ttf",
) if _module_exists("matplotlib") else None


def _register_fonts():
    arial = {
        "ZBody":            os.path.join(_WIN_FONTS, "arial.ttf"),
        "ZBody-Bold":       os.path.join(_WIN_FONTS, "arialbd.ttf"),
        "ZBody-Italic":     os.path.join(_WIN_FONTS, "ariali.ttf"),
        "ZBody-BoldItalic": os.path.join(_WIN_FONTS, "arialbi.ttf"),
    }
    if all(os.path.exists(p) for p in arial.values()):
        for name, path in arial.items():
            pdfmetrics.registerFont(TTFont(name, path))
        registerFontFamily("ZBody", normal="ZBody", bold="ZBody-Bold",
                            italic="ZBody-Italic", boldItalic="ZBody-BoldItalic")
        fonts = ("ZBody", "ZBody-Bold", "ZBody-Italic", "ZBody-BoldItalic")
    else:  # respaldo: Helvetica nativa
        fonts = ("Helvetica", "Helvetica-Bold", "Helvetica-Oblique",
                 "Helvetica-BoldOblique")
    sym = "ZBody"
    if _DEJAVU and os.path.exists(_DEJAVU):
        pdfmetrics.registerFont(TTFont("ZSym", _DEJAVU))
        sym = "ZSym"
    return fonts, sym


(FONT, FONT_B, FONT_I, FONT_BI), SYM = _register_fonts()

# --------------------------------------------------------------------------- #
#  Estilos de párrafo                                                          #
# --------------------------------------------------------------------------- #
def _ps(name, **kw):
    base = dict(fontName=FONT, fontSize=9.5, leading=13.5, textColor=TEXT)
    base.update(kw)
    return ParagraphStyle(name, **base)

ST = {
    "title":    _ps("title", fontName=FONT_B, fontSize=40, leading=44,
                    alignment=TA_CENTER, textColor=NAVY),
    "subtitle": _ps("subtitle", fontName=FONT, fontSize=19, leading=23,
                    alignment=TA_CENTER, textColor=NAVY),
    "coverdesc":_ps("coverdesc", fontName=FONT_I, fontSize=10.5,
                    leading=15, alignment=TA_CENTER, textColor=SUBTLE),
    "secnum":   _ps("secnum", fontName=FONT_B, fontSize=12.5, leading=15,
                    textColor=colors.white),
    "subhead":  _ps("subhead", fontName=FONT_B, fontSize=12, leading=15,
                    textColor=NAVY, spaceBefore=4, spaceAfter=2),
    "para":     _ps("para", alignment=TA_JUSTIFY, spaceAfter=3),
    "note":     _ps("note", fontName=FONT_I, fontSize=8.5, leading=12,
                    textColor=SUBTLE, spaceAfter=2, alignment=TA_JUSTIFY),
    "goal":     _ps("goal", fontName=FONT_BI, fontSize=11, leading=16,
                    alignment=TA_CENTER, textColor=NAVY),
    "bullet":   _ps("bullet", fontSize=9.5, leading=13.5, alignment=TA_JUSTIFY,
                    spaceAfter=3),
    "finalnote":_ps("finalnote", fontName=FONT_I, fontSize=9, leading=13,
                    alignment=TA_CENTER, textColor=SUBTLE),
    # celdas de tabla
    "th":       _ps("th", fontName=FONT_B, fontSize=8.5, leading=11,
                    textColor=colors.white),
    "td":       _ps("td", fontSize=8.5, leading=11.5),
    "td_label": _ps("td_label", fontName=FONT_B, fontSize=9, leading=12,
                    textColor=NAVY),
    # tarjeta HU
    "hu_title": _ps("hu_title", fontName=FONT_B, fontSize=9, leading=12,
                    textColor=NAVY),
    "hu_side":  _ps("hu_side", fontSize=8.5, leading=11, alignment=TA_CENTER,
                    textColor=colors.HexColor("#7A2E38")),
}

# --------------------------------------------------------------------------- #
#  Helpers de markup en línea                                                  #
# --------------------------------------------------------------------------- #
def _color(level):
    return {"P1": RED, "P2": AMBER, "P3": GREEN,
            "Alta": RED, "Media": AMBER, "Baja": GREEN,
            "Alto": RED, "Medio": AMBER, "Bajo": GREEN}.get(level, AMBER)

def dot(level, label=None):
    """'● P1' coloreado para celdas de prioridad/probabilidad/impacto."""
    txt = label if label is not None else level
    c = "#" + _color(level).hexval()[2:]
    return f'<font name="{SYM}" color="{c}">●</font> <font color="{c}"><b>{txt}</b></font>'

def dotline(level):
    """Punto coloreado + etiqueta (para columnas Prob./Impacto)."""
    c = "#" + _color(level).hexval()[2:]
    return f'<font name="{SYM}" color="{c}">●</font> <font color="{c}"><b>{level}</b></font>'


# Glifos que Arial no incluye → se renderizan con la fuente de símbolos (DejaVu).
def sym(ch):       return f'<font name="{SYM}">{ch}</font>'
def chk():         return f'<font name="{SYM}" color="#3E7D3A">✓</font>'
def xmk():         return f'<font name="{SYM}" color="#C2392F">✗</font>'
def star():        return f'<font name="{SYM}">★</font>'

# --------------------------------------------------------------------------- #
#  API de bloques — cada función devuelve un dict que el renderer entiende     #
# --------------------------------------------------------------------------- #
def cover(sprint, subtitle, desc, meta_rows, note="Documento vivo — se actualiza en cada Sprint Review"):
    return {"t": "cover", "sprint": sprint, "subtitle": subtitle, "desc": desc,
            "rows": meta_rows, "note": note}

def sec(n, title):                       return {"t": "sec", "n": str(n), "title": title}
def meta(rows):                          return {"t": "meta", "rows": rows}
def goal(text, prefix=None):             return {"t": "goal", "text": text, "prefix": prefix}
def note(text):                          return {"t": "note", "text": text}
def sub(text):                           return {"t": "sub", "text": text}
def para(text):                          return {"t": "para", "text": text}
def bullets(items, marker="■"):    return {"t": "bullets", "items": items, "marker": marker}
def numlist(items):                      return {"t": "numlist", "items": items}
def table(headers, rows, widths):        return {"t": "table", "headers": headers, "rows": rows, "widths": widths}
def spacer(h=8):                         return {"t": "spacer", "h": h}
def keep_next():                         return {"t": "keepnext"}
def finalnote(text):                     return {"t": "finalnote", "text": text}

def hucard(hu_id, title, sprint_tag, prio_tag, story, criterios, evidencia=None):
    return {"t": "hucard", "id": hu_id, "title": title, "sprint_tag": sprint_tag,
            "prio_tag": prio_tag, "story": story, "criterios": criterios,
            "evidencia": evidencia}

# --------------------------------------------------------------------------- #
#  Renderer                                                                    #
# --------------------------------------------------------------------------- #
def _P(text, style):
    return Paragraph(text, ST[style])

def _section_bar(n, title):
    t = Table([["", _P(f"{n} {title.upper()}", "secnum")]],
              colWidths=[6, CONTENT_W - 6], rowHeights=[28])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), NAVY_ACCENT),
        ("BACKGROUND", (1, 0), (1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 12),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t

def _goal_box(text, prefix=None):
    inner = f"<b>{prefix}</b> {text}" if prefix else text
    t = Table([["", _P(f'"{inner}"', "goal")]], colWidths=[6, CONTENT_W - 6])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), NAVY),
        ("BACKGROUND", (1, 0), (1, 0), GOAL_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (1, 0), (1, 0), 16), ("RIGHTPADDING", (1, 0), (1, 0), 16),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    return t

def _meta_table(rows):
    label_w = 1.75 * inch
    data = [[_P(k, "td_label"), _P(v, "td")] for k, v in rows]
    t = Table(data, colWidths=[label_w, CONTENT_W - label_w])
    style = [
        ("BACKGROUND", (0, 0), (0, -1), META_LABEL),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8), ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, ROWLINE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, ROWLINE),
    ]
    t.setStyle(TableStyle(style))
    return t

def _data_table(headers, rows, widths):
    widths = [w * inch for w in widths]
    head = [_P(h, "th") for h in headers]
    body = [[_P(c, "td") for c in r] for r in rows]
    data = [head] + body
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 1), (-1, -1), 0.5, ROWLINE),
    ]
    for i in range(1, len(data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(style))
    return t

def _hucard(b):
    # fila superior: título (gris) | sprint (rosa) | prioridad (rosa)
    w_title = CONTENT_W - 2.6 * inch
    head = Table(
        [[_P(f'<b>{b["id"]}</b> · {b["title"]}', "hu_title"),
          _P(b["sprint_tag"], "hu_side"),
          _P(b["prio_tag"], "hu_side")]],
        colWidths=[w_title, 1.3 * inch, 1.3 * inch])
    head.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), HU_TITLE_BG),
        ("BACKGROUND", (1, 0), (2, 0), HU_SIDE_BG),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    flow = [head, Spacer(1, 6), _P(b["story"], "para"), Spacer(1, 2),
            _P("Criterios de aceptación", "subhead")]
    for c in b["criterios"]:
        flow.append(_P(f'■&nbsp;&nbsp;{c}', "bullet"))
    if b.get("evidencia"):
        flow.append(Spacer(1, 3))
        flow.append(_P(f'<b><i>Evidencia:</i></b> <i>{b["evidencia"]}</i>', "note"))
    return KeepTogether(flow)

def _build_story(blocks):
    story = []
    pending_keep = False
    for b in blocks:
        t = b["t"]
        if t == "cover":
            story.append(Spacer(1, 1.1 * inch))
            story.append(_P("<u>Zity</u>", "title"))
            story.append(Spacer(1, 0.32 * inch))
            story.append(_P(b["subtitle"], "subtitle"))
            story.append(Spacer(1, 0.16 * inch))
            if b.get("desc"):
                story.append(_P(b["desc"], "coverdesc"))
            story.append(Spacer(1, 0.4 * inch))
            story.append(_meta_table(b["rows"]))
            story.append(Spacer(1, 0.3 * inch))
            story.append(_P(b["note"], "finalnote"))
        elif t == "sec":
            story.append(PageBreak())  # cada sección numerada abre página (como el S8)
            story.append(_section_bar(b["n"], b["title"]))
            story.append(Spacer(1, 12))
        elif t == "meta":
            story.append(_meta_table(b["rows"]))
            story.append(Spacer(1, 6))
        elif t == "goal":
            story.append(Spacer(1, 4))
            story.append(_goal_box(b["text"], b.get("prefix")))
            story.append(Spacer(1, 6))
        elif t == "note":
            story.append(_P(b["text"], "note"))
        elif t == "sub":
            story.append(Spacer(1, 8))
            story.append(_P(b["text"], "subhead"))
            story.append(Spacer(1, 2))
        elif t == "para":
            story.append(_P(b["text"], "para"))
        elif t == "bullets":
            for it in b["items"]:
                story.append(_P(f'{b["marker"]}&nbsp;&nbsp;{it}', "bullet"))
        elif t == "numlist":
            for i, it in enumerate(b["items"], 1):
                story.append(_P(f'<b>{i}.</b>&nbsp;&nbsp;{it}', "bullet"))
        elif t == "table":
            story.append(_data_table(b["headers"], b["rows"], b["widths"]))
            story.append(Spacer(1, 6))
        elif t == "hucard":
            story.append(Spacer(1, 6))
            story.append(_hucard(b))
            story.append(Spacer(1, 6))
        elif t == "spacer":
            story.append(Spacer(1, b["h"]))
        elif t == "keepnext":
            pending_keep = True
            continue
        elif t == "finalnote":
            story.append(Spacer(1, 14))
            story.append(_P(b["text"], "finalnote"))
        pending_keep = False
    return story


def _footer_factory(footer_label):
    bold, rest = "Zity", footer_label

    def _on_page(canvas, doc):
        canvas.saveState()
        x0 = 0.9 * inch
        x1 = letter[0] - 0.9 * inch
        y = 0.6 * inch
        canvas.setStrokeColor(ROWLINE)
        canvas.setLineWidth(0.5)
        canvas.line(x0, y + 10, x1, y + 10)
        canvas.setFillColor(NAVY)
        canvas.setFont(FONT_B, 8)
        canvas.drawString(x0, y, bold)
        wb = canvas.stringWidth(bold, FONT_B, 8)
        canvas.setFillColor(SUBTLE)
        canvas.setFont(FONT, 8)
        canvas.drawString(x0 + wb + 3, y, rest)
        canvas.drawRightString(x1, y, f"pág. {doc.page}")
        canvas.restoreState()
    return _on_page


def build_pdf(blocks, footer_label, out_path):
    """footer_label: texto tras 'Zity' en el pie, p.ej. ' · Artefactos Scrum · Sprint 9'."""
    doc = BaseDocTemplate(
        out_path, pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.8 * inch, bottomMargin=0.95 * inch,
        title="Zity — Artefactos Scrum", author="Equipo Zity",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin,
                  doc.width, doc.height, id="main")
    on_page = _footer_factory(footer_label)
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=on_page)])
    doc.build(_build_story(blocks))
    return out_path
