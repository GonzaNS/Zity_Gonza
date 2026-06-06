# Zity

Sistema de gestión de solicitudes de mantenimiento para edificios y condominios.

## Prerequisitos

- [Node.js](https://nodejs.org/) v18 o superior
- Cuenta de [Supabase](https://supabase.com/) (para base de datos y autenticación)

## Configuración de entorno

1. Copia el archivo de ejemplo de variables de entorno:

```bash
cp .env.example .env
```

2. Edita `.env` con las credenciales de tu proyecto Supabase:

```
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
# Server-only — usada por scripts/seed.js y por las edge functions desplegadas.
# Nunca debe llegar al frontend ni al repositorio.
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
# Opcional — URL absoluta usada en los correos de Supabase Auth
VITE_SITE_URL=https://zity.site
```

> Las tres primeras variables se obtienen desde el dashboard de Supabase en Settings → API.

### Variables acumuladas (referencia rápida)

| Variable | Descripción | Dónde se usa | Desde Sprint |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL pública del proyecto Supabase | Frontend (cliente JS) | 0 |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima de Supabase | Frontend (cliente JS) | 0 |
| `VITE_SITE_URL` | Dominio público para enlaces de email | Frontend (cliente JS) | 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio (admin) | Edge Functions, seed | 3 |
| `SUPABASE_DB_URL` | URL de conexión directa a la BD | Migraciones locales | 0 |

**Ninguna variable debe aparecer en el código fuente ni en commits.** Todas viven en `.env.local` (local) y en Secrets de GitHub/Vercel (CI/CD).

## Correr localmente

```bash
npm install
npm run dev
```

La app estará disponible en `http://localhost:5173`.

## Ejecutar pruebas

```bash
# Tests en modo watch
npm test

# Tests una sola vez
npm run test:run

# Tests con reporte de cobertura
npm run test:coverage
```

## Lint y typecheck

```bash
# ESLint sobre src/, scripts/, configs.
npm run lint

# Comprobación de tipos sin emitir archivos.
npm run typecheck
```

## Datos demo (seed)

```bash
# Inserta los usuarios demo; idempotente (upsert por id).
npm run seed

# Limpia la BD demo y vuelve a insertar desde cero.
npm run seed:clean
```

El seed carga **6 usuarios ficticios + 1 invitación pendiente + 3 solicitudes demo con foto** (ver `scripts/seed.js`):

| Email | Contraseña | Rol | Estado |
|---|---|---|---|
| carlos@zity-demo.com | `Admin1234!` | admin | activo |
| laura@zity-demo.com | `Residente1!` | residente | activo (piso 4-B) |
| pedro@zity-demo.com | `Residente2!` | residente | activo (piso 2-A) |
| julia@zity-demo.com | `Residente3!` | residente | activo (piso 5-C) |
| mario@zity-demo.com | `Tecnico1234!` | técnico interno | activo |
| ana@zity-demo.com | `Tecnico5678!` | técnico tercero · TecnoEdif SAC | activo |
| nuevo.residente@ejemplo.com | — | — | invitación pendiente (hace 3 días) |

Las 3 solicitudes demo se insertan con `imagen_url` apuntando a una URL externa de `picsum.photos` (no se sube archivo al bucket en el seed). Esto evita la latencia de subida durante el `npm run seed` y mantiene el comando idempotente. Para validar el flujo completo de subida, crea una solicitud manualmente desde la UI con un residente.

> Sin PII real. Todos los datos son ficticios. Las imágenes provienen de `picsum.photos` (dominio público).

## Build para producción

```bash
npm run build
npm run preview
```

## Estructura de base de datos

La documentación completa del modelo de datos y las policies RLS vive en `docs/db/`:

- [`docs/db/schema.md`](docs/db/schema.md) — diagrama ER (Mermaid), tablas por módulo, triggers, funciones y Edge Functions.
- [`docs/db/rls.md`](docs/db/rls.md) — principios y tabla por tabla de las policies aplicadas.

### Módulos modelados

| Módulo | Tablas | Estado |
|---|---|---|
| Usuarios | `usuarios`, `invitaciones`, `edificios`, `unidades` | ✅ operativo (Sprint 2) |
| Mantenimiento v1 | `solicitudes`, `asignaciones`, `historial_estados` | ✅ residente crea con foto + admin visualiza (Sprint 3) |
| Mantenimiento v2 | (uso de `asignaciones`) | 🔜 vista del técnico + asignación (Sprint 4) |
| Comunicación | `anuncios`, `anuncio_lecturas` | ✅ tablón de anuncios: el admin publica (categoría, prioridad, imagen/PDF, fijar, vigencia) y el residente lo recibe en vivo y marca leído (Sprint 12) |
| Soporte global | `notificaciones`, `audit_log` | ✅ disponible |

### Storage

El módulo de mantenimiento usa Supabase Storage con un bucket privado `solicitudes-fotos` (JPEG/PNG, máx. 5 MB). URLs firmadas con caducidad de 1 hora para visualización. Documentación completa en [`/docs/storage.md`](docs/storage.md) y la decisión arquitectónica en [`/docs/adr/005-storage.md`](docs/adr/005-storage.md).

### Migraciones

Gestionadas con Supabase (`supabase db push` o MCP). Las migraciones aplicadas hasta el cierre del Sprint 2 están listadas en `docs/db/schema.md`.

### Edge Functions

Viven en `supabase/functions/`:

- `invitaciones` — crear/reenviar invitación (`accion: 'crear' | 'reenviar'`), escribe en `invitaciones` + `audit_log` con `service_role`.
- `bloquear-cuenta` — bloquear/desbloquear/activar usuario. Al bloquear: aplica `ban_duration` (impide nuevos logins) **y** llama a la RPC `revoke_user_sessions` que elimina sesiones activas en `auth.sessions` para forzar el cierre inmediato de la sesión del usuario bloqueado (PBI-S2-E02).

Despliegue:

```bash
supabase functions deploy invitaciones
supabase functions deploy bloquear-cuenta
# Variable opcional que fija el dominio de los links en los correos:
supabase secrets set SITE_URL=https://zity.site
```

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS v4 |
| Auth + DB | Supabase (Postgres 17 + Auth + Edge Functions) |
| Deploy | Vercel |
| CI/CD | GitHub Actions |
| Testing | Vitest + Testing Library |

## Política de datos

- Todos los datos de demo son ficticios.
- Prohibido subir PII real al repositorio.
- `.env` y `.env.local` están en `.gitignore`.
- El `audit_log` y las acciones administrativas (bloquear, invitar) las escribe solo el backend vía `service_role`; los clientes autenticados no escriben directamente en `audit_log`.
