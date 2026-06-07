import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { SignUpMetadata } from '../types/database'
import AuthLayout from '../components/AuthLayout'
import PasswordInput from '../components/PasswordInput'
import BarraProgreso from '../components/BarraProgreso'
import FieldError from '../components/FieldError'
import {
  ALPHANUMERIC_REGEX,
  EMAIL_REGEX,
  NAME_REGEX,
  PASSWORD_REGEX,
  PHONE_PREFIX,
} from '../lib/validators'

type Step1Data = {
  email: string
  password: string
  confirmPassword: string
}

type Step2Data = SignUpMetadata

type Step1Errors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>
type Step2Errors = Partial<Record<'nombre' | 'apellido' | 'telefono' | 'piso' | 'departamento', string>>

export default function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right')
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({})
  const [step2Errors, setStep2Errors] = useState<Step2Errors>({})

  const [step1, setStep1] = useState<Step1Data>({
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [step2, setStep2] = useState<Step2Data>({
    nombre: '',
    apellido: '',
    telefono: PHONE_PREFIX,
    piso: '',
    departamento: '',
    rol: 'residente',
  })

  // Hay progreso a partir de que el usuario comenzó a escribir credenciales.
  // Usamos esto para avisar antes de perder los datos al salir del formulario.
  const hayProgreso =
    !loading &&
    (step1.email !== '' ||
      step1.password !== '' ||
      step1.confirmPassword !== '' ||
      step === 2)

  // Aviso del navegador al cerrar pestaña o recargar.
  useEffect(() => {
    if (!hayProgreso) return
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hayProgreso])

  // Intercepta click en "Inicia sesión" al pie del formulario para confirmar
  // antes de perder los datos. useBlocker no es utilizable aquí porque la app
  // monta <BrowserRouter> (no Data Router).
  function confirmarSalida(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!hayProgreso) return
    const seguro = window.confirm('¿Deseas cancelar el registro? Se perderán los datos ingresados.')
    if (!seguro) e.preventDefault()
  }

  function validateStep1(): Step1Errors {
    const errors: Step1Errors = {}
    if (!EMAIL_REGEX.test(step1.email)) {
      errors.email = 'Ingresa un correo electrónico válido'
    }
    if (!PASSWORD_REGEX.test(step1.password)) {
      errors.password = 'La contraseña debe tener mínimo 8 caracteres, 1 mayúscula y 1 número.'
    }
    if (step1.password !== step1.confirmPassword) {
      errors.confirmPassword = 'Las contraseñas no coinciden.'
    }
    return errors
  }

  function validateStep2(): Step2Errors {
    const errors: Step2Errors = {}
    if (!NAME_REGEX.test(step2.nombre.trim())) {
      errors.nombre = 'Solo letras, mínimo 2 caracteres'
    }
    if (!NAME_REGEX.test(step2.apellido.trim())) {
      errors.apellido = 'Solo letras, mínimo 2 caracteres'
    }
    const phoneDigits = step2.telefono.replace(/\D/g, '').slice(2)
    if (phoneDigits.length > 0 && phoneDigits.length !== 9) {
      errors.telefono = 'Teléfono inválido. Ej: +51 999 999 999'
    }
    if (!ALPHANUMERIC_REGEX.test(step2.piso.trim())) {
      errors.piso = 'Piso inválido'
    }
    if (!ALPHANUMERIC_REGEX.test(step2.departamento.trim())) {
      errors.departamento = 'Departamento inválido'
    }
    return errors
  }

  function handleTelefonoChange(value: string) {
    const afterPrefix = value.startsWith(PHONE_PREFIX) ? value.slice(PHONE_PREFIX.length) : ''
    const digits = afterPrefix.replace(/\D/g, '').slice(0, 9)
    let formatted = ''
    for (let i = 0; i < digits.length; i++) {
      if (i === 3 || i === 6) formatted += ' '
      formatted += digits[i]
    }
    setStep2(prev => ({ ...prev, telefono: PHONE_PREFIX + formatted }))
  }

  function handleNext() {
    const errors = validateStep1()
    if (Object.keys(errors).length > 0) {
      setStep1Errors(errors)
      return
    }
    setStep1Errors({})
    setError('')
    setSlideDirection('right')
    setStep(2)
  }

  function handleBack() {
    setStep2Errors({})
    setError('')
    setSlideDirection('left')
    setStep(1)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errors = validateStep2()
    if (Object.keys(errors).length > 0) {
      setStep2Errors(errors)
      return
    }
    setStep2Errors({})
    setError('')
    setLoading(true)

    const phoneDigits = step2.telefono.replace(/\D/g, '').slice(2)
    const metadata: SignUpMetadata = {
      nombre: step2.nombre.trim(),
      apellido: step2.apellido.trim(),
      telefono: phoneDigits.length === 9 ? step2.telefono.trim() : '',
      piso: step2.piso.trim(),
      departamento: step2.departamento.trim().toUpperCase(),
      rol: step2.rol,
    }

    const { error: signUpError } = await signUp(step1.email, step1.password, metadata)

    if (signUpError) {
      setError(signUpError)
      setLoading(false)
      return
    }

    navigate('/verify-email', {
      state: { email: step1.email },
      replace: true,
    })
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle={step === 1 ? 'Paso 1 de 2 — Credenciales de acceso' : 'Paso 2 de 2 — Datos personales y edificio'}
    >
      {/* Barra de progreso */}
      <BarraProgreso pasoActual={step} totalPasos={2} />

      {/* Step indicator */}
      <div className="step-indicator mb-8 animate-fade-in">
        <div className={`step-dot ${step === 1 ? 'active' : 'completed'}`}>
          {step > 1 ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : '1'}
        </div>
        <div className={`step-line ${step > 1 ? 'completed' : 'pending'}`} />
        <div className={`step-dot ${step === 2 ? 'active' : 'pending'}`}>
          2
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-error/10 border border-error/20 rounded-lg text-error text-sm animate-scale-in flex items-start gap-3">
          <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Step 1 — Credenciales */}
      {step === 1 && (
        <div key="step1" className={slideDirection === 'left' ? 'animate-fade-in-left' : 'animate-fade-in-right'}>
          <div className="space-y-5">
            <div className="animate-fade-in delay-1">
              <label htmlFor="reg-email" className="block text-sm font-medium text-primary-800 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  value={step1.email}
                  onChange={e => setStep1(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="tu@correo.com"
                  className={`input-field has-icon ${step1Errors.email ? 'error' : ''}`}
                />
                <span className="field-icon">
                  <svg className="w-[1.15rem] h-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
              </div>
              {step1Errors.email && <FieldError message={step1Errors.email} />}
            </div>

            <div className="animate-fade-in delay-2">
              <PasswordInput
                label="Contraseña"
                value={step1.password}
                onChange={v => setStep1(prev => ({ ...prev, password: v }))}
                placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
                autoComplete="new-password"
                showStrength
                required
              />
              {step1Errors.password && <FieldError message={step1Errors.password} />}
            </div>

            <div className="animate-fade-in delay-3">
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-primary-800 mb-1.5">
                Confirmar contraseña
              </label>
              <input
                id="reg-confirm"
                type="password"
                autoComplete="new-password"
                value={step1.confirmPassword}
                onChange={e => setStep1(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Repite tu contraseña"
                className={`input-field ${
                  (step1.confirmPassword && step1.password !== step1.confirmPassword) || step1Errors.confirmPassword
                    ? 'error'
                    : ''
                }`}
              />
              {(step1.confirmPassword && step1.password !== step1.confirmPassword) || step1Errors.confirmPassword ? (
                <FieldError message="Las contraseñas no coinciden" />
              ) : null}
            </div>

            <div className="animate-fade-in delay-4 pt-2">
              <button type="button" onClick={handleNext} className="btn-primary cursor-pointer">
                Continuar
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 — Datos del edificio */}
      {step === 2 && (
        <form
          key="step2"
          onSubmit={handleSubmit}
          className={slideDirection === 'right' ? 'animate-fade-in-right' : 'animate-fade-in-left'}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 animate-fade-in delay-1">
              <div>
                <label htmlFor="nombre" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Nombre
                </label>
                <input
                  id="nombre"
                  type="text"
                  value={step2.nombre}
                  onChange={e => setStep2(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Laura"
                  className={`input-field ${step2Errors.nombre ? 'error' : ''}`}
                  disabled={loading}
                />
                {step2Errors.nombre && <FieldError message={step2Errors.nombre} />}
              </div>
              <div>
                <label htmlFor="apellido" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Apellido
                </label>
                <input
                  id="apellido"
                  type="text"
                  value={step2.apellido}
                  onChange={e => setStep2(prev => ({ ...prev, apellido: e.target.value }))}
                  placeholder="Vega"
                  className={`input-field ${step2Errors.apellido ? 'error' : ''}`}
                  disabled={loading}
                />
                {step2Errors.apellido && <FieldError message={step2Errors.apellido} />}
              </div>
            </div>

            <div className="animate-fade-in delay-2">
              <label htmlFor="telefono" className="block text-sm font-medium text-primary-800 mb-1.5">
                Teléfono <span className="text-warm-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  id="telefono"
                  type="tel"
                  value={step2.telefono}
                  onChange={e => handleTelefonoChange(e.target.value)}
                  placeholder="+51 999 999 999"
                  className={`input-field has-icon ${step2Errors.telefono ? 'error' : ''}`}
                  disabled={loading}
                  maxLength={15}
                />
                <span className="field-icon">
                  <svg className="w-[1.15rem] h-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </span>
              </div>
              {step2Errors.telefono && <FieldError message={step2Errors.telefono} />}
            </div>

            <div className="grid grid-cols-2 gap-4 animate-fade-in delay-3">
              <div>
                <label htmlFor="piso" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Piso
                </label>
                <input
                  id="piso"
                  type="text"
                  value={step2.piso}
                  onChange={e => setStep2(prev => ({ ...prev, piso: e.target.value }))}
                  placeholder="4"
                  className={`input-field ${step2Errors.piso ? 'error' : ''}`}
                  disabled={loading}
                />
                {step2Errors.piso && <FieldError message={step2Errors.piso} />}
              </div>
              <div>
                <label htmlFor="departamento" className="block text-sm font-medium text-primary-800 mb-1.5">
                  Departamento
                </label>
                <input
                  id="departamento"
                  type="text"
                  value={step2.departamento}
                  onChange={e => setStep2(prev => ({ ...prev, departamento: e.target.value }))}
                  placeholder="4B"
                  className={`input-field ${step2Errors.departamento ? 'error' : ''}`}
                  disabled={loading}
                />
                {step2Errors.departamento && <FieldError message={step2Errors.departamento} />}
              </div>
            </div>

            <div className="animate-fade-in delay-4">
              <label className="block text-sm font-medium text-primary-800 mb-2">
                Tipo de cuenta
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep2(prev => ({ ...prev, rol: 'residente' }))}
                  disabled={loading}
                  className={`cursor-pointer p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                    step2.rol === 'residente'
                      ? 'border-primary-500 bg-primary-50/50'
                      : 'border-warm-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      step2.rol === 'residente' ? 'bg-primary-600 text-white' : 'bg-warm-100 text-warm-400'
                    }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <span className="font-medium text-primary-900 text-sm">Residente</span>
                  </div>
                  <p className="text-xs text-warm-400">Crear solicitudes</p>
                </button>

                <button
                  type="button"
                  onClick={() => setStep2(prev => ({ ...prev, rol: 'tecnico' }))}
                  disabled={loading}
                  className={`cursor-pointer p-4 rounded-lg border-2 text-left transition-all duration-200 ${
                    step2.rol === 'tecnico'
                      ? 'border-primary-500 bg-primary-50/50'
                      : 'border-warm-200 hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                      step2.rol === 'tecnico' ? 'bg-primary-600 text-white' : 'bg-warm-100 text-warm-400'
                    }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <span className="font-medium text-primary-900 text-sm">Técnico</span>
                  </div>
                  <p className="text-xs text-warm-400">Atender tareas</p>
                </button>
              </div>
              <p className="mt-2 text-xs text-warm-400">
                Las cuentas de administrador son creadas internamente.
              </p>
            </div>

            <div className="flex gap-3 pt-3 animate-fade-in delay-5">
              <button
                type="button"
                onClick={handleBack}
                className="btn-secondary w-auto! px-6 cursor-pointer"
                disabled={loading}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Atrás
              </button>
              <button type="submit" disabled={loading} className="btn-primary cursor-pointer">
                {loading ? <span className="spinner" /> : null}
                {loading ? 'Creando...' : 'Crear cuenta'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="mt-8 pt-6 border-t border-warm-200 text-center animate-fade-in delay-6">
        <p className="text-sm text-warm-400">
          ¿Ya tienes cuenta?{' '}
          <Link
            to="/login"
            onClick={confirmarSalida}
            className="text-primary-600 hover:text-primary-700 font-semibold transition-colors"
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
