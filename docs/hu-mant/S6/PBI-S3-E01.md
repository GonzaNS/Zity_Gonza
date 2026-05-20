# PBI-S3-E01: Foto de cierre por técnico

## Historia de Usuario
**Como** técnico,
**Quiero** subir una foto como evidencia al marcar una solicitud como resuelta,
**Para** demostrar a los residentes y administradores que el trabajo se completó correctamente.

## Criterios de Aceptación
1. En la vista de detalle de solicitud, al seleccionar el estado "resuelta", aparece un campo opcional para adjuntar foto.
2. La foto debe validar que no supere los 5MB antes de subirla.
3. La imagen se guarda en el bucket `solicitudes-fotos` bajo el path: `{residente_id}/{solicitud_id}/cierre_{timestamp}_{nombre_seguro}`.
4. En el historial de estados de la solicitud, debe existir un panel que muestre el "Antes" (foto original si la hay) y el "Después" (la foto de cierre).
5. Las fotos de cierre en el historial se acceden mediante URLs firmadas (`createSignedUrl`) con 1 hora (3600s) de expiración.

## Decisiones Técnicas y Contexto
- **Almacenamiento de metadato**: Como la tabla `historial_solicitudes` solo tiene una columna `nota`, se decidió serializar el path de la foto dentro de la nota usando el formato `[cierre: path]`.
- **Rendimiento**: Las URLs firmadas del panel `FotosCierrePanel` solo se generan cuando el componente se renderiza para no hacer peticiones de más en historiales largos.
- **Transaccionalidad**: La subida de la foto ocurre *antes* del cambio de estado. Si falla la foto, el estado no cambia.

## Archivos Modificados
- `src/hooks/useSolicitudesTecnico.ts`: Se agregaron `subirFotoCierre`, `serializarNotaCierre` y `parsearNotaCierre`.
- `src/components/tecnico/solicitudes/SeccionActualizarEstado.tsx`: Se incluyó el componente `UploadFoto` si el destino es `resuelta`.
- `src/components/shared/HistorialEstados.tsx`: Se integró el parseo de notas de cierre.
- `src/components/tecnico/solicitudes/FotosCierrePanel.tsx`: Componente nuevo para mostrar el antes y después.
- `src/components/tecnico/solicitudes/DrawerDetalleTecnico.tsx`: Paso de properties `residenteId` y `fotoOriginalUrl`.

## Notas de Implementación (Mitigantes)
- **Privacidad y Expiración**: La URL de la foto de cierre se firma por 1 hora, mitigando accesos indeseados permanentes en caso de fuga del enlace.
- **Sanitización**: Los nombres de archivo se sanitizan removiendo caracteres no alfanuméricos mediante regex en `subirFotoCierre` previniendo inyecciones de path.
