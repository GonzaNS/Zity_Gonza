-- Sprint 6 · PBI-12 + PBI-S4-E01
-- Notificaciones por trigger de BD (SECURITY DEFINER) + Realtime.

-- 1) Esquema: columna titulo y ampliar el CHECK de tipo para alerta_rechazo.
alter table public.notificaciones add column if not exists titulo text not null default '';

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'notificaciones'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tipo%';
  if cname is not null then
    execute format('alter table public.notificaciones drop constraint %I', cname);
  end if;
end $$;

alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array['estado_cambio','asignacion','nueva_solicitud','sistema','alerta_rechazo']));

-- 2) Realtime: habilitar la tabla en la publicacion y enviar valores OLD completos
--    para que el cliente recalcule el contador de no leidas en eventos UPDATE.
alter table public.notificaciones replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notificaciones'
  ) then
    execute 'alter publication supabase_realtime add table public.notificaciones';
  end if;
end $$;

-- 3) Trigger after_solicitud_estado_changed: inserta 1 notificacion por
--    destinatario relevante. SECURITY DEFINER para poder escribir filas de
--    otros usuarios (el cliente no puede por RLS insert_own).
create or replace function public.after_solicitud_estado_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_residente record;
  v_tecnico_id uuid;
  v_estado_label text := replace(NEW.estado, '_', ' ');
  v_titulo text;
begin
  begin
    v_titulo := case NEW.estado
      when 'asignada' then 'Solicitud asignada a un tecnico'
      when 'en_progreso' then 'Solicitud en progreso'
      when 'resuelta' then 'Solucion reportada por el tecnico'
      when 'cerrada' then 'Solicitud cerrada'
      when 'pendiente' then 'Solicitud reabierta'
      else 'Actualizacion de solicitud'
    end;

    -- (a) Residente: notificar cuando el cambio NO lo hizo el propio residente.
    if v_actor is distinct from NEW.residente_id then
      insert into public.notificaciones (usuario_id, solicitud_id, tipo, titulo, mensaje, leida)
      values (
        NEW.residente_id, NEW.id, 'estado_cambio', v_titulo,
        'Tu solicitud ' || coalesce(NEW.codigo, '') || ' cambio a: ' || v_estado_label || '.',
        false
      );
    end if;

    -- (b) Tecnico: al asignar, notificar al tecnico asignado mas reciente.
    if NEW.estado = 'asignada' then
      select a.tecnico_id into v_tecnico_id
      from public.asignaciones a
      where a.solicitud_id = NEW.id
      order by a.fecha_asignacion desc
      limit 1;

      if v_tecnico_id is not null then
        insert into public.notificaciones (usuario_id, solicitud_id, tipo, titulo, mensaje, leida)
        values (
          v_tecnico_id, NEW.id, 'asignacion', 'Nueva solicitud asignada',
          'Se te asigno la solicitud ' || coalesce(NEW.codigo, '') || '.', false
        );
      end if;
    end if;

    -- (c) Rechazo del residente (resuelta -> en_progreso/pendiente): alertar a admins activos.
    if OLD.estado = 'resuelta' and NEW.estado in ('en_progreso', 'pendiente') then
      select u.nombre, u.apellido into v_residente
      from public.usuarios u where u.id = NEW.residente_id;

      insert into public.notificaciones (usuario_id, solicitud_id, tipo, titulo, mensaje, leida)
      select
        adm.id, NEW.id, 'alerta_rechazo', 'Solicitud rechazada por el residente',
        coalesce(v_residente.nombre, 'El residente') || ' ' || coalesce(v_residente.apellido, '')
          || ' rechazo ' || coalesce(NEW.codigo, 'la solicitud')
          || ' (intento ' || coalesce(NEW.intentos_resolucion, 0)::text || '/3).',
        false
      from public.usuarios adm
      where adm.rol = 'admin' and adm.estado_cuenta = 'activo';
    end if;
  exception when others then
    -- Best-effort: una notificacion fallida nunca debe revertir el cambio de estado.
    raise warning 'after_solicitud_estado_changed fallo: %', sqlerrm;
  end;

  return NEW;
end;
$$;

drop trigger if exists after_solicitud_estado_changed on public.solicitudes;

create trigger after_solicitud_estado_changed
  after update on public.solicitudes
  for each row
  when (OLD.estado is distinct from NEW.estado)
  execute function public.after_solicitud_estado_changed();

-- Seguridad: es una función de trigger, no una RPC. Se revoca EXECUTE a los
-- roles expuestos para que no sea invocable vía /rest/v1/rpc (solo el trigger,
-- que corre como owner, la ejecuta).
revoke all on function public.after_solicitud_estado_changed() from anon, authenticated, public;
