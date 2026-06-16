// Sprint 12 · HU-ANUNCIO-04 — Cabecera compartida del residente.
//
// Centraliza la navegación del residente (antes duplicada inline en cada página)
// y aloja el nuevo enlace "Anuncios" con su badge de no leídos, recalculado en
// vivo desde BD (R3). Reusa la campana de notificaciones del S6.

import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import CampanaNotificaciones from '../shared/CampanaNotificaciones'
import { useAnunciosNoLeidos } from '../../hooks/useAnunciosResidente'
import zityLogo from '../../assets/zity_logo.png'

const linkBase = 'text-sm font-medium transition-colors hidden sm:inline'
function linkClass({ isActive }: { isActive: boolean }) {
  return `${linkBase} ${isActive ? 'text-primary-900' : 'text-primary-700 hover:text-primary-900'}`
}

type Props = {
  /** Contenido extra específico de la página (p. ej. el mini-carrito de la tienda). */
  slot?: React.ReactNode
}

export default function ResidenteHeader({ slot }: Props) {
  const { profile, signOut, user } = useAuth()
  const navigate = useNavigate()
  const noLeidos = useAnunciosNoLeidos(user?.id)

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="bg-white border-b border-warm-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/residente" aria-label="Inicio">
            <img src={zityLogo} alt="Zity" className="h-9 w-auto" />
          </Link>
          <span className="text-xs font-semibold bg-accent-500 text-white px-2.5 py-1 rounded-full tracking-wider uppercase">
            Residente
          </span>
        </div>

        <div className="flex items-center gap-4">
          <CampanaNotificaciones />
          {slot}

          <NavLink to="/residente" end className={linkClass}>Inicio</NavLink>
          <NavLink to="/residente/solicitudes" className={linkClass}>Solicitudes</NavLink>
          <NavLink to="/residente/facturas" className={linkClass}>Mis facturas</NavLink>
          <NavLink to="/residente/tienda" className={linkClass}>Tienda</NavLink>
          <NavLink
            to="/residente/anuncios"
            className={({ isActive }) =>
              `relative items-center gap-1.5 hidden sm:inline-flex ${linkBase} ${
                isActive ? 'text-primary-900' : 'text-primary-700 hover:text-primary-900'
              }`
            }
          >
            Anuncios
            {noLeidos > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[1.15rem] h-[1.15rem] px-1 rounded-full bg-error text-white text-[0.6rem] font-bold"
                aria-label={`${noLeidos} anuncios sin leer`}
              >
                {noLeidos > 99 ? '99+' : noLeidos}
              </span>
            )}
          </NavLink>

          <Link
            to="/perfil"
            className="text-sm text-primary-700 hover:text-primary-900 font-medium hidden sm:inline"
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
  )
}
