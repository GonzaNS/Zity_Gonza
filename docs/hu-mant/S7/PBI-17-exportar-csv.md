# PBI-17 · Exportar solicitudes a CSV

## Descripción
Como administrador, quiero exportar las solicitudes de un rango de fechas a CSV, para llevar registros externos o procesar los datos en Excel/Sheets sin acceder a la base de datos.

## Arquitectura de Solución (Qué, Cómo y Por qué)

Para cumplir con el requerimiento de una generación en el servidor (`server-side`) ultrarrápida y evitar descargar cientos de registros en memoria del frontend para procesarlos en JavaScript, utilizamos el potente motor nativo de PostgREST de Supabase de la siguiente manera:

### 1. ¿Qué se usó?
* **PostgreSQL (RPC)**: Una función `export_solicitudes_csv` que en lugar de hacer un cálculo complejo, retorna una tabla estructurada (`RETURNS TABLE`) que mapea y formatea las columnas en la base de datos de forma directa y rápida (ej. usando `to_char` para ISO-8601 en la zona UTC).
* **Flujo CSV nativo de PostgREST**: Al final de la cadena, llamamos a `.csv()` en el cliente de JavaScript (`supabase.rpc(...).csv()`). Esto envía una cabecera `Accept: text/csv`. PostgREST, que está escrito en Haskell/C, intercepta esta petición, toma el resultado de nuestra tabla y serializa todo a formato CSV desde la base de datos *antes* de enviarlo por la red.
* **Codificación UTF-8 con BOM en Blob JS**: Un componente flotante `PopoverExportarCSV` que añade la cabecera mágica (Byte Order Mark) en JavaScript y despacha el archivo como un enlace de descarga nativo en el navegador.

### 2. ¿Cómo y por qué?
* **Por qué NO usamos `pg COPY a buffer` tradicional**: En PostgreSQL puro, `COPY ... TO STDOUT` es la forma más rápida de generar un CSV, pero el protocolo binario no puede viajar a través de un backend RESTful basado en HTTP como Supabase/PostgREST si se encadena dentro de una función PL/pgSQL directamente. Al usar el header `Accept: text/csv` de PostgREST, logramos el mismo resultado subyacente porque delegamos la conversión CSV al motor interno, garantizando velocidades increíbles y sin estrés de memoria para la interfaz web.
* **Por qué el UTF-8 BOM (`\uFEFF`)**: Excel en sistemas Windows (y en español) a menudo no lee correctamente los acentos y las eñes ("Categoría", "Residente") de archivos UTF-8 puros a menos que el archivo tenga una marca explícita al comienzo (`\uFEFF`). Añadir esto en el Blob soluciona este comportamiento y cumple el criterio "que Excel reconozca los acentos sin pasos manuales".
* **Seguridad (RLS)**: La función SQL usa `SECURITY DEFINER` para permitir consultar las tablas protegidas y emite un chequeo de rol usando el helper `public.get_user_rol()` (que lee `public.usuarios.rol` via `auth.uid()`), asegurando de manera absoluta que solo el rol `admin` pueda desencadenar esta exportación de datos masiva. ⚠️ Nota: la versión inicial usaba `auth.jwt() -> 'app_metadata' ->> 'rol'` que retornaba NULL en Zity — corregido en la migración `20260527030000_sprint7_hotfix_role_check.sql`.

---

## Cambios requeridos en Supabase ⚠️

> [!IMPORTANT]
> Ejecutar la migración SQL en Supabase SQL Editor antes de intentar descargar el archivo desde el dashboard.

### Migración a ejecutar

```
supabase/migrations/20260526201500_sprint7_export_csv.sql
```

Crea la función RPC `export_solicitudes_csv(f_inicio date, f_fin date)` que retorna los registros con los nombres exactos de columnas en español que se usarán como cabeceras en el archivo descargable.

---

## Archivos Creados / Modificados

#### [NEW] `supabase/migrations/20260526201500_sprint7_export_csv.sql`
Script de migración que crea la función en Supabase (retorno de tabla, verificación estricta de JWT `admin`).

#### [NEW] `src/components/admin/PopoverExportarCSV.tsx`
Componente interactivo del frontend.
* Controla el estado del popover flotante reutilizando el componente del S5 `RangoDeFechas`.
* Captura el string CSV del servidor y añade el modificador `BOM` para compatibilidad completa con Microsoft Excel.
* Gestiona la interfaz asíncrona de carga ("Generando...").

#### [MODIFY] `src/pages/AdminDashboard.tsx`
* Agrega `PopoverExportarCSV` a las opciones (`actions`) del `<AdminShell>`, colocando el botón convenientemente en la vista general del `/admin`.

---

## Criterios de Aceptación Verificados

| Criterio | Estado | Detalle |
|---|---|---|
| Botón 'Exportar CSV' en `/admin` con Popover y Rango de Fechas | ✅ | Reutiliza `RangoDeFechas.tsx`. Se agregó en `AdminDashboard`. |
| Generación server-side rápida | ✅ | PostgREST hace el parseo directo a CSV nativo en el backend. |
| Codificación UTF-8 con BOM para Excel | ✅ | Se añade `\uFEFF` manualmente al string binario (`Blob`). |
| Cabecera en español, fechas ISO-8601 | ✅ | Formateado directo en la query SQL (`to_char`). |
| Solo rol `admin` | ✅ | Verificación de claims en la función PL/pgSQL. |
| Nombre del archivo validado | ✅ | Formato `solicitudes_YYYY-MM-DD_YYYY-MM-DD.csv`. |
