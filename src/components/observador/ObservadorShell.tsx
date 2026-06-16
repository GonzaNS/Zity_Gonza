// Sprint 14 · HU-EJEC-01 — Shell del observador (panel ejecutivo).
//
// Layout liviano para el rol 'observador': no tiene barra de navegación
// lateral con acciones operativas. Solo muestra:
//   • Logo Zity + badge "Solo lectura"
//   • Banner informativo amber (no puede modificar datos)
//   • Nombre del usuario y botón de logout en header
//   • Link "Ir al panel completo" solo visible para admin
//
// El observador no puede navegar a /admin, /admin/usuarios, etc.
// Intentarlo activa el redirect de ProtectedRoute hacia /admin/ejecutivo.

import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { iniciales } from '../../lib/format'
import zityLogo from '../../assets/zity_logo.png'

type Props = {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export default function ObservadorShell({ children, title, subtitle, actions }: Props) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-warm-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
          {/* Logo + badge */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={zityLogo} alt="Zity" className="h-8 w-auto" />
            <span className="hidden sm:inline text-[0.6rem] font-semibold bg-amber-500 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
              Solo lectura
            </span>
          </div>

          {/* Acciones del header + avatar */}
          <div className="flex items-center gap-3">
            {/* Si el usuario es admin, ofrece ruta al panel completo */}
            {profile?.rol === 'admin' && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-primary-700 border border-warm-200 rounded-lg hover:bg-warm-50 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Panel completo
              </button>
            )}

            {/* Avatar + nombre */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold shrink-0">
                {iniciales(profile?.nombre, profile?.apellido, 'OB')}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="text-xs font-medium text-primary-900 truncate leading-tight">
                  {profile?.nombre} {profile?.apellido}
                </p>
                <p className="text-[0.625rem] text-warm-400 truncate">Observador</p>
              </div>
            </div>

            {/* Cerrar sesión */}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-warm-400 hover:text-error transition-colors font-medium cursor-pointer"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Banner de aviso solo lectura ─────────────────────────────── */}
      <div className="bg-amber-50 border-b border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-amber-800">
            <strong>Acceso de solo lectura.</strong>{' '}
            Este panel es informativo. No puedes modificar datos operativos del edificio.
          </p>
        </div>
      </div>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10">
        {/* Encabezado de sección */}
        <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between animate-fade-in">
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-900 tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-1 text-sm text-warm-400">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>

        {children}
      </main>
    </div>
  )
}
