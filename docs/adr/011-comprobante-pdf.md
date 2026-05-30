# ADR-011 · Comprobante PDF de factura pagada con `pdf-lib`

- **Estado:** Aceptada
- **Fecha:** 2026-05-29 (Sprint 9)
- **Contexto:** PBI-S8-E01

> **Nota de numeración:** el artefacto académico del Sprint 9 proyectó este ADR como
> "ADR-010"; se documenta como **ADR-011** porque el 010 quedó para el ciclo de cobro
> (ver [ADR-010](./010-ciclo-de-cobro-jobs.md)).

## Contexto

El residente pidió (Sprint 8, PBI-S8-E01) poder descargar un comprobante PDF de cada
factura pagada. Hay que decidir con qué librería y dónde se genera.

## Decisión 1 — `pdf-lib` en el cliente, no `reportlab`

El comprobante se genera **100% en el navegador con `pdf-lib`** (JS puro).

- **Por qué no `reportlab`** (proyectado en el roadmap original): es una librería de
  Python; el stack de runtime de Zity es JS/Deno (Vite + Edge Functions). `reportlab`
  no es viable sin añadir un runtime Python. Corrige la proyección del roadmap.
  Registrado también en `docs/conventions.md` §7.
- **Por qué en el cliente**: el PDF se arma con datos que ya pasaron por RLS (la fila
  de la factura que el residente ya ve). No hace falta un endpoint extra ni almacenar
  el archivo: se genera y descarga on-demand.

## Decisión 2 — La lógica se separa en una función pura testeable

- `construirComprobante(factura, residente)` (puro): arma los textos del comprobante y
  **lanza si la factura no está pagada** (R4). Testeable sin generar el binario.
- `generarComprobantePDF(...)`: usa `construirComprobante` + `pdf-lib` (logo, fuentes,
  desglose, sello `PAGADO`).
- `descargarComprobante(...)`: fetch del logo + `Blob` + descarga.

## Decisión 3 — El número del comprobante reusa el campo persistido

El comprobante imprime `factura.numero` (`F-YYYY-MM-NNN`) tal cual está en la BD; **no
se recalcula** (R7). Test: el número del comprobante coincide con el de la fila.

## Decisión 4 — Solo facturas pagadas, datos del propio residente

El botón "Descargar comprobante" solo aparece si `estado='pagada'`. Los datos provienen
del perfil del residente autenticado; la RLS garantiza que un residente no puede generar
el comprobante de otro (R4).

## Consecuencias

- ✅ Comprobante descargable sin backend extra ni almacenamiento.
- ✅ Lógica de contenido testeable de forma pura (número, método, sello).
- ✅ Coherencia con el stack JS (sin Python).
- ⚠️ El posicionamiento en `pdf-lib` es por coordenadas absolutas (curva inicial; el
  Retro S9 añadió "spike de librería nueva en el Refinement" como acción de mejora).
