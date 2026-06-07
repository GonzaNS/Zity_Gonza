import { useState, useId } from 'react'

type PasswordInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  disabled?: boolean
  showStrength?: boolean
  required?: boolean
}

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/

function getStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score: 1, label: 'Débil', color: 'bg-error' }
  if (score <= 3) return { score: 2, label: 'Media', color: 'bg-warning' }
  return { score: 3, label: 'Fuerte', color: 'bg-success' }
}

export default function PasswordInput({
  label,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  disabled = false,
  showStrength = false,
  required = false,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const id = useId()

  const strength = showStrength ? getStrength(value) : null
  const hasError = showStrength && value.length > 0 && !PASSWORD_REGEX.test(value)

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-primary-800 mb-1.5">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={showPassword ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`input-field has-icon pr-12 ${hasError ? 'error' : ''}`}
          disabled={disabled}
        />
        <span className="field-icon">
          <svg className="w-[1.15rem] h-[1.15rem]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </span>
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-primary-600 transition-colors p-1.5 rounded-md hover:bg-warm-100 cursor-pointer"
          tabIndex={-1}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>

      {showStrength && value.length > 0 && strength && (
        <div className="mt-2 space-y-1.5 animate-fade-in">
          <div className="flex gap-1">
            {[1, 2, 3].map(level => (
              <div
                key={level}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  strength.score >= level ? strength.color : 'bg-warm-200'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-medium ${
              strength.label === 'Débil' ? 'text-error' :
              strength.label === 'Media' ? 'text-accent-700' :
              'text-success'
            }`}>
              {strength.label}
            </p>
            {hasError && (
              <p className="text-xs text-warm-400">
                Mín. 8 chars, 1 mayúscula, 1 número
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
