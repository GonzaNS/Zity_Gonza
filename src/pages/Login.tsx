import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'

export default function Login() {
  const location = useLocation()
  const { signIn, user, profile } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [remember, setRemember] = useState(false)

  // "Recordarme": precarga el correo guardado en visitas anteriores (sin tocar la sesión).
  useEffect(() => {
    const savedEmail = localStorage.getItem('zity_remember_email')
    if (savedEmail) {
      setEmail(savedEmail)
      setRemember(true)
    }
  }, [])

  const successMessage = (location.state as { message?: string })?.message

  // Si otra pestaña inició sesión mientras este formulario aún está enviando,
  // AuthContext recibirá SIGNED_IN vía storage sync y poblará user/profile.
  // GuestRoute hará la redirección, pero derivamos `loading` para no quedarnos
  // con el botón en "Ingresando…" mientras llega esa redirección.
  const sesionActivaLista = !!(user && profile?.estado_cuenta === 'activo')
  const loading = submitting && !sesionActivaLista

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // Persiste (o limpia) el correo recordado según la preferencia.
    if (remember) localStorage.setItem('zity_remember_email', email)
    else localStorage.removeItem('zity_remember_email')

    const { error: signInError } = await signIn(email, password)

    setSubmitting(false)

    if (signInError) {
      setError(signInError)
    }
  }

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Inicia sesión para acceder a tu panel"
    >
      {successMessage && (
        <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-lg text-success text-sm animate-fade-in flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

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
          <label htmlFor="email" className="block text-sm font-medium text-primary-800 mb-1.5">
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="email"
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
        </div>

        <div className="animate-fade-in delay-2">
          <PasswordInput
            label="Contraseña"
            value={password}
            onChange={setPassword}
            placeholder="Tu contraseña"
            autoComplete="current-password"
            disabled={loading}
            required
          />
        </div>

        <div className="flex items-center justify-between gap-3 animate-fade-in delay-3">
          <label className="group inline-flex items-center gap-2.5 cursor-pointer select-none">
            <span className="relative flex h-[1.15rem] w-[1.15rem] items-center justify-center">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={loading}
                className="peer sr-only"
              />
              <span className="absolute inset-0 rounded-[0.4rem] border-[1.5px] border-warm-300 bg-white transition-colors duration-200 group-hover:border-warm-400 peer-checked:border-primary-600 peer-checked:bg-primary-600 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500/40" />
              <svg
                className="relative h-3 w-3 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span className="text-sm text-primary-800">Recordarme</span>
          </label>

          <Link
            to="/forgot-password"
            className="text-sm text-accent-600 hover:text-accent-700 font-medium transition-colors"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <div className="animate-fade-in delay-4">
          <button type="submit" disabled={loading} className="btn-primary cursor-pointer">
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Ingresando...' : 'Iniciar sesión'}
            {!loading && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            )}
          </button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-warm-200 text-center animate-fade-in delay-5">
        <p className="text-sm text-warm-400">
          ¿No tienes cuenta?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-semibold transition-colors">
            Regístrate
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
