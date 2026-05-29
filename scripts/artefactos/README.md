# Generadores de Artefactos Scrum (PDF)

Scripts que generan los PDFs de artefactos Scrum de Zity replicando el estilo del
`docs/sprints/Zity_Sprint8_Artefactos.pdf` (portada + 6 secciones: Planning,
Daily Scrums, Review, Retrospective, Historias de Usuario, Estado del Backlog).

## Archivos

| Archivo | Rol |
|---|---|
| `zity_artefactos.py` | Motor de render (reportlab): portada, barras de sección, tablas navy + zebra, cajas de Sprint Goal, tarjetas de Historia de Usuario, pie de página. API de bloques (`sec`, `meta`, `goal`, `table`, `hucard`, `dot`, …). |
| `sprint9.py` | Contenido del **Sprint 9 — Facturación v2**. |
| `sprint10.py` | Contenido del **Sprint 10 — Tienda interna v1**. |

## Regenerar

Desde esta carpeta:

```bash
python sprint9.py     # -> docs/sprints/Zity_Sprint9_Artefactos.pdf
python sprint10.py    # -> docs/sprints/Zity_Sprint10_Artefactos.pdf
```

## Requisitos

- **reportlab** (`pip install reportlab`).
- Fuente de cuerpo: **Arial** (`C:\Windows\Fonts\arial*.ttf`, presente en Windows).
- Fuente de símbolos: **DejaVu Sans** (para `★ ✓ ✗ ●`, que Arial no incluye). El
  motor la toma de la instalación de `matplotlib` si está disponible; si no,
  cae a Helvetica nativa para el cuerpo. Para forzar la disponibilidad:
  `pip install matplotlib`.

## Notas de contenido

- Son **documentos académicos con datos ficticios** (sin PII real).
- El contenido se deriva de `Zity_Roadmap_Sprints.pdf`, `Zity_PRD.md` y la
  continuidad con `Zity_Sprint8_Artefactos.pdf`.
- La numeración de ADR de esta serie de artefactos es **local** y continúa la
  secuencia del Sprint 8 evitando colisión con el registro canónico del PRD
  (ADR-001..008): S9 introduce ADR-009/010, S10 introduce ADR-011/012.
- Son "documento vivo": al cerrar cada Sprint Review se actualiza el script
  correspondiente y se vuelve a generar el PDF.
