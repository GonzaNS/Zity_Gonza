# Zity · Supabase Storage

> Política y operación del almacenamiento de archivos en Zity. Aplicado a partir del Sprint 3 (ADR-005).

## Buckets activos

| Bucket | Visibilidad | MIME permitidos | Tamaño máx. | Sprint |
|---|---|---|---|---|
| `solicitudes-fotos` | Privado | `image/jpeg`, `image/png` | 5 MB | 3 |
| `productos-fotos` | Privado | `image/jpeg`, `image/png` | 2 MB | 10 |

## Naming convention

```
{residente_id}/{solicitud_id}/{timestamp}_{nombre_original_seguro}
```

El primer segmento es siempre el `auth.uid()` de quien sube el archivo. Las storage policies de INSERT validan exactamente este segmento contra `auth.uid()::text`, por lo que un residente no puede subir a la carpeta de otro.

El nombre original se "satiniza": minúsculas, espacios y caracteres no alfanuméricos se convierten en guiones. La función `pathFotoSolicitud` en `src/lib/solicitudes.ts` es la única fuente de verdad para construir paths.

## URLs firmadas

El bucket es privado. Para mostrar imágenes en la UI, la app genera URLs firmadas con `createSignedUrls(paths, 3600)` — caducidad de 1 hora. La función helper `useFotosFirmadas(paths)` (en `src/hooks/useSolicitudes.ts`) refirma automáticamente cuando cambia el conjunto de paths.

```ts
import { useFotosFirmadas } from '../hooks/useSolicitudes'

const fotosUrls = useFotosFirmadas(solicitudes.map(s => s.imagen_url))
// fotosUrls.get(solicitudes[0].imagen_url) → URL firmada (string)
```

## Storage policies

Habilitadas por la migration `sprint3_storage_solicitudes_fotos_bucket`:

| Policy | Comando | Roles | Filtro |
|---|---|---|---|
| `solicitudes_fotos_insert_propio` | INSERT | authenticated | `bucket_id='solicitudes-fotos' AND foldername(name)[1] = auth.uid()::text` |
| `solicitudes_fotos_select_authenticated` | SELECT | authenticated | `bucket_id='solicitudes-fotos'` |
| `solicitudes_fotos_delete_admin_o_dueno` | DELETE | authenticated | `bucket_id='solicitudes-fotos' AND (rol='admin' OR foldername(name)[1] = auth.uid()::text)` |

La policy de SELECT es deliberadamente abierta a authenticated dentro del bucket: el control real de privacidad lo proveen:

1. La caducidad de las URLs firmadas (1 hora).
2. El RLS de `public.solicitudes`, que filtra qué solicitudes puede ver cada rol antes de que la app pida firmar URLs.

## Bucket `productos-fotos` (Sprint 10 · Tienda)

Fotos del catálogo de la tienda. Reusa el patrón de `solicitudes-fotos` con dos
diferencias: el límite es **2 MB** y **solo el admin escribe** (las sube desde
`/admin/tienda`), por lo que las policies validan el **rol**, no la carpeta del
usuario.

**Naming:** `{producto_id}/{timestamp}_{nombre_seguro}` — la fuente de verdad es
`pathFotoProducto` en `src/lib/tienda.ts`. `productos.imagen_url` guarda el
**path** (no la URL pública); se firma al mostrar con `createSignedUrls(paths, 3600)`.

A diferencia de `solicitudes-fotos` (creado a mano en el dashboard), este bucket
y sus policies se **versionan** en la migración `20260530150000_sprint10_tienda.sql`.

| Policy | Comando | Roles | Filtro |
|---|---|---|---|
| `productos_fotos_admin_insert` | INSERT | authenticated | `bucket_id='productos-fotos' AND get_user_rol()='admin'` |
| `productos_fotos_select_authenticated` | SELECT | authenticated | `bucket_id='productos-fotos'` |
| `productos_fotos_admin_update` | UPDATE | authenticated | `bucket_id='productos-fotos' AND get_user_rol()='admin'` |
| `productos_fotos_admin_delete` | DELETE | authenticated | `bucket_id='productos-fotos' AND get_user_rol()='admin'` |

La lectura es abierta a authenticated (residente y técnico ven el catálogo); el
control efectivo lo dan las URLs firmadas (1 h) y que solo el admin gestiona el
contenido. Sin foto → la UI muestra un placeholder.

## Configuración local

Para correr la app localmente con Storage:

1. Asegúrate de tener configuradas las variables en `.env`:

   ```
   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   ```

2. Verifica que el bucket existe en el dashboard de Supabase → Storage. Si no, aplica la migration `sprint3_storage_solicitudes_fotos_bucket` con `supabase db push` o vía MCP.

3. En desarrollo no es necesario subir imágenes reales: el seed (`npm run seed`) crea solicitudes ficticias usando URLs externas de `picsum.photos` directamente en `imagen_url`. Para una demo completa con archivo real subido al bucket, sube manualmente desde el dashboard una foto al path `demo/demo.jpg` y reemplaza el seed.

## Política de imágenes en staging y producción

**Documento académico — no se permite PII real.** Reglas estrictas:

- Las imágenes demo deben venir de `picsum.photos` (dominio público).
- **Prohibido** subir fotos reales del equipo o de personas identificables al bucket de staging mientras el proyecto sea académico.
- En caso de detectar una foto con PII, eliminarla inmediatamente y notificar al Scrum Master.

## Limpieza al eliminar solicitudes (futuro)

ADR-005 contempla limpieza automática de imágenes al eliminar la solicitud. Como la UI de borrado no existe aún (planificada Sprint 5+), no hay trigger activo. Cuando se implemente, será un `BEFORE DELETE` en `public.solicitudes` que llame a `storage.delete_object` para cada archivo del directorio `{residente_id}/{solicitud_id}/`.

## Soporte de formatos futuros

Sprint 7+ (PBI-S3-E02) añadirá soporte HEIC con conversión automática a JPEG en el frontend antes de subir. Por ahora, los archivos HEIC son rechazados con mensaje claro: "Formato no soportado. Usa JPEG o PNG.".
