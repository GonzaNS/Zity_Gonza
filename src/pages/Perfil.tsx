import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_ROUTES } from '../lib/routing'
import zityLogo from '../assets/zity_logo.png'
import PasswordInput from '../components/PasswordInput'
import { logAuditAction } from '../lib/audit'
import type { Rol } from '../types/database'

const NOMBRE_MIN = 2
const NOMBRE_MAX = 80
const TELEFONO_MAX = 20

const ROL_LABEL: Record<Rol, string> = {
  residente: 'Residente',
  tecnico: 'Técnico',
  admin: 'Administrador',
}

const ROL_BADGE_CLS: Record<Rol, string> = {
  residente: 'bg-accent-500',
  tecnico: 'bg-success',
  admin: 'bg-primary-600',
}

export default function Perfil() {
  const { profile, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'info' | 'seguridad'>('info')

  const [nombre, setNombre] = useState(profile?.nombre ?? '')
  const [apellido, setApellido] = useState(profile?.apellido ?? '')
  const [telefono, setTelefono] = useState(profile?.telefono ?? '')
  const [guardandoInfo, setGuardandoInfo] = useState(false)
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [guardandoSeguridad, setGuardandoSeguridad] = useState(false)
  const [errorSeguridad, setErrorSeguridad] = useState<string | null>(null)
  
  const [toast, setToast] = useState<string | null>(null)

  // Rate Limiting + countdown visual en vivo (PBI-S5-E03)
  const [intentosFallidos, setIntentosFallidos] = useState(0)
  const [bloqueadoHasta, setBloqueadoHasta] = useState<number | null>(null)
  const [ahora, setAhora] = useState(() => Date.now())

  const isBloqueado = bloqueadoHasta !== null && ahora < bloqueadoHasta
  const segundosRestantes = bloqueadoHasta ? Math.max(0, Math.ceil((bloqueadoHasta - ahora) / 1000)) : 0

  useEffect(() => {
    if (!bloqueadoHasta) return
    const interval = setInterval(() => {
      const t = Date.now()
      setAhora(t)
      if (t >= bloqueadoHasta) {
        setBloqueadoHasta(null)
        setIntentosFallidos(0)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [bloqueadoHasta])

  const cambiosInfo = useMemo(() => {
    if (!profile) return null
    const nombreTrim = nombre.trim()
    const apellidoTrim = apellido.trim()
    const telefonoTrim = telefono.trim()

    const hayCambios =
      nombreTrim !== (profile.nombre ?? '').trim() ||
      apellidoTrim !== (profile.apellido ?? '').trim() ||
      telefonoTrim !== (profile.telefono ?? '').trim()

    const validos =
      nombreTrim.length >= NOMBRE_MIN &&
      nombreTrim.length <= NOMBRE_MAX &&
      apellidoTrim.length >= NOMBRE_MIN &&
      apellidoTrim.length <= NOMBRE_MAX &&
      telefonoTrim.length <= TELEFONO_MAX

    return { hayCambios, validos, nombreTrim, apellidoTrim, telefonoTrim }
  }, [nombre, apellido, telefono, profile])

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warm-50">
        <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  const rolLabel = ROL_LABEL[profile.rol]
  const rolBadge = ROL_BADGE_CLS[profile.rol]
  const volverHref = ROLE_ROUTES[profile.rol]

  async function handleGuardarInfo(e: React.FormEvent) {
    e.preventDefault()
    if (!profile || !cambiosInfo || !cambiosInfo.hayCambios || !cambiosInfo.validos) return

    setGuardandoInfo(true)
    setErrorInfo(null)
    setToast(null)

    const { error: updateError } = await supabase
      .from('usuarios')
      .update({
        nombre: cambiosInfo.nombreTrim,
        apellido: cambiosInfo.apellidoTrim,
        telefono: cambiosInfo.telefonoTrim || null,
      })
      .eq('id', profile.id)

    if (updateError) {
      setErrorInfo(updateError.message)
      setGuardandoInfo(false)
      return
    }

    await refreshProfile()

    setGuardandoInfo(false)
    setToast('Datos actualizados correctamente.')
    setTimeout(() => setToast(null), 3000)
  }

  async function handleGuardarSeguridad(e: React.FormEvent) {
    e.preventDefault()
    if (isBloqueado) return

    if (newPassword.length < 8) {
      setErrorSeguridad('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!/\d/.test(newPassword)) {
      setErrorSeguridad('La nueva contraseña debe incluir al menos un número.')
      return
    }
    if (newPassword === currentPassword) {
      setErrorSeguridad('La nueva contraseña no puede ser igual a la actual.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorSeguridad('Las contraseñas nuevas no coinciden.')
      return
    }

    setGuardandoSeguridad(true)
    setErrorSeguridad(null)

    try {
      // Re-auth silencioso
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: profile!.email,
        password: currentPassword,
      })

      if (authError) {
        const nuevosIntentos = intentosFallidos + 1
        setIntentosFallidos(nuevosIntentos)
        
        if (nuevosIntentos >= 3) {
          setBloqueadoHasta(Date.now() + 5 * 60 * 1000) // Bloqueo de 5 min
          setErrorSeguridad('Demasiados intentos fallidos. Intenta nuevamente en 5 minutos.')
        } else {
          setErrorSeguridad(`Contraseña actual incorrecta. Te quedan ${3 - nuevosIntentos} intentos.`)
        }
        setGuardandoSeguridad(false)
        return
      }

      // Si fue exitoso, actualizamos
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) throw updateError

      // PBI-S5-E03 / OWASP A02 — registrar el evento en audit_log SIN payload
      // de contraseña (solo la acción). Fire-and-forget.
      void logAuditAction(
        { accion: 'cambio_contrasena', entidad: 'usuarios', entidadId: profile!.id },
        profile!.id,
      )

      setIntentosFallidos(0)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setToast('Contraseña actualizada correctamente.')
      setTimeout(() => setToast(null), 3000)
    } catch (err) {
      setErrorSeguridad((err as Error).message)
    } finally {
      setGuardandoSeguridad(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-warm-50">
      <header className="bg-white border-b border-warm-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src={zityLogo} alt="Zity" className="h-8 w-auto shrink-0" />
            <span
              className={`text-[0.65rem] font-semibold ${rolBadge} text-white px-2 py-0.5 rounded-full tracking-wider uppercase shrink-0`}
            >
              {rolLabel}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate(volverHref)}
              className="text-sm text-primary-700 hover:text-primary-900 font-medium cursor-pointer hidden sm:inline"
            >
              ← Volver al panel
            </button>
            <button
              onClick={handleSignOut}
              className="text-sm text-warm-400 hover:text-error transition-colors font-medium whitespace-nowrap cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="animate-fade-in mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-primary-900 tracking-tight">
            Mi perfil
          </h1>
          <p className="mt-1 text-sm text-warm-400">
            Gestiona tu información personal y ajustes de seguridad.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden animate-fade-in delay-1">
          <div className="flex border-b border-warm-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-primary-600 text-primary-900'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              Información
            </button>
            <button
              onClick={() => setActiveTab('seguridad')}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'seguridad'
                  ? 'border-primary-600 text-primary-900'
                  : 'border-transparent text-warm-500 hover:text-warm-700'
              }`}
            >
              Seguridad
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'info' && (
              <form onSubmit={handleGuardarInfo} className="space-y-4 animate-fade-in">
                <fieldset disabled={guardandoInfo} className="space-y-4">
                  <legend className="text-xs uppercase tracking-wider text-warm-400 font-medium mb-2">
                    Datos personales
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="nombre" className="block text-sm font-medium text-primary-900 mb-1.5">
                        Nombre
                      </label>
                      <input
                        id="nombre"
                        type="text"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                        maxLength={NOMBRE_MAX}
                        required
                        className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label htmlFor="apellido" className="block text-sm font-medium text-primary-900 mb-1.5">
                        Apellido
                      </label>
                      <input
                        id="apellido"
                        type="text"
                        value={apellido}
                        onChange={e => setApellido(e.target.value)}
                        maxLength={NOMBRE_MAX}
                        required
                        className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="telefono" className="block text-sm font-medium text-primary-900 mb-1.5">
                      Teléfono
                      <span className="ml-1 font-normal text-warm-400">(opcional)</span>
                    </label>
                    <input
                      id="telefono"
                      type="tel"
                      value={telefono}
                      onChange={e => setTelefono(e.target.value)}
                      maxLength={TELEFONO_MAX}
                      placeholder="+51 999 999 999"
                      className="w-full h-11 px-3 rounded-lg border border-warm-300 text-sm text-primary-900 placeholder:text-warm-300 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50"
                    />
                  </div>
                </fieldset>

                <fieldset className="mt-6 pt-5 border-t border-warm-200 space-y-3">
                  <legend className="text-xs uppercase tracking-wider text-warm-400 font-medium mb-2">
                    Datos administrativos (solo lectura)
                  </legend>
                  <ReadonlyRow label="Email" value={profile.email} />
                  <ReadonlyRow label="Rol" value={rolLabel} />
                  {profile.empresa_tercero && (
                    <ReadonlyRow label="Empresa" value={profile.empresa_tercero} />
                  )}
                  {(profile.piso || profile.departamento) && (
                    <ReadonlyRow
                      label="Ubicación"
                      value={`Piso ${profile.piso || '—'} · Depto. ${profile.departamento || '—'}`}
                    />
                  )}
                  <ReadonlyRow
                    label="Estado de cuenta"
                    value={
                      profile.estado_cuenta === 'activo'
                        ? 'Activa'
                        : profile.estado_cuenta === 'pendiente'
                          ? 'Pendiente de activación'
                          : 'Bloqueada'
                    }
                  />
                </fieldset>

                {errorInfo && (
                  <div className="mt-5 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                    {errorInfo}
                  </div>
                )}

                <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
                  <button
                    type="submit"
                    disabled={guardandoInfo || !cambiosInfo?.hayCambios || !cambiosInfo?.validos}
                    className="h-11 px-6 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {guardandoInfo && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                    Guardar cambios
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'seguridad' && (
              <form onSubmit={handleGuardarSeguridad} className="space-y-5 animate-fade-in">
                {isBloqueado ? (
                  <div className="p-4 rounded-lg bg-error/10 border border-error/20 flex items-start gap-3">
                    <svg className="w-5 h-5 text-error mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-error">Seguridad bloqueada</p>
                      <p className="text-xs text-error/80 mt-1">
                        Demasiados intentos fallidos. Podrás intentar de nuevo en{' '}
                        <span className="font-semibold tabular-nums">
                          {Math.floor(segundosRestantes / 60)}:{String(segundosRestantes % 60).padStart(2, '0')}
                        </span>.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <PasswordInput
                      label="Contraseña actual"
                      value={currentPassword}
                      onChange={setCurrentPassword}
                      placeholder="Ingresa tu contraseña actual"
                      required
                    />
                    
                    <div className="border-t border-warm-200 pt-5">
                      <PasswordInput
                        label="Nueva contraseña"
                        value={newPassword}
                        onChange={setNewPassword}
                        placeholder="Mínimo 8 caracteres"
                        required
                      />
                    </div>
                    
                    <PasswordInput
                      label="Confirmar nueva contraseña"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      placeholder="Repite la nueva contraseña"
                      required
                    />

                    {errorSeguridad && (
                      <div className="p-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm">
                        {errorSeguridad}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={guardandoSeguridad || !currentPassword || !newPassword || !confirmPassword}
                        className="w-full sm:w-auto h-11 px-6 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {guardandoSeguridad && (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        Actualizar contraseña
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}
          </div>
        </div>

        {toast && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-success text-white px-5 py-3 rounded-full shadow-lg text-sm font-medium animate-fade-in"
            role="status"
          >
            ✓ {toast}
          </div>
        )}
      </main>
    </div>
  )
}

function ReadonlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1">
      <span className="text-xs sm:text-sm text-warm-400">{label}</span>
      <span className="text-sm font-medium text-primary-900 sm:text-right truncate">{value}</span>
    </div>
  )
}
