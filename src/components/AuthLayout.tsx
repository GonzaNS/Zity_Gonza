import { Link, Outlet } from 'react-router-dom'
import zityLogo from '../assets/zity_logo.png'
import VideoLoop from './VideoLoop'
import AuthBackdrop from './AuthBackdrop'

/**
 * AuthShell — layout route estático.
 * Renderiza el panel izquierdo (branding) una sola vez y expone
 * <Outlet> para que las rutas anidadas cambien solo el lado derecho.
 */
export function AuthShell() {
  return (
    <div className="relative min-h-dvh w-full flex items-center justify-center overflow-hidden bg-primary-100 p-4 sm:p-6 lg:p-8">
      <AuthBackdrop />

      {/* Tarjeta flotante — una columna en móvil/tablet, dos columnas en desktop */}
      <div className="relative w-full max-w-md lg:max-w-[68rem] grid lg:grid-cols-[1.05fr_1fr] overflow-hidden rounded-[1.75rem] bg-white border border-warm-200/70 shadow-[0_2px_4px_rgba(27,58,75,0.04),0_28px_64px_-28px_rgba(12,25,33,0.38)] animate-fade-in">
        {/* ── Lado del formulario (blanco: el wordmark oscuro se lee perfecto) ── */}
        <div className="relative flex flex-col px-7 py-9 sm:px-10 lg:px-14 lg:py-12">
          <Link to="/login" className="block w-full max-w-sm mx-auto lg:mx-0 animate-fade-in">
            <img
              src={zityLogo}
              alt="Zity"
              className="mx-auto h-14 w-auto will-change-transform transition-transform duration-300 hover:scale-[1.03]"
            />
          </Link>

          <div className="flex flex-1 flex-col justify-center py-9 lg:py-8">
            <div className="w-full max-w-sm mx-auto lg:mx-0">
              <Outlet />
            </div>
          </div>
        </div>

        {/* ── Lado del video (solo desktop) ── */}
        <div className="relative hidden lg:block p-3.5">
          <div
            className="relative h-full w-full min-h-[34rem] overflow-hidden rounded-[1.35rem]"
            style={{ background: 'linear-gradient(155deg, #1f4254 0%, #142e3b 45%, #0b171f 100%)' }}
          >
            {/* Rejilla de planos — se ve mientras el video no esté disponible */}
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(129,177,195,0.08) 1px, transparent 1px),' +
                  'linear-gradient(90deg, rgba(129,177,195,0.08) 1px, transparent 1px)',
                backgroundSize: '54px 54px',
                WebkitMaskImage: 'radial-gradient(120% 90% at 50% 28%, #000 0%, transparent 72%)',
                maskImage: 'radial-gradient(120% 90% at 50% 28%, #000 0%, transparent 72%)',
              }}
            />

            {/* VIDEO — loop continuo por crossfade. Archivo en /public/login-zity.mp4 */}
            <VideoLoop
              src="/login-zity.mp4"
              className="absolute inset-0 h-full w-full object-cover"
            />

            {/* Scrim inferior para legibilidad del overlay */}
            <div className="absolute inset-0 bg-linear-to-t from-primary-950/80 via-primary-950/10 to-transparent" />

            {/* Overlay de marca — mínimo y editorial */}
            <div className="absolute inset-x-0 bottom-0 p-9 lg:p-10">
              <div className="inline-flex items-center gap-2.5 mb-3.5">
                <span className="h-px w-10 bg-linear-to-r from-accent-400/80 to-transparent" />
                <span className="text-accent-300 text-[0.6875rem] uppercase tracking-[0.3em] font-semibold">
                  Gestión de edificios
                </span>
              </div>
              <p className="font-display text-white text-[2rem] leading-[1.1] font-light max-w-[22rem]">
                Todo tu edificio, <span className="italic text-accent-300">en un solo lugar</span>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * AuthLayout — contenido del lado derecho (título + subtítulo + children).
 * Se usa dentro de cada página de autenticación.
 */
type AuthLayoutProps = {
  children: React.ReactNode
  title: string
  subtitle?: string
}

export default function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <>
      <div className="animate-fade-in">
        <h2 className="font-display text-[2rem] lg:text-[2.25rem] font-semibold text-primary-900 tracking-[-0.02em] leading-[1.08]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-3 text-warm-400 text-[0.9375rem] leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-8">
        {children}
      </div>
    </>
  )
}
