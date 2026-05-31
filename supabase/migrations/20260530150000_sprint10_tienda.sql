-- ============================================================
-- Sprint 10 · HU-TIENDA-01 · Modelado BD de la Tienda interna
-- Migración 011 (nominal): productos / pedidos / pedido_items + RLS + bucket
-- ============================================================
-- Diseño (ADR-012):
--   • productos: catálogo del edificio. La baja es LÓGICA (activo=false),
--     nunca DELETE, para preservar el historial de pedidos del S11 (R2).
--   • pedidos / pedido_items: se modelan ya (con RLS) pero SIN UI de carrito
--     hasta el S11. precio_unitario es un snapshot del precio al pedir.
--   • FK pedido_items→productos con ON DELETE RESTRICT: no se puede borrar
--     un producto referenciado por un pedido (R2).
--   • RLS por rol: productos legibles por cualquier autenticado si activo=true
--     (residente y técnico ven el catálogo); el admin ve todo y es el único
--     que escribe. pedidos/pedido_items: solo el residente dueño + admin;
--     técnico sin acceso (sin política → denegado).
--   • Bucket productos-fotos (privado, JPEG/PNG, 2 MB): admin escribe, lectura
--     autenticada. Reusa el patrón de solicitudes-fotos del S3 (ADR-005).
--   • auth.uid() / get_user_rol() envueltos en (select …) para el initPlan de
--     Postgres — estándar del proyecto (docs/db/rls.md §5), evita el advisor
--     auth_rls_initplan.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PARTE A: Tipos Enum
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.producto_categoria AS ENUM ('bebidas','comestibles','limpieza','otros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pedido_estado AS ENUM ('borrador','confirmado','facturado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ────────────────────────────────────────────────────────────
-- PARTE B: Tabla productos
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.productos (
  id          uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text                       NOT NULL CHECK (length(trim(nombre)) > 0),
  descripcion text,
  categoria   public.producto_categoria  NOT NULL DEFAULT 'otros',
  precio      numeric(10,2)              NOT NULL CHECK (precio >= 0),
  stock       integer                    NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo      boolean                    NOT NULL DEFAULT true,
  imagen_url  text,
  created_at  timestamptz                NOT NULL DEFAULT now(),
  updated_at  timestamptz                NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.productos IS
  'Sprint 10 · HU-TIENDA-01 — Catálogo de la tienda interna. '
  'Baja lógica (activo=false), nunca DELETE, para preservar el historial de pedidos del S11.';
COMMENT ON COLUMN public.productos.imagen_url IS
  'Path dentro del bucket productos-fotos (no URL pública). Se firma al mostrar.';
COMMENT ON COLUMN public.productos.precio IS 'Precio en soles (PEN), máximo 99,999,999.99';

-- ────────────────────────────────────────────────────────────
-- PARTE C: Tabla pedidos (modelada para el S11, sin UI en v1)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedidos (
  id           uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id uuid                  NOT NULL
                 REFERENCES public.usuarios(id) ON DELETE CASCADE,
  estado       public.pedido_estado  NOT NULL DEFAULT 'borrador',
  total        numeric(10,2)         NOT NULL DEFAULT 0 CHECK (total >= 0),
  periodo      text                  CHECK (periodo IS NULL OR periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  created_at   timestamptz           NOT NULL DEFAULT now(),
  updated_at   timestamptz           NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedidos IS
  'Sprint 10 · HU-TIENDA-01 — Pedidos de la tienda. Modelada con RLS en el S10; '
  'el flujo de carrito / confirmación / descuento de stock es el S11.';

-- ────────────────────────────────────────────────────────────
-- PARTE D: Tabla pedido_items
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pedido_items (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       uuid           NOT NULL
                    REFERENCES public.pedidos(id) ON DELETE CASCADE,
  producto_id     uuid           NOT NULL
                    REFERENCES public.productos(id) ON DELETE RESTRICT,
  cantidad        integer        NOT NULL CHECK (cantidad >= 1),
  precio_unitario numeric(10,2)  NOT NULL CHECK (precio_unitario >= 0),
  created_at      timestamptz    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pedido_items IS
  'Sprint 10 · HU-TIENDA-01 — Líneas de pedido. precio_unitario es snapshot del precio '
  'al momento de pedir. FK a productos con ON DELETE RESTRICT (no borrar referenciado).';

-- ────────────────────────────────────────────────────────────
-- PARTE E: Índices
-- ────────────────────────────────────────────────────────────
-- Catálogo: filtro principal por categoría sobre productos activos (HU-TIENDA-06)
CREATE INDEX IF NOT EXISTS productos_categoria_activo_idx
  ON public.productos (categoria, activo);
-- Pedidos por residente (RLS + historial del S11)
CREATE INDEX IF NOT EXISTS pedidos_residente_idx
  ON public.pedidos (residente_id);
-- FKs indexadas (evita el advisor unindexed_foreign_keys)
CREATE INDEX IF NOT EXISTS pedido_items_pedido_idx
  ON public.pedido_items (pedido_id);
CREATE INDEX IF NOT EXISTS pedido_items_producto_idx
  ON public.pedido_items (producto_id);

-- ────────────────────────────────────────────────────────────
-- PARTE F: Triggers updated_at (reusa public.set_updated_at del S8)
-- ────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS productos_set_updated_at ON public.productos;
CREATE TRIGGER productos_set_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS pedidos_set_updated_at ON public.pedidos;
CREATE TRIGGER pedidos_set_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ────────────────────────────────────────────────────────────
-- PARTE G: Row Level Security
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.productos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;

-- productos ─────────────────────────────────────────────────
-- SELECT: catálogo activo visible para cualquier autenticado; admin ve todo.
DROP POLICY IF EXISTS productos_select ON public.productos;
CREATE POLICY productos_select
  ON public.productos FOR SELECT TO authenticated
  USING (activo = true OR (select public.get_user_rol()) = 'admin');

-- INSERT / UPDATE: solo admin. Sin DELETE → la baja es lógica (activo=false).
DROP POLICY IF EXISTS productos_admin_insert ON public.productos;
CREATE POLICY productos_admin_insert
  ON public.productos FOR INSERT TO authenticated
  WITH CHECK ((select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS productos_admin_update ON public.productos;
CREATE POLICY productos_admin_update
  ON public.productos FOR UPDATE TO authenticated
  USING  ((select public.get_user_rol()) = 'admin')
  WITH CHECK ((select public.get_user_rol()) = 'admin');

-- pedidos ───────────────────────────────────────────────────
-- El residente solo accede a los suyos; el admin a todos; técnico sin acceso.
DROP POLICY IF EXISTS pedidos_select ON public.pedidos;
CREATE POLICY pedidos_select
  ON public.pedidos FOR SELECT TO authenticated
  USING (residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS pedidos_residente_insert ON public.pedidos;
CREATE POLICY pedidos_residente_insert
  ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (
    (residente_id = (select auth.uid()) AND (select public.get_user_rol()) = 'residente')
    OR (select public.get_user_rol()) = 'admin'
  );

DROP POLICY IF EXISTS pedidos_update ON public.pedidos;
CREATE POLICY pedidos_update
  ON public.pedidos FOR UPDATE TO authenticated
  USING  (residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin')
  WITH CHECK (residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin');

-- pedido_items ──────────────────────────────────────────────
-- Acceso derivado del pedido padre (mismo dueño / admin).
DROP POLICY IF EXISTS pedido_items_select ON public.pedido_items;
CREATE POLICY pedido_items_select
  ON public.pedido_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_items.pedido_id
      AND (p.residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin')
  ));

DROP POLICY IF EXISTS pedido_items_insert ON public.pedido_items;
CREATE POLICY pedido_items_insert
  ON public.pedido_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_items.pedido_id
      AND (p.residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin')
  ));

DROP POLICY IF EXISTS pedido_items_update ON public.pedido_items;
CREATE POLICY pedido_items_update
  ON public.pedido_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_items.pedido_id
      AND (p.residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.pedidos p
    WHERE p.id = pedido_items.pedido_id
      AND (p.residente_id = (select auth.uid()) OR (select public.get_user_rol()) = 'admin')
  ));

-- TÉCNICO: sin política en pedidos/pedido_items → RLS deniega automáticamente.

-- ────────────────────────────────────────────────────────────
-- PARTE H: Bucket productos-fotos + políticas de Storage
-- ────────────────────────────────────────────────────────────
-- Bucket privado (JPEG/PNG, 2 MB = 2·1024·1024 bytes). Reusa el patrón S3.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('productos-fotos', 'productos-fotos', false, 2097152, ARRAY['image/jpeg','image/png'])
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = EXCLUDED.public;

-- Admin escribe (INSERT/UPDATE/DELETE), lectura para cualquier autenticado
-- (el control efectivo se hace con URLs firmadas, igual que solicitudes-fotos).
DROP POLICY IF EXISTS productos_fotos_admin_insert ON storage.objects;
CREATE POLICY productos_fotos_admin_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'productos-fotos' AND (select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS productos_fotos_select_authenticated ON storage.objects;
CREATE POLICY productos_fotos_select_authenticated
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'productos-fotos');

DROP POLICY IF EXISTS productos_fotos_admin_update ON storage.objects;
CREATE POLICY productos_fotos_admin_update
  ON storage.objects FOR UPDATE TO authenticated
  USING  (bucket_id = 'productos-fotos' AND (select public.get_user_rol()) = 'admin')
  WITH CHECK (bucket_id = 'productos-fotos' AND (select public.get_user_rol()) = 'admin');

DROP POLICY IF EXISTS productos_fotos_admin_delete ON storage.objects;
CREATE POLICY productos_fotos_admin_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'productos-fotos' AND (select public.get_user_rol()) = 'admin');
