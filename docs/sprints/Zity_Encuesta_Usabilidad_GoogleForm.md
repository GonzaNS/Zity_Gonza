# Encuesta de usabilidad — Zity (contenido para Google Forms)

> **Mejora MP-03 del Sprint 10** (recomendación del profesor). Instrumento de
> validación de usabilidad tipo **SUS (System Usability Scale)**: 10 ítems en
> escala Likert 1–5 + 2 preguntas abiertas. Este archivo es el guion listo para
> copiar/pegar al crear el formulario en [Google Forms](https://forms.google.com).

---

## Cómo armarlo en Google Forms (3 pasos)

1. Crea un formulario nuevo y pega el **título** y la **descripción** de abajo.
2. **Sección 1**: una pregunta de *opción múltiple* (rol). **Sección 2**: 10
   preguntas tipo *escala lineal* de **1 a 5** (etiqueta 1 = «Totalmente en
   desacuerdo», 5 = «Totalmente de acuerdo»), todas **obligatorias**.
   **Sección 3**: 2 preguntas de *párrafo* (texto largo).
3. En *Configuración → Respuestas*, activa **recopilar correos = NO** (encuesta
   anónima, sin PII) y comparte el enlace público.

---

## Título

**Encuesta de usabilidad — Zity (gestión de tu edificio)**

## Descripción (encabezado del formulario)

Zity es una plataforma web para gestionar tu edificio: reportar y seguir
solicitudes de mantenimiento, recibir y **pagar tus facturas** (luz, agua,
pensión), comunicarte con la administración y comprar en la **tienda interna**.

Pruébalo en el enlace y cuéntanos qué tan fácil e intuitivo te resultó. Te
tomará unos **3 minutos**. Tus respuestas son **anónimas** y con fines
académicos.

**Enlace al sistema:** https://zity.vercel.app
*(reemplazar por la URL real de staging antes de difundir)*

---

## Sección 1 · Sobre ti

**1. ¿Con qué rol probaste Zity?** *(opción única)*

- [ ] Residente
- [ ] Administrador
- [ ] Técnico
- [ ] Solo exploré

---

## Sección 2 · Escala de usabilidad (SUS)

> Responde cada afirmación en una **escala de 1 a 5**, donde
> **1 = Totalmente en desacuerdo** y **5 = Totalmente de acuerdo**.

1. Creo que me gustaría usar Zity con frecuencia.
2. Encontré el sistema innecesariamente complejo.
3. Me pareció fácil de usar.
4. Creo que necesitaría ayuda de una persona técnica para poder usar Zity.
5. Las funciones del sistema (mantenimiento, facturas, tienda) están bien integradas.
6. Encontré demasiada inconsistencia en el sistema.
7. Imagino que la mayoría de la gente aprendería a usar Zity muy rápido.
8. Me pareció muy engorroso de usar.
9. Me sentí seguro/a al usar el sistema.
10. Necesité aprender muchas cosas antes de poder manejar Zity.

---

## Sección 3 · Preguntas abiertas

11. ¿Qué fue lo que te resultó más útil o lo que más te gustó? *(párrafo)*
12. ¿Qué cambiarías o mejorarías para que el sistema sea más fácil de usar? *(párrafo)*

---

## Cómo calcular el puntaje SUS (0–100)

A partir de las respuestas de la Sección 2 (ítems 1–10):

1. **Ítems impares** (1, 3, 5, 7, 9): a cada respuesta **réstale 1**.
2. **Ítems pares** (2, 4, 6, 8, 10): a cada respuesta **réstala de 5** (es decir, `5 − respuesta`).
3. **Suma** los 10 valores resultantes → rango **0 a 40**.
4. **Multiplica por 2.5** → puntaje final de **0 a 100**.

**Interpretación de referencia:** un SUS promedio de la industria es **≈ 68**.
Por encima de 68 = mejor que el promedio; por debajo = hay margen de mejora.
Promedia el SUS de todos los encuestados para obtener el puntaje del sistema y
repórtalo como evidencia de validación (S13/S14).
