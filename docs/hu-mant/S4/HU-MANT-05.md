# HU-MANT-05 · Historial de estados visible
**Sprint 4 · 2 h · P2**

---

## Historia de usuario

Como **residente, administrador o técnico**, quiero **ver el historial completo de cambios de estado de una solicitud con autor y fecha**, para entender la trazabilidad del trabajo y resolver dudas.

---

## User Review Required — Supabase

> [!IMPORTANT]
> **JOIN `historial_estados → usuarios` para obtener el autor**: la query nueva necesita un embed con la FK `cambiado_por` → `usuarios.id`. Debe existir la FK en Supabase:
> ```sql
> ALTER TABLE historial_estados
>   ADD CONSTRAINT historial_estados_cambiado_por_fkey
>   FOREIGN KEY (cambiado_por) REFERENCES usuarios(id);
> ```
> Si la FK no existe, PostgREST no puede resolver el embed y el componente solo mostrará "Sistema" como autor.

> [!IMPORTANT]
> **RLS en `historial_estados` — SELECT**: cada rol debe poder leer el historial de las solicitudes a las que tiene acceso:
> ```sql
> -- Admin: ve todo
> CREATE POLICY "Admin ve historial" ON historial_estados FOR SELECT
>   USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND rol = 'admin'));
>
> -- Residente: ve historial de sus solicitudes
> CREATE POLICY "Residente ve historial de sus solicitudes" ON historial_estados FOR SELECT
>   USING (solicitud_id IN (SELECT id FROM solicitudes WHERE residente_id = auth.uid()));
>
> -- Técnico: ve historial de sus asignaciones
> CREATE POLICY "Tecnico ve historial de sus asignaciones" ON historial_estados FOR SELECT
>   USING (solicitud_id IN (SELECT solicitud_id FROM asignaciones WHERE tecnico_id = auth.uid()));
> ```

> [!WARNING]
> **RLS en `usuarios` — SELECT para el JOIN de autor**: al resolver `autor:usuarios!historial_estados_cambiado_por_fkey(nombre, apellido, rol)`, PostgREST necesita que el usuario que hace la query pueda leer las columnas `nombre, apellido, rol` de la tabla `usuarios`. Si la RLS de `usuarios` solo permite al admin leer todos los registros, el residente/técnico podría no ver el nombre del autor. Opciones:
> - Agregar política SELECT restrictiva (solo nombre, apellido, rol) accesible para todos los usuarios autenticados
> - O mover a un RPC que devuelva datos sanitizados

> [!NOTE]
> **Paginación**: se cargan las primeras 10 entradas con `.range(0, 9)`. El botón "Ver más" carga las siguientes 10 concatenándolas. No se eliminan entradas previas del estado.

> [!NOTE]
> **Se asume** que `cambiado_por` puede ser `null` (cambios automáticos del sistema), en cuyo caso el componente muestra "Sistema" como autor.

---

## Criterios de aceptación

- [ ] Componente `HistorialEstados` reutilizable, mostrado en: drawer del admin, vista del residente, y vista del técnico.
- [ ] Cada entrada muestra: estado anterior → estado nuevo, autor (etiqueta de rol + nombre), fecha relativa ('hace 2 horas') + tooltip con fecha absoluta, nota si la hay.
- [ ] Visualización: línea de tiempo vertical con badges de color por estado.
- [ ] Política de privacidad del autor según rol del observador:
  - **Admin**: ve nombre completo de todos.
  - **Residente**: ve 'Tú', 'Admin', 'Técnico Mario P.'.
  - **Técnico**: ve 'Tú', 'Admin', 'Residente Laura V.'.
- [ ] Si la lista es larga (>10 entradas), se pagina con botón 'Ver más'.
- [ ] Estado vacío: si no hay cambios, muestra 'Sin cambios de estado registrados'.
- [ ] Performance: carga las últimas 10 entradas inicialmente, paginación bajo demanda.

---

## Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `src/hooks/useHistorialEstados.ts` | **NUEVO** — hook con embed de autor, paginación de 10 en 10 |
| `src/components/shared/HistorialEstados.tsx` | **NUEVO** — componente reutilizable con timeline vertical, badges, autor con privacidad por rol, tooltip fecha absoluta, paginación |
| `src/components/admin/solicitudes/DrawerSolicitud.tsx` | **MODIFICADO** — reemplaza historial inline por `<HistorialEstados>` |
| `src/components/tecnico/solicitudes/DrawerDetalleTecnico.tsx` | **MODIFICADO** — reemplaza historial inline por `<HistorialEstados>` |
| `src/pages/ResidenteDashboard.tsx` | **MODIFICADO** — añade drawer de detalle del residente con `<HistorialEstados>` |

---

## Notas de implementación

- El hook `useHistorialSolicitud` existente en `useSolicitudesAdmin.ts` sigue disponible pero los drawers ahora usan el nuevo `useHistorialEstados` que incluye datos de autor.
- La lógica de privacidad de autor está en el componente: recibe `rolObservador` y `userId`, y aplica las reglas de etiquetado sin exponer datos sensibles.
- El tooltip de fecha absoluta usa `title` nativo del HTML (sin librería extra).
- Todos los bloques nuevos llevan el comentario `// HU-MANT-05 SPRINT-4`.
