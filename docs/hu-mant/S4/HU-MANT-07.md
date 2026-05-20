# HU-MANT-07 · Confirmación del residente al recibir solicitud resuelta
**Sprint 4 · 2 h · P1**

---

## Historia de usuario

Como **residente**, quiero **confirmar que el problema fue corregido (o rechazarlo si no lo fue)** antes de que la solicitud se cierre, para validar que el trabajo del técnico cumplió con mi expectativa.

---

## User Review Required — Supabase

> [!IMPORTANT]
> **Columnas nuevas en `solicitudes`**: esta HU requiere dos columnas que probablemente NO existen aún:
> ```sql
> ALTER TABLE solicitudes
>   ADD COLUMN confirmada_por_residente boolean NOT NULL DEFAULT false,
>   ADD COLUMN intentos_resolucion integer NOT NULL DEFAULT 0;
> ```
> Sin estas columnas, el hook devuelve error al intentar leer/actualizar los campos y la sección de confirmación no renderiza.

> [!IMPORTANT]
> **RLS en `solicitudes` — UPDATE para residente**: el residente solo puede actualizar `confirmada_por_residente` e `intentos_resolucion` de sus propias solicitudes:
> ```sql
> CREATE POLICY "Residente confirma/rechaza su solicitud resuelta"
>   ON solicitudes FOR UPDATE
>   USING (residente_id = auth.uid() AND estado = 'resuelta')
>   WITH CHECK (estado IN ('cerrada', 'en_progreso', 'pendiente'));
> ```
> Sin esta política, el UPDATE será bloqueado (RLS).

> [!IMPORTANT]
> **RLS en `historial_estados` — INSERT para residente**: el residente debe poder insertar entradas de historial al confirmar/rechazar:
> ```sql
> CREATE POLICY "Residente inserta historial de sus solicitudes"
>   ON historial_estados FOR INSERT
>   WITH CHECK (solicitud_id IN (
>     SELECT id FROM solicitudes WHERE residente_id = auth.uid()
>   ));
> ```

> [!WARNING]
> **Escalada (intentos >= 3)**: cuando `intentos_resolucion >= 3` el estado vuelve a `pendiente`. La HU menciona que "el admin recibe notificación" — esta notificación real se implementa en Sprint 6. Aquí solo se cambia el estado y se registra en `audit_log` con la acción `escalada_solicitud`.

> [!WARNING]
> **Transacción secuencial**: el flujo de confirmación/rechazo ejecuta UPDATE + INSERT historial + audit_log de forma secuencial (no atómica). Si el INSERT historial falla tras el UPDATE, el estado ya cambió. Se registra el error al usuario pero no se hace rollback del estado.

> [!NOTE]
> **`SOLICITUDES_COLUMNS`** en `useSolicitudes.ts` debe incluir los nuevos campos `confirmada_por_residente` e `intentos_resolucion` para que el tipo `Solicitud` sea consistente con la BD.

---

## Flujo de confirmación

```
Técnico → resuelta
    └→ Residente ve sección "Pendientes de tu confirmación"
           ├── Confirmar → estado: cerrada, confirmada_por_residente: true
           └── Rechazar (nota oblig. min 20 chars)
                  ├── intentos < 3 → estado: en_progreso, nota en historial
                  └── intentos >= 3 → estado: pendiente (ESCALADA)
```

---

## Criterios de aceptación

- [ ] Sección "Pendientes de tu confirmación" visible en `/residente` si hay solicitudes `estado='resuelta'` con `confirmada_por_residente=false`.
- [ ] Card con badge rojo "PENDIENTE TU CONFIRMACIÓN", ID, tipo, foto original, fecha resolución, nota del técnico, dos botones.
- [ ] "Confirmar" abre modal de confirmación. Tras confirmar: `estado='cerrada'`, `confirmada_por_residente=true`.
- [ ] "Rechazar" abre modal con textarea obligatoria (mín. 20 chars). Tras enviar: `estado='en_progreso'`, nota en `historial_estados`, `intentos_resolucion += 1`.
- [ ] Si `intentos_resolucion >= 3` tras rechazar: `estado='pendiente'`, badge "ESCALADA AL ADMIN".
- [ ] RLS: residente solo confirma/rechaza sus propias solicitudes.
- [ ] Cambios registrados en `historial_estados` y `audit_log`.
- [ ] Mensaje post-rechazo: "Tu rechazo fue registrado. El técnico será notificado y volverá a revisar."

---

## Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `src/types/database.ts` | **MODIFICADO** — añade `confirmada_por_residente` e `intentos_resolucion` a `Solicitud` |
| `src/hooks/useSolicitudes.ts` | **MODIFICADO** — añade los nuevos campos a `SOLICITUDES_COLUMNS` |
| `src/hooks/useConfirmarSolicitud.ts` | **NUEVO** — `confirmarSolicitud` y `rechazarSolicitud` con lógica de escalada |
| `src/components/residente/solicitudes/CardConfirmacion.tsx` | **NUEVO** — card con badge, nota técnico, botones confirmar/rechazar |
| `src/components/residente/solicitudes/ModalConfirmarSolucion.tsx` | **NUEVO** — modal simple de confirmación |
| `src/components/residente/solicitudes/ModalRechazarSolucion.tsx` | **NUEVO** — modal con textarea obligatoria y manejo de escalada |
| `src/pages/ResidenteDashboard.tsx` | **MODIFICADO** — sección "Pendientes de tu confirmación" + hook de solicitudes resuelta |

---

## Notas de implementación

- Se usa un segundo `useSolicitudes` con `estado='resuelta'` para cargar solo las pendientes de confirmación, separado del fetch principal.
- El `residente_id` del filtro garantiza que RLS y frontend coincidan.
- Todos los bloques nuevos: `// HU-MANT-07 SPRINT-4`.
