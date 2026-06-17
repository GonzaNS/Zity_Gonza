-- ============================================================
-- Sprint 13 · HU-PAGO-01 · Modelado BD de métodos de pago
-- Migración 014 — tabla metodos_pago + RLS + índice único parcial
-- ============================================================
-- Diseño de seguridad (no-PII / OWASP A02):
--   • NO se persiste el PAN completo (número de tarjeta).
--   • NO se persiste el CVV ni el PIN.
--   • Solo se guarda: alias, marca, titular, ultimos4 dígitos,
--     fecha de expiración y un token_simulado opaco.
--   • La columna 'token_simulado' simula el identificador que
--     devolvería una pasarela real (Stripe, Culqi, etc.).
--     En producción real sería el PaymentMethod ID de la pasarela.
--
-- RLS:
--   • Cada residente solo accede a sus propias filas (residente_id = auth.uid()).
--   • El admin NO tiene acceso — la RLS no tiene excepción para service_role
--     (solo las Edge Functions con service_role la saltarían, y no están en scope).
--   • Anón no tiene acceso.
--
-- Índice único parcial:
--   • Como máximo UNA tarjeta predeterminada por residente.
--   • Se implementa con un índice único parcial WHERE predeterminada = true.
-- ============================================================

-- ─── Tipos de marca de tarjeta ───────────────────────────────────────────────
CREATE TYPE public.tarjeta_marca AS ENUM (
  'visa',
  'mastercard',
  'amex',
  'diners',
  'discover',
  'otro'
);

COMMENT ON TYPE public.tarjeta_marca IS
  'Sprint 13 · HU-PAGO-01 — Marcas de tarjeta reconocidas. '
  'Se detecta automáticamente del BIN (primeros 6 dígitos) en el frontend; '
  'aquí solo se guarda la marca, NUNCA el PAN completo.';

-- ─── Tabla principal ─────────────────────────────────────────────────────────
CREATE TABLE public.metodos_pago (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Datos de presentación (NO sensibles)
  alias           text          NOT NULL
                                CONSTRAINT alias_no_vacio CHECK (trim(alias) <> '')
                                CONSTRAINT alias_max     CHECK (length(alias) <= 50),
  marca           tarjeta_marca NOT NULL,
  titular         text          NOT NULL
                                CONSTRAINT titular_no_vacio  CHECK (trim(titular) <> '')
                                CONSTRAINT titular_max       CHECK (length(titular) <= 80),
  ultimos4        char(4)       NOT NULL
                                CONSTRAINT ultimos4_digitos CHECK (ultimos4 ~ '^[0-9]{4}$'),
  exp_mes         smallint      NOT NULL
                                CONSTRAINT exp_mes_rango CHECK (exp_mes BETWEEN 1 AND 12),
  exp_anio        smallint      NOT NULL
                                CONSTRAINT exp_anio_rango CHECK (exp_anio BETWEEN 2024 AND 2099),

  -- Token opaco de la pasarela (NO es el PAN)
  -- En simulación: un UUID prefijado. En producción: PaymentMethod ID de la pasarela.
  token_simulado  text          NOT NULL
                                CONSTRAINT token_no_vacio CHECK (trim(token_simulado) <> ''),

  -- Tarjeta predeterminada del residente (índice único parcial más abajo)
  predeterminada  boolean       NOT NULL DEFAULT false,

  created_at      timestamptz   NOT NULL DEFAULT now(),

  -- Restricción: no se permiten columnas PAN/CVV (la tabla las omite por diseño;
  -- este check simbólico lo documenta explícitamente en el DDL para auditorías).
  -- El CVV NUNCA se escribe aquí. Si en el futuro alguien añade 'cvv', el migration
  -- review lo detecta antes de llegar a producción.
  CONSTRAINT no_pan_completo CHECK (true)  -- DDL guard: el PAN no existe como columna
);

COMMENT ON TABLE public.metodos_pago IS
  'Sprint 13 · HU-PAGO-01 — Métodos de pago tokenizados del residente. '
  'NO contiene PAN completo ni CVV (política no-PII). '
  'token_simulado es el identificador opaco de la pasarela (en prod: Stripe PM ID). '
  'RLS: residente solo ve sus propias filas; admin sin acceso directo.';

COMMENT ON COLUMN public.metodos_pago.token_simulado IS
  'Identificador opaco devuelto por la pasarela de pagos. '
  'En simulación: UUID prefijado ''tok_''. En producción: Stripe PaymentMethod ID. '
  'NUNCA es el número de tarjeta (PAN).';

COMMENT ON COLUMN public.metodos_pago.ultimos4 IS
  'Últimos 4 dígitos del PAN, solo para identificación visual. '
  'NO es el PAN completo. El PAN completo NUNCA se persiste.';

-- ─── Índices ─────────────────────────────────────────────────────────────────

-- Búsquedas por residente (RLS lo filtra, este índice acelera el scan)
CREATE INDEX idx_metodos_pago_residente
  ON public.metodos_pago (residente_id);

-- ÍNDICE ÚNICO PARCIAL — como máximo UNA tarjeta predeterminada por residente.
-- Aplicar predeterminada=false primero y luego predeterminada=true en la misma
-- transacción permite la rotación sin violar este índice.
CREATE UNIQUE INDEX idx_metodos_pago_una_predeterminada
  ON public.metodos_pago (residente_id)
  WHERE predeterminada = true;

COMMENT ON INDEX public.idx_metodos_pago_una_predeterminada IS
  'Garantiza como máximo 1 tarjeta predeterminada por residente. '
  'Para cambiar la predeterminada: primero UPDATE SET predeterminada=false '
  'a la actual, luego UPDATE SET predeterminada=true a la nueva '
  '(idealmente dentro de una transacción).';

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;

-- El admin NO accede a los métodos de pago de otros residentes.
-- Solo el propietario (residente autenticado) puede SELECT/INSERT/UPDATE/DELETE
-- sobre sus propias filas.

-- SELECT: el residente solo ve las suyas
CREATE POLICY "metodos_pago: residente ve las suyas"
  ON public.metodos_pago
  FOR SELECT
  TO authenticated
  USING (residente_id = auth.uid());

-- INSERT: el residente solo puede insertar con su propio residente_id
CREATE POLICY "metodos_pago: residente inserta las suyas"
  ON public.metodos_pago
  FOR INSERT
  TO authenticated
  WITH CHECK (residente_id = auth.uid());

-- UPDATE: solo el propietario puede modificar
CREATE POLICY "metodos_pago: residente actualiza las suyas"
  ON public.metodos_pago
  FOR UPDATE
  TO authenticated
  USING  (residente_id = auth.uid())
  WITH CHECK (residente_id = auth.uid());

-- DELETE: solo el propietario puede eliminar
CREATE POLICY "metodos_pago: residente elimina las suyas"
  ON public.metodos_pago
  FOR DELETE
  TO authenticated
  USING (residente_id = auth.uid());

-- Sin política para el rol 'anon' → acceso bloqueado por defecto.
-- Sin política para service_role aquí — si las Edge Functions necesitan
-- acceder lo harán con SECURITY DEFINER o service_role (fuera de RLS).

-- ─── Permisos de tabla ───────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metodos_pago TO authenticated;
REVOKE ALL ON public.metodos_pago FROM anon, public;
