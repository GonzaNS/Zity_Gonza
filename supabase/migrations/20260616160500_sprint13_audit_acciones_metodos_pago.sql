-- ============================================================
-- Sprint 13 · HU-PAGO-02 — Acciones de auditoría de métodos de pago
-- ============================================================
-- El catálogo audit_acciones es la fuente de verdad de audit_log.accion
-- (FK audit_log_accion_fkey). El frontend (src/lib/audit.ts) ya emite
-- estas acciones al guardar / cambiar predeterminada / eliminar una tarjeta,
-- pero faltaban en el catálogo, por lo que el INSERT en audit_log fallaba
-- con violación de FK. Se registran aquí (sin datos sensibles: el detalle
-- solo guarda marca + últimos 4, nunca PAN ni CVV).
-- ============================================================

INSERT INTO public.audit_acciones (codigo, descripcion, requiere_detalle) VALUES
  ('alta_metodo_pago',           'Alta de método de pago (tarjeta tokenizada, sin PAN ni CVV)', false),
  ('predeterminada_metodo_pago', 'Cambio de la tarjeta predeterminada del residente',           false),
  ('eliminar_metodo_pago',       'Eliminación de un método de pago del residente',              false)
ON CONFLICT (codigo) DO NOTHING;
