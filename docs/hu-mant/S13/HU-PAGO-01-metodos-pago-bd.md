# HU-PAGO-01 · Modelado BD de métodos de pago · Tokenización + RLS

**Sprint 13 · 2 h · Addendum · P1**  
**Estado:** ✅ Implementado

---

## Descripción

Como sistema, quiero una tabla `metodos_pago` que guarde las tarjetas tokenizadas con RLS por residente, para soportar pagos sin reingresar datos y sin almacenar información sensible.

---

## Criterios de aceptación — verificación

| Criterio | Estado | Detalle |
|---|---|---|
| Crear tabla `metodos_pago` en migración | ✅ | Implementada en la migración `014` sin columnas de número completo (PAN) ni CVV. |
| Índice único parcial para tarjeta predeterminada | ✅ | Índice parcial `WHERE predeterminada = true` que restringe a máx. 1 tarjeta por usuario. |
| RLS restrictivo por residente | ✅ | 4 políticas que asocian el CRUD con `auth.uid()`. El admin tiene acceso bloqueado por defecto. |
| El CVV nunca se persiste ni va a logs | ✅ | El CVV no existe en el esquema y se omite en el código TypeScript y payloads. |
| Tests de integración para verificar RLS y no-PII | ✅ | Tests de backend escritos y ejecutados, validando los 3 roles y la ausencia de PAN/CVV. |

---

## Archivos creados / modificados

### Nuevos

| Archivo | Descripción |
|---|---|
| [`supabase/migrations/20260616120400_sprint13_metodos_pago.sql`](file:///c:/Users/USUARIO/GIT_HUB/Zity/supabase/migrations/20260616120400_sprint13_metodos_pago.sql) | DDL de creación de la tabla, tipo enum de marcas, índices y políticas RLS. |
| [`src/test/residente/metodos-pago.test.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/test/residente/metodos-pago.test.ts) | Suite de 16 tests de integración para validar la estructura PII y las restricciones de rol en RLS. |

### Modificados

| Archivo | Cambio |
|---|---|
| [`src/lib/metodos-pago.ts`](file:///c:/Users/USUARIO/GIT_HUB/Zity/src/lib/metodos-pago.ts) | Definición de tipos de base de datos (`MetodoPago`, `TarjetaMarca`) y operaciones CRUD básicas. |

---

## Explicación técnica detallada

### 1. Diseño de Base de Datos y Cumplimiento no-PII (OWASP A02)

**Archivo:** `supabase/migrations/20260616120400_sprint13_metodos_pago.sql`

Para cumplir con las normas de seguridad de datos de la industria de tarjetas de pago (PCI-DSS) y protección de datos no-PII, la tabla `metodos_pago` **omite por diseño** cualquier campo para el PAN (Primary Account Number / número de tarjeta) o CVV (código de seguridad). 

En su lugar, guarda únicamente los últimos 4 dígitos y un `token_simulado` (un string opaco generado del lado del cliente antes de persistir, simulando el comportamiento de pasarelas reales como Stripe o Culqi).

```sql
CREATE TYPE public.tarjeta_marca AS ENUM (
  'visa', 'mastercard', 'amex', 'diners', 'discover', 'otro'
);

CREATE TABLE public.metodos_pago (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  residente_id    uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias           text          NOT NULL CONSTRAINT alias_max CHECK (length(alias) <= 50),
  marca           tarjeta_marca NOT NULL,
  titular         text          NOT NULL CONSTRAINT titular_max CHECK (length(titular) <= 80),
  ultimos4        char(4)       NOT NULL CONSTRAINT ultimos4_digitos CHECK (ultimos4 ~ '^[0-9]{4}$'),
  exp_mes         smallint      NOT NULL CONSTRAINT exp_mes_rango CHECK (exp_mes BETWEEN 1 AND 12),
  exp_anio        smallint      NOT NULL CONSTRAINT exp_anio_rango CHECK (exp_anio BETWEEN 2024 AND 2099),
  token_simulado  text          NOT NULL,
  predeterminada  boolean       NOT NULL DEFAULT false,
  created_at      timestamptz   NOT NULL DEFAULT now()
);
```

### 2. Índice Único Parcial para Tarjeta Predeterminada

Para garantizar que un residente tenga a lo mucho una tarjeta marcada como predeterminada, se creó un índice único parcial en la columna `residente_id`. El índice solo evalúa las filas donde `predeterminada = true`:

```sql
CREATE UNIQUE INDEX idx_metodos_pago_una_predeterminada
  ON public.metodos_pago (residente_id)
  WHERE predeterminada = true;
```

Esto permite al residente tener múltiples tarjetas secundarias (`predeterminada = false`) sin colisionar, pero bloquea el registro de una segunda tarjeta por defecto.

### 3. Row Level Security Estricta sin Bypass para Administrador

Se aplicó RLS para asegurar que únicamente el residente autenticado propietario de la tarjeta pueda realizar operaciones en ella. El rol `admin` no tiene políticas asociadas a esta tabla, bloqueando su acceso de forma predeterminada:

```sql
ALTER TABLE public.metodos_pago ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metodos_pago: residente ve las suyas"
  ON public.metodos_pago FOR SELECT TO authenticated
  USING (residente_id = auth.uid());

CREATE POLICY "metodos_pago: residente inserta las suyas"
  ON public.metodos_pago FOR INSERT TO authenticated
  WITH CHECK (residente_id = auth.uid());
```

---

## Cambios requeridos en Supabase ⚠️

### Paso 1 — Aplicar la Migración

Ejecuta el script SQL en Supabase para crear el enum, la tabla, los índices y las políticas:
```
supabase/migrations/20260616120400_sprint13_metodos_pago.sql
```

---

## Tests de Integración

Se han escrito 16 tests de integración ejecutados en Vitest:
1. **Verificación de Estructura**: Valida que no se puedan inyectar columnas de tipo `pan` o `cvv` y que los campos del esquema respeten las restricciones de longitud y tipo.
2. **Pruebas de RLS por Rol**:
   - `Residente`: Puede ver, insertar, actualizar y eliminar sus propios métodos de pago. No puede acceder a los métodos de pago de otros residentes.
   - `Admin`: Sus intentos de lectura sobre la tabla devuelven un array vacío y sus intentos de escritura son bloqueados por las políticas de RLS.
   - `Técnico`: Acceso bloqueado.
   - `Anónimo`: Acceso denegado antes de evaluar RLS.
