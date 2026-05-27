-- ============================================================
-- Sprint 8 · HU-FACT-02 · Corrección FK + RPC lote de facturas
-- ============================================================
-- Parte A: Corrección de FK en la tabla facturas.
--   La migración HU-FACT-01 referenciaba public.perfiles, pero el
--   proyecto usa public.usuarios. Se ajusta la FK a la tabla correcta.
--
-- Parte B: RPC emitir_facturas_lote para emisión masiva transaccional.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Corrección de FK (perfiles → usuarios)
-- ────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Solo ejecutar si la FK apunta a perfiles (en caso de re-ejecución segura)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
    JOIN information_schema.table_constraints tc2
      ON tc2.constraint_name = rc.unique_constraint_name
    WHERE tc.table_name = 'facturas'
      AND tc2.table_name = 'perfiles'
  ) THEN
    ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS facturas_residente_id_fkey;
  END IF;
END $$;

-- Re-crear FK apuntando a usuarios (tabla real del proyecto)
ALTER TABLE public.facturas
  DROP CONSTRAINT IF EXISTS facturas_residente_id_usuarios_fkey;

ALTER TABLE public.facturas
  ADD CONSTRAINT facturas_residente_id_usuarios_fkey
  FOREIGN KEY (residente_id)
  REFERENCES public.usuarios(id)
  ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- PARTE B: RPC emitir_facturas_lote
-- ────────────────────────────────────────────────────────────
-- Emite la misma factura (tipo, monto, periodo, vencimiento,
-- descripcion) para todos los residentes activos en una sola
-- transacción. Si cualquier INSERT falla (ej: UNIQUE violation
-- por ya existir la factura del periodo), la transacción completa
-- se revierte y se devuelve un mensaje de error claro.
--
-- Retorna: { emitidas: int, error: text | null }

CREATE OR REPLACE FUNCTION emitir_facturas_lote(
  p_tipo         text,
  p_monto        numeric,
  p_periodo      text,
  p_vencimiento  date,
  p_descripcion  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rol       text;
  v_residente record;
  v_count     integer := 0;
BEGIN
  -- 1. Verificación de rol
  SELECT (auth.jwt() -> 'app_metadata' ->> 'rol') INTO v_rol;
  IF v_rol IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acceso denegado: se requiere rol admin'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Validaciones
  IF p_monto < 0 THEN
    RAISE EXCEPTION 'El monto no puede ser negativo';
  END IF;
  IF p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Formato de período inválido. Use YYYY-MM';
  END IF;
  IF p_vencimiento < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de vencimiento no puede ser anterior a hoy';
  END IF;

  -- 3. Insertar una factura por cada residente activo
  --    La transacción es atómica: si falla cualquier INSERT,
  --    todo se revierte (comportamiento PL/pgSQL por defecto).
  FOR v_residente IN
    SELECT id
    FROM public.usuarios
    WHERE rol = 'residente'
      AND estado_cuenta = 'activo'
    ORDER BY id
  LOOP
    INSERT INTO public.facturas
      (residente_id, tipo, monto, periodo, vencimiento, descripcion, estado)
    VALUES
      (v_residente.id, p_tipo::factura_tipo, p_monto, p_periodo,
       p_vencimiento, p_descripcion, 'pendiente');

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('emitidas', v_count, 'error', NULL);

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una factura de tipo "%" para el período "%" en uno o más residentes. Ninguna factura fue emitida.',
      p_tipo, p_periodo;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error al emitir facturas: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION emitir_facturas_lote(text, numeric, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION emitir_facturas_lote(text, numeric, text, date, text) TO authenticated;

COMMENT ON FUNCTION emitir_facturas_lote(text, numeric, text, date, text) IS
  'Sprint 8 · HU-FACT-02 — Emisión masiva de facturas a todos los residentes activos. '
  'Transaccional: si cualquier INSERT falla, toda la operación se revierte. Solo admin.';

-- Actualizar tipo TipoNotificacion en database.ts (documentado, no automático)
-- El tipo 'factura_nueva' se añadió al CHECK en HU-FACT-01 pero database.ts
-- se actualiza manualmente en src/types/database.ts.
