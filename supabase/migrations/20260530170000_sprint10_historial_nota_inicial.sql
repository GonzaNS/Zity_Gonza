-- ============================================================
-- Sprint 10 · MP-01 (soporte) · Nota inicial del historial ≥ 20 chars
-- ============================================================
-- `log_solicitud_creada` registra el estado inicial en historial_estados con la
-- nota fija 'Solicitud creada' (15 chars). El CHECK
-- historial_estados_nota_minima_transiciones_criticas exige nota ≥ 20 chars
-- cuando estado_nuevo ∈ {resuelta, cerrada}. En el flujo normal una solicitud
-- nace 'pendiente' (no crítico), así que nunca chocaba; pero el seed histórico
-- (MP-01) crea solicitudes ya resueltas/cerradas con sus timestamps reales, lo
-- que dispara el CHECK.
--
-- Solución mínima y benigna: la nota inicial pasa a un texto ≥ 20 chars, más
-- descriptivo. No cambia ningún flujo; solo el texto de la nota inicial.
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_solicitud_creada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.audit_log (usuario_id, accion, entidad, entidad_id, detalles, resultado)
  VALUES (
    NEW.residente_id,
    'crear_solicitud',
    'solicitudes',
    NEW.id,
    jsonb_build_object(
      'codigo', NEW.codigo,
      'tipo', NEW.tipo,
      'categoria', NEW.categoria,
      'prioridad', NEW.prioridad
    ),
    'exitoso'
  );

  INSERT INTO public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, cambiado_por, nota)
  VALUES (NEW.id, NULL, NEW.estado, NEW.residente_id, 'Solicitud creada por el residente');

  RETURN NEW;
END;
$function$;
