-- ============================================================
-- Sprint 8 · HU-FACT-03 · Número legible de factura
-- ============================================================
-- Añade la columna `numero` con formato F-YYYY-MM-NNN a la tabla
-- facturas. El número es generado automáticamente por un trigger
-- BEFORE INSERT usando una secuencia por período.
--
-- Formato: F-{periodo}-{secuencia de 3 dígitos con ceros}
-- Ejemplo: F-2026-05-001, F-2026-05-002, …
-- ============================================================

-- Columna numero (opcional inicialmente para retrocompatibilidad)
ALTER TABLE public.facturas
  ADD COLUMN IF NOT EXISTS numero text;

-- Índice único para garantizar que no haya duplicados
CREATE UNIQUE INDEX IF NOT EXISTS facturas_numero_idx
  ON public.facturas (numero)
  WHERE numero IS NOT NULL;

-- Tabla auxiliar para mantener la secuencia por período
-- (PostgreSQL sequences no permiten parámetros dinámicos,
--  por lo que usamos una tabla contador)
CREATE TABLE IF NOT EXISTS public.facturas_secuencia (
  periodo text PRIMARY KEY,
  ultimo  integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.facturas_secuencia IS
  'Sprint 8 · HU-FACT-03 — Contador de facturas emitidas por período (YYYY-MM). '
  'Usado por el trigger after_factura_numero para generar números legibles F-YYYY-MM-NNN.';

-- Función trigger: asigna número legible BEFORE INSERT
CREATE OR REPLACE FUNCTION public.before_factura_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_siguiente integer;
BEGIN
  -- Si ya tiene número (inserción manual o re-intento), respetar el valor
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Incrementar el contador para este período de forma atómica (FOR UPDATE)
  INSERT INTO public.facturas_secuencia (periodo, ultimo)
  VALUES (NEW.periodo, 1)
  ON CONFLICT (periodo) DO UPDATE
    SET ultimo = public.facturas_secuencia.ultimo + 1
  RETURNING ultimo INTO v_siguiente;

  NEW.numero := 'F-' || NEW.periodo || '-' || LPAD(v_siguiente::text, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS before_factura_numero ON public.facturas;

CREATE TRIGGER before_factura_numero
  BEFORE INSERT ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.before_factura_numero();

REVOKE ALL ON FUNCTION public.before_factura_numero()
  FROM anon, authenticated, public;

COMMENT ON FUNCTION public.before_factura_numero() IS
  'Sprint 8 · HU-FACT-03 — Trigger BEFORE INSERT en facturas. '
  'Asigna número legible F-YYYY-MM-NNN usando facturas_secuencia como contador atómico.';
