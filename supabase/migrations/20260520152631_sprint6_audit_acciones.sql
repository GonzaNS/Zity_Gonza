-- Sprint 6 · Accion 1 del Retro Sprint 5: catalogo de acciones de auditoria
-- unificado como unica fuente de verdad. Reemplaza el control de dominio por FK.

create table if not exists public.audit_acciones (
  codigo text primary key,
  descripcion text not null,
  requiere_detalle boolean not null default false
);

comment on table public.audit_acciones is
  'Sprint 6: catalogo de acciones validas para audit_log.accion. Fuente de verdad del dominio (reemplaza el catalogo duplicado TS/SQL).';

insert into public.audit_acciones (codigo, descripcion, requiere_detalle) values
  ('asignar_solicitud', 'Asignacion de solicitud a un tecnico', true),
  ('actualizar_estado_solicitud', 'Cambio de estado de una solicitud', true),
  ('confirmar_solicitud', 'Residente confirma la solucion', false),
  ('rechazar_solucion', 'Residente rechaza la solucion del tecnico', true),
  ('escalada_solicitud', 'Escalada al admin tras multiples rechazos', true),
  ('editar_perfil', 'Edicion de datos de perfil propio', false),
  ('crear_solicitud', 'Creacion de una solicitud', false),
  ('cambiar_prioridad', 'Cambio de prioridad de una solicitud', true),
  ('crear_invitacion', 'Creacion de invitacion de usuario', true),
  ('activar_cuenta', 'Activacion de cuenta de usuario', false),
  ('bloquear_cuenta', 'Bloqueo de cuenta de usuario', true),
  ('desbloquear_cuenta', 'Desbloqueo de cuenta de usuario', false),
  ('cambio_contrasena', 'Cambio de contrasena del usuario', false)
on conflict (codigo) do nothing;

-- Asegura que cualquier accion historica ya presente en audit_log exista en el
-- catalogo antes de crear la FK (evita violacion por datos preexistentes).
insert into public.audit_acciones (codigo, descripcion)
select distinct accion, accion
from public.audit_log
where accion is not null
  and accion not in (select codigo from public.audit_acciones)
on conflict (codigo) do nothing;

alter table public.audit_log
  add constraint audit_log_accion_fkey
  foreign key (accion) references public.audit_acciones (codigo);

-- RPC para que el frontend consuma el catalogo (decision tecnica Sprint 6).
create or replace function public.catalogo_acciones()
returns setof public.audit_acciones
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.audit_acciones order by codigo;
$$;

-- RLS: catalogo de solo lectura para usuarios autenticados.
alter table public.audit_acciones enable row level security;

create policy audit_acciones_select_authenticated
  on public.audit_acciones for select
  to authenticated
  using (true);
