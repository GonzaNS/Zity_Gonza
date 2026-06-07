import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'

export default function ForgotPassword() {
  const { resetPassword } = useAuth()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await resetPassword(email)

    setLoading(false)

    if (resetError) {
      setError(resetError)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle="Te hemos enviado un enlace para restablecer tu contraseña"
      >
        <div className="text-center space-y-6 animate-fade-in">
          <div className="relative w-20 h-20 mx-auto animate-scale-in">
            <div className="absolute inset-0 bg-success/10 rounded-full animate-pulse" />
            <div className="relative w-full h-full bg-success/15 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-primary-800 text-[0.9375rem] leading-relaxed">
              Si el correo <strong className="font-semibold text-primary-900">{email}</strong> está registrado,
              recibirás un enlace para restablecer tu contraseña.
            </p>

            <div className="bg-warm-100/70 rounded-lg p-4 text-left">
              <p className="text-sm text-primary-700 font-medium mb-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Siguientes pasos
              </p>
              <ol className="text-sm text-primary-600 space-y-1.5 list-decimal list-inside">
                <li>Revisa tu bandeja de entrada</li>
                <li>Si no lo ves, busca en spam</li>
                <li>Haz clic en el enlace recibido</li>
                <li>Establece tu nueva contraseña</li>
              </ol>
            </div>

            <p className="text-warm-400 text-xs">
              El enlace expira en 1 hora por seguridad.
            </p>
          </div>

          <Link to="/login" className="btn-secondary inline-flex w-auto! px-8 cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Volver al inicio de sesión
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Recuperar contraseña"
      subtitle="Ingresa tu correo y te enviaremos un enlace para restablecerla"
    >
      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm animate-scale-in flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="animate-fade-in delay-1">
          <label htmlFor="reset-email" className="block text-sm font-medium text-primary-800 mb-1.5">
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              className="input-field has-icon"
              disabled={loading}
            />
            <span className="field-icon">
              <svg className="w-[1.15rem] h-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-xs text-warm-400 flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Usa el mismo correo con el que te registraste.
          </p>
        </div>

        <div className="animate-fade-in delay-2">
          <button type="submit" disabled={loading} className="btn-primary cursor-pointer">
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            {!loading && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-warm-200 text-center animate-fade-in delay-3">
        <p className="text-sm text-warm-400">
          ¿Recordaste tu contraseña?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
