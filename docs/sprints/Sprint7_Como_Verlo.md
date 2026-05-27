# Cómo ver lo implementado del Sprint 7

Una guía sencilla — en palabras simples — para que puedas ver con tus propios ojos cada una de las features del Sprint 7 ("Métricas y Dashboard visual"). Pensada para alguien que llega nuevo al repo o que quiere validar la entrega sin necesidad de leer código.

> [!TIP]
> Si solo tienes 2 minutos: salta a [**El recorrido de 5 pasos**](#el-recorrido-de-5-pasos) más abajo.

---

## ¿Qué te entregó el Sprint 7?

El Sprint 7 le dio al **administrador** del edificio un **panel de métricas**. Antes de este sprint, el admin podía ver las solicitudes una por una pero no tenía una vista de "cómo va el edificio en general". Ahora abre una pantalla y de un vistazo ve:

- Cuántas solicitudes tiene en total, cuántas pendientes y cuántas resolvió hoy.
- Cuánto tarda en promedio en resolver una solicitud.
- Una gráfica de barras con qué tipo de problemas son más comunes.
- Una gráfica de líneas que muestra si el equipo está mejorando o empeorando con el tiempo.
- Un top 5 de las categorías más reportadas (plomería, electricidad, etc.).
- Un botón para **exportar las solicitudes a CSV** (para abrir en Excel).

Además, internamente se montó una **vista materializada** en la base de datos (un cache que se refresca cada hora) para que el panel cargue rápido aunque haya miles de solicitudes, y se instaló **Playwright** para empezar a tener tests automáticos del navegador.

---

## Antes de empezar — qué necesitas tener listo

1. **Node.js 24+** instalado.
2. **Un archivo `.env`** en la raíz del repo con tus credenciales de Supabase (mira `.env.example` para la plantilla).
3. **La base de datos sembrada.** Esto crea los usuarios de demo (Carlos admin, Laura residente, Mario técnico, etc.) y solicitudes de ejemplo.

```bash
npm install
npm run seed:clean      # poblar la BD con datos de demo (sobreescribe lo existente)
npm run dev             # arranca la app en http://localhost:5173
```

> [!NOTE]
> Si nunca corriste el seed, ejecuta `npm run seed` (sin `:clean`). El `:clean` borra y reinserta — úsalo si quieres un estado fresco para presentar.

> [!IMPORTANT]
> Para que la **vista materializada** y `pg_cron` funcionen, hay que activar la extensión en Supabase **una sola vez**. Mira [`docs/setup-supabase.md`](../setup-supabase.md) — son 3 clics y un SQL.

---

## El recorrido de 5 pasos

### 1. Abre el panel de métricas

1. Abre `http://localhost:5173/login`.
2. Login como **admin**: `carlos@zity-demo.com` / `Admin1234!`.
3. Ya en `/admin`, en el sidebar izquierdo, da clic en **"Métricas"** (o entra directamente a `http://localhost:5173/admin/metricas`).

**Lo que deberías ver:**

- Arriba, **4 tarjetas grandes** con números: Total acumulado, Pendientes, En proceso, Resueltas hoy.
- Una sección **"Tiempo promedio de resolución"** con 3 filas: AVG, Mediana (P50), Percentil 95.
- Debajo, **3 gráficas**: barras horizontales por tipo, top 5 categorías (lista), y una gráfica de líneas a todo lo ancho.
- Arriba a la derecha, un botón **"Refrescar"** y un texto "Actualizado HH:MM:SS".

**Cosas para probar tú mismo:**

- **Refresh automático:** quédate en el panel 60 segundos sin hacer nada. La hora "Actualizado HH:MM:SS" va a cambiar sola.
- **Pausa en background:** cambia de pestaña 2 minutos, vuelve. Verás que la hora salta a la actual (refresca al volver). El panel **no consume cuota mientras estás en otra pestaña**.
- **Casos de borde:** si la BD tiene 0 ó 1 solicitud resuelta, el P95 muestra "Sin datos suficientes" (no rompe).
- **Tooltips de las gráficas:** pasa el cursor por una barra o un punto de la línea. Aparece una caja blanca con el valor exacto.
- **Responsive:** abre las DevTools (F12), modo móvil. Las gráficas se apilan verticalmente y la de líneas tiene scroll horizontal.

### 2. Exporta solicitudes a CSV

Esto está en el dashboard principal del admin (`/admin`, no en `/admin/metricas`).

1. Vuelve a `/admin` (Dashboard).
2. Arriba a la derecha verás un botón **"Exportar CSV"**.
3. Clic → se abre un popover con un selector "Desde" / "Hasta".
4. Elige un rango (por ejemplo, "hace 30 días" hasta hoy).
5. Clic en **"Descargar"**. Se baja un archivo `solicitudes_<desde>_<hasta>.csv`.
6. **Ábrelo en Excel** (o Google Sheets, o LibreOffice). Las columnas deberían leerse:

```
ID Solicitud, Estado, Tipo, Categoría, Fecha Creación, Fecha Actualización, Nombre Residente
```

**Lo importante:** los acentos (`Categoría`, `Creación`) salen bien. Antes del Sprint 7 con archivos UTF-8 puros, Excel rompía los acentos. Ahora lleva un BOM (Byte Order Mark) al inicio del archivo que le dice a Excel "soy UTF-8".

### 3. Verifica que solo el admin puede entrar

1. Cierra sesión.
2. Login como **residente**: `laura@zity-demo.com` / `Residente1!`.
3. Intenta abrir manualmente `http://localhost:5173/admin/metricas` en la barra del navegador.
4. **Deberías ser redirigido a `/residente`** (su panel). El sistema sabe que un residente no puede ver el panel del admin.

(Lo mismo si intentas llamar el RPC `get_metricas_mantenimiento()` con un token que no sea admin — el servidor lo rechaza con error 42501.)

### 4. Ver la vista materializada en la base de datos

(Opcional, pero está bueno verlo para entender la performance.)

En el SQL Editor de Supabase:

```sql
-- Esta es la "fila única" con todo precalculado
SELECT
  tiempos_resolucion,
  jsonb_array_length(por_tipo)        AS num_tipos,
  jsonb_array_length(top_categorias)  AS num_categorias,
  jsonb_array_length(tendencia_mensual) AS num_meses,
  refreshed_at
FROM vw_metricas_solicitudes;
```

Vas a ver un JSON con AVG/mediana/P95 ya calculados, y la fecha del último `REFRESH`. Eso es lo que sirve los datos a tu panel en ~20 ms (vs. 600 ms si tuviera que recalcular).

Para ver el cron job (si lo activaste según `docs/setup-supabase.md`):

```sql
SELECT jobname, schedule, command FROM cron.job;
```

### 5. Corre el primer E2E con Playwright

Este es el **chore técnico** del Sprint 7 — la "semilla" de la suite E2E.

```bash
# (Una sola vez) descarga Chromium
npm run test:e2e:install

# Cada vez que quieras correr el E2E
npm run test:e2e
```

Lo que va a pasar:

1. Playwright arranca un Chromium **sin ventana visible** (modo headless).
2. Navega a `/login`, hace login como Laura.
3. Aterriza en `/residente`, clic en **"Nueva solicitud"**.
4. Llena el formulario (tipo, categoría, descripción, foto dummy).
5. Submit, espera la pantalla de confirmación con el código.
6. Cierra el modal y verifica que la solicitud aparece en "Mis solicitudes".
7. Termina en verde. Toma ~10-15 segundos.

> [!WARNING]
> Cada corrida del E2E **crea una solicitud real** en la BD (con la foto dummy de 70 bytes). Si haces muchas corridas, ejecuta `npm run seed:clean` para limpiar.

**Si quieres verlo "en vivo":**

```bash
npx playwright test --headed
```

Esto abre el browser y verás todo el flujo paso a paso. Es muy útil para la demo del Sprint Review.

**Si algo falla:**

```bash
npx playwright show-report
```

Abre un HTML con screenshots y traces del fallo.

---

## ¿Dónde está cada archivo importante?

Si quieres bucear el código, esto te orienta:

| Lo que buscas | Dónde está |
|---|---|
| Vista `/admin/metricas` (toda la página) | `src/pages/admin/Metricas.tsx` |
| Las 3 gráficas Recharts | `src/components/admin/GraficasMetricas.tsx` |
| Las fórmulas AVG/mediana/P95 (puras, testeables) | `src/lib/metricas.ts` |
| Los 29 tests unitarios de las fórmulas | `src/test/admin/metricas.test.ts` |
| El popover de "Exportar CSV" | `src/components/admin/PopoverExportarCSV.tsx` |
| Hook que llama al RPC + refresca cada 60s | `src/hooks/useMetricasMantenimiento.ts` |
| RPC SQL `get_metricas_mantenimiento` | `supabase/migrations/20260526183900_sprint7_metricas_mantenimiento.sql` |
| RPC SQL `get_graficas_mantenimiento` | `supabase/migrations/20260526190700_sprint7_graficas_mantenimiento.sql` |
| RPC SQL `export_solicitudes_csv` | `supabase/migrations/20260526201500_sprint7_export_csv.sql` |
| Vista materializada + `pg_cron` + fallback | `supabase/migrations/20260527010000_sprint7_vw_metricas_solicitudes.sql` |
| Config de Playwright | `playwright.config.ts` |
| El primer E2E (crear solicitud) | `e2e/tests/crear-solicitud.spec.ts` |
| Workflow CI de E2E | `.github/workflows/e2e.yml` |
| ADR-006 (decisión Recharts) | `docs/adr/006-recharts.md` |
| Documentación de fórmulas y CSV | `docs/metricas.md` |
| Cómo activar `pg_cron` en Supabase | `docs/setup-supabase.md` |
| Cómo correr y escribir E2E | `docs/testing/e2e.md` |

---

## Chequeo rápido (checklist)

Cuando termines el recorrido de los 5 pasos, deberías poder marcar todo esto:

- [ ] Veo las 4 tarjetas KPI con números reales.
- [ ] El panel se refresca solo cada 60 segundos.
- [ ] Pausa cuando estoy en otra pestaña (no consume cuota).
- [ ] Las 3 gráficas Recharts se muestran con la paleta Zity (azul + dorado).
- [ ] Los tooltips funcionan al pasar el cursor.
- [ ] En móvil las gráficas se apilan verticalmente.
- [ ] El botón "Exportar CSV" baja un archivo y Excel abre los acentos correctamente.
- [ ] Si me logueo como residente, no puedo entrar a `/admin/metricas`.
- [ ] `vw_metricas_solicitudes` existe en la BD y tiene `refreshed_at` reciente.
- [ ] `npm run test:e2e` corre y termina en verde.

Si todos están marcados, el Sprint 7 está al 100% verificado de tu lado.

---

## Si algo no funciona

| Síntoma | Causa probable | Solución |
|---|---|---|
| Panel vacío o "Sin datos suficientes" en todas las tarjetas | BD sin solicitudes resueltas | Corre `npm run seed:clean` para sembrar datos de demo |
| Gráficas no aparecen, solo skeletons | Falló la carga del chunk de Recharts | F12 → Network → recarga; si hay 404 del chunk, `npm run build` y reinicia el dev server |
| "Error al cargar los contadores de métricas" | Migración no aplicada o JWT sin rol admin | Verifica que las migraciones del Sprint 7 corrieron y que tu sesión es del admin Carlos |
| CSV se baja con caracteres raros | El navegador o Excel está usando otro encoding | Confirma que el archivo empieza con BOM (abre en VSCode); abre con "Importar texto" en Excel si persiste |
| `npm run test:e2e` falla en login | Credenciales E2E_RESIDENTE_* incorrectas | Verifica que Laura existe en la BD con `Residente1!` (o pasa tus propias creds por env vars) |
| El cron horario no refresca la vista | `pg_cron` no activado en Supabase | Sigue [`docs/setup-supabase.md`](../setup-supabase.md) — son 3 clics |

---

## Para la Sprint Review / demo

Si vas a presentar este sprint, este es el guión sugerido (50 segundos):

> "Carlos, el administrador, abre `/admin/metricas`. Ve **102 solicitudes totales**, **8 pendientes**, **5 en proceso** y **3 resueltas hoy**. El tiempo promedio de resolución es de 18.4 horas, la mediana 12.1 horas — la diferencia me dice que hay outliers. La gráfica de barras muestra que **Mantenimiento** es el tipo más reportado. La de líneas indica que el equipo bajó el tiempo de resolución en los últimos 3 meses. Voy a exportar las solicitudes del último mes a CSV [clic], y lo abro en Excel — los acentos salen bien. Adicionalmente, el chore técnico del sprint instaló Playwright; este es el primer E2E que se queda como semilla para los próximos sprints [muestra el workflow verde en GitHub]."

Eso cierra el Sprint 7 al 100%. ¡Listo!
