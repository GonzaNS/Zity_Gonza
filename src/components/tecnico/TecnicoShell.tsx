// HU-MANT-03 SPRINT-4 (+ PBI-S2-E03 SPRINT-5 enlace a /perfil)
// Layout base para todas las vistas del técnico: header con logo, nombre,
// badge de rol y botón de cierre de sesión.

import { useAuth } from '../../contexts/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import zityLogo from '../../assets/zity_logo.png'
import CampanaNotificaciones from '../shared/CampanaNotificaciones'

type Props = {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export default function TecnicoShell({ title, subtitle, children }: Props) {
  // HU-MANT-03 SPRINT-4
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50">
      {/* Header */}
      <header className="bg-white border-b border-warm-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={zityLogo} alt="Zity" className="h-8 w-auto shrink-0" />
            <span className="text-xs font-semibold bg-success text-white px-2.5 py-1 rounded-full tracking-wider uppercase shrink-0">
              Técnico
            </span>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <CampanaNotificaciones />
            {/* Sprint 5 · PBI-S2-E03 — link a perfil propio */}
            <Link
              to="/perfil"
              className="text-sm text-primary-700 hover:text-primary-900 truncate font-medium hidden sm:block"
              title="Editar mi perfil"
            >
              {profile?.nombre} {profile?.apellido}
            </Link>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4 animate-fade-in">
        <h1 className="font-display text-2xl font-semibold text-primary-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-warm-400">{subtitle}</p>}
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
        {children}
      </main>
    </div>
  )
}
