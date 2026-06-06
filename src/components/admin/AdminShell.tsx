import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { iniciales } from '../../lib/format'
import zityLogo from '../../assets/zity_logo.png'
import CampanaNotificaciones from '../shared/CampanaNotificaciones'

type Props = {
  children: React.ReactNode
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

const NAV = [
  {
    to: '/admin',
    label: 'Dashboard',
    end: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/admin/usuarios',
    label: 'Usuarios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    to: '/admin/solicitudes',
    label: 'Solicitudes',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  // Sprint 5 · HU-AUDIT-01
  {
    to: '/admin/auditoria',
    label: 'Auditoría',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  // Sprint 7 · PBI-22 — Panel de métricas operativas
  {
    to: '/admin/metricas',
    label: 'Métricas',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  // Sprint 8 · HU-FACT-02 — Facturación y emisión de recibos
  {
    to: '/admin/facturacion',
    label: 'Facturación',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
      </svg>
    ),
  },
  // Sprint 10 · HU-TIENDA-02 — Tienda interna (catálogo)
  {
    to: '/admin/tienda',
    label: 'Tienda',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  // Sprint 11 · HU-TIENDA-08 — Pedidos de la tienda
  {
    to: '/admin/pedidos',
    label: 'Pedidos',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9h6m-6 3h3" />
      </svg>
    ),
  },
  // Sprint 12 · HU-ANUNCIO-02 — Tablón de anuncios (Comunicación)
  {
    to: '/admin/anuncios',
    label: 'Anuncios',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  // Sprint 5 · PBI-S2-E03 — perfil propio editable
  {
    to: '/perfil',
    label: 'Mi perfil',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
]

export default function AdminShell({ children, title, subtitle, actions }: Props) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const [drawerAbierto, setDrawerAbierto] = useState(false)

  // Bloquear scroll del body cuando el drawer está abierto (mobile).
  useEffect(() => {
    if (drawerAbierto) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [drawerAbierto])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50 flex">
      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-warm-200 lg:bg-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-warm-200">
          <img src={zityLogo} alt="Zity" className="h-8 w-auto" />
          <span className="text-[0.65rem] font-semibold bg-primary-600 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
            Admin
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-warm-400 hover:bg-warm-50 hover:text-primary-700'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-warm-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {iniciales(profile?.nombre, profile?.apellido, 'AD')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-primary-900 truncate">
                  {profile?.nombre} {profile?.apellido}
                </p>
                <p className="text-xs text-warm-400 truncate">{profile?.email}</p>
              </div>
            </div>
            <CampanaNotificaciones />
          </div>
          <button
            onClick={handleSignOut}
            className="w-full text-sm text-warm-400 hover:text-error transition-colors font-medium py-2 rounded-md hover:bg-warm-50 cursor-pointer"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Top bar — mobile */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-30 bg-white border-b border-warm-200">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <img src={zityLogo} alt="Zity" className="h-7 w-auto" />
            <span className="text-[0.6rem] font-semibold bg-primary-600 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <CampanaNotificaciones />
            <button
            onClick={() => setDrawerAbierto(true)}
            aria-label="Abrir menú"
            className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-primary-700 hover:bg-warm-50 rounded-md cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          </div>
        </div>
      </header>

      {/* Drawer — mobile */}
      {drawerAbierto && (
        <>
          <div
            onClick={() => setDrawerAbierto(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-fade-in"
            aria-hidden="true"
          />
          <aside className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-xs bg-white shadow-2xl animate-fade-in-right flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-warm-200">
              <span className="font-display text-lg font-semibold text-primary-900">Menú</span>
              <button
                onClick={() => setDrawerAbierto(false)}
                aria-label="Cerrar menú"
                className="min-w-11 min-h-11 -mr-2 flex items-center justify-center text-warm-400 hover:text-primary-700 rounded-md cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-b border-warm-200 bg-warm-50">
              <div className="w-11 h-11 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                {iniciales(profile?.nombre, profile?.apellido, 'AD')}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary-900 truncate">
                  {profile?.nombre} {profile?.apellido}
                </p>
                <p className="text-xs text-warm-400 truncate">{profile?.email}</p>
              </div>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-1">
              {NAV.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setDrawerAbierto(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-primary-800 hover:bg-warm-50'
                    }`
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="border-t border-warm-200 p-4">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 text-sm text-error font-medium py-3 rounded-md hover:bg-error/5 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-10 max-w-7xl mx-auto w-full">
          <div className="mb-6 sm:mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between animate-fade-in relative z-20">
            <div className="min-w-0">
              <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-semibold text-primary-900 tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-sm text-warm-400">{subtitle}</p>
              )}
            </div>
            {actions && <div className="shrink-0 overflow-visible">{actions}</div>}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}
