-- ============================================================
-- Sprint 11 · HU-TIENDA-04 · Migración 012 (nominal) — parte 1/4
-- Añade el valor 'tienda' al enum factura_tipo (luz/agua/pension/multa/tienda).
-- ============================================================
-- Va en su PROPIA migración a propósito: en PostgreSQL un valor de enum recién
-- agregado con ALTER TYPE ... ADD VALUE no puede usarse en la MISMA transacción
-- que lo crea. Al aislarlo aquí, las migraciones siguientes del Sprint 11
-- (carrito_rpc, facturar_pedidos) ya pueden referenciar 'tienda' con seguridad.
-- ADD VALUE IF NOT EXISTS lo hace idempotente (re-aplicar no falla).
-- ============================================================

ALTER TYPE public.factura_tipo ADD VALUE IF NOT EXISTS 'tienda';
